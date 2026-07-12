
import AccountManager from "../sdk/management";

const childProcess = require("child_process");
import debugCommand from "./debug";
import * as fs from "fs";
import chalk from "chalk";

const g2js = require("gradle-to-js/lib/parser");
import { format, formatDistanceToNow, isSameYear } from "date-fns";

const opener = require("opener");
import * as os from "os";
import * as path from "path";

const plist = require("plist");
const progress = require("progress");
import { confirm as confirmPrompt, input as inputPrompt } from "@inquirer/prompts";
import { promisify } from "util";

const { rimraf } = require("rimraf");
import * as semver from "semver";

const Table = require("cli-table");
const which = require("which");
const wordwrap = require("wordwrap");
import * as cli from "../types/cli";
import sign from "../lib/sign";

const xcode = require("xcode");
import {
  AccessKey,
  Account,
  App,
  CodePushError,
  CollaboratorMap,
  CollaboratorProperties,
  Deployment,
  DeploymentMetrics,
  Headers,
  Package,
  PackageInfo,
  Session,
  UpdateMetrics,
} from "../types";
import { getAndroidHermesEnabled, getiOSHermesEnabled, runHermesEmitBinaryCommand, isValidVersion } from "../lib/react-native";
import { fileDoesNotExistOrIsDirectory, isBinaryOrZip, fileExists } from "../utils/file";

const configFilePath: string = path.join(process.env.LOCALAPPDATA || process.env.HOME, ".srcpush.config");
const emailValidator = require("email-validator");
const packageJson = require("../../package.json");
const parseXml = promisify(require("xml2js").parseString);


const properties = require("properties");

const CLI_HEADERS: Headers = {
  "X-CodePush-CLI-Version": packageJson.version,
};

interface ILegacyLoginConnectionInfo {
  accessKeyName: string;
}

interface ILoginConnectionInfo {
  accessKey: string;
  customServerUrl?: string; // A custom serverUrl for internal debugging purposes
  preserveAccessKeyOnLogout?: boolean;
}

export interface UpdateMetricsWithTotalActive extends UpdateMetrics {
  totalActive: number;
}

export interface PackageWithMetrics {
  metrics?: UpdateMetricsWithTotalActive;
}

export const runtime = {
  sdk: undefined as AccountManager | undefined,
  log: (message: string | any): void => console.log(message),
  spawn: childProcess.spawn,
  execSync: childProcess.execSync,
  confirm: async (message: string = "Are you sure?"): Promise<boolean> => {
    return confirmPrompt({
      message: chalk.cyan(message),
      default: false,
    });
  },
  createEmptyTempReleaseFolder: (folderPath: string): Promise<void> => {
    throw new Error("createEmptyTempReleaseFolder is not initialized");
  },
  release: (_command: cli.IReleaseCommand): Promise<void> => {
    throw new Error("release is not initialized");
  },
};

export const log = runtime.log;
export const spawn = runtime.spawn;
export const execSync = runtime.execSync;
export const confirm = runtime.confirm;

let connectionInfo: ILoginConnectionInfo;

function accessKeyAdd(command: cli.IAccessKeyAddCommand): Promise<void> {
  return runtime.sdk.addAccessKey(command.name, command.ttl).then((accessKey: AccessKey) => {
    runtime.log(`Successfully created the "${command.name}" access key: ${accessKey.key}`);
    runtime.log("Make sure to save this key value somewhere safe, since you won't be able to view it from the CLI again!");
  });
}

function accessKeyPatch(command: cli.IAccessKeyPatchCommand): Promise<void> {
  const willUpdateName: boolean = isCommandOptionSpecified(command.newName) && command.oldName !== command.newName;
  const willUpdateTtl: boolean = isCommandOptionSpecified(command.ttl);

  if (!willUpdateName && !willUpdateTtl) {
    throw new Error("A new name and/or TTL must be provided.");
  }

  return runtime.sdk.patchAccessKey(command.oldName, command.newName, command.ttl).then((accessKey: AccessKey) => {
    let logMessage: string = "Successfully ";
    if (willUpdateName) {
      logMessage += `renamed the access key "${command.oldName}" to "${command.newName}"`;
    }

    if (willUpdateTtl) {
      const expirationDate = format(new Date(accessKey.expires), "EEEE, MMMM d, yyyy h:mm a");
      if (willUpdateName) {
        logMessage += ` and changed its expiration date to ${expirationDate}`;
      } else {
        logMessage += `changed the expiration date of the "${command.oldName}" access key to ${expirationDate}`;
      }
    }

    runtime.log(`${logMessage}.`);
  });
}

function accessKeyList(command: cli.IAccessKeyListCommand): Promise<void> {
  throwForInvalidOutputFormat(command.format);

  return runtime.sdk.getAccessKeys().then((accessKeys: AccessKey[]): void => {
    printAccessKeys(command.format, accessKeys);
  });
}

function accessKeyRemove(command: cli.IAccessKeyRemoveCommand): Promise<void> {
  return runtime.confirm().then((wasConfirmed: boolean): Promise<void> => {
    if (wasConfirmed) {
      return runtime.sdk.removeAccessKey(command.accessKey).then((): void => {
        runtime.log(`Successfully removed the "${command.accessKey}" access key.`);
      });
    }

    runtime.log("Access key removal cancelled.");
  });
}

function appAdd(command: cli.IAppAddCommand): Promise<void> {
  return runtime.sdk.addApp(command.appName).then((app: App): Promise<void> => {
    runtime.log('Successfully added the "' + command.appName + '" app, along with the following default deployments:');
    const deploymentListCommand: cli.IDeploymentListCommand = {
      type: cli.CommandType.deploymentList,
      appName: app.name,
      format: "table",
      displayKeys: true,
    };
    return deploymentList(deploymentListCommand, false);
  });
}

function appList(command: cli.IAppListCommand): Promise<void> {
  throwForInvalidOutputFormat(command.format);
  let apps: App[];
  return runtime.sdk.getApps().then((retrievedApps: App[]): void => {
    printAppList(command.format, retrievedApps);
  });
}

function appRemove(command: cli.IAppRemoveCommand): Promise<void> {
  return runtime.confirm("Are you sure you want to remove this app? Note that its deployment keys will be PERMANENTLY unrecoverable.").then(
    (wasConfirmed: boolean): Promise<void> => {
      if (wasConfirmed) {
        return runtime.sdk.removeApp(command.appName).then((): void => {
          runtime.log('Successfully removed the "' + command.appName + '" app.');
        });
      }

      runtime.log("App removal cancelled.");
    }
  );
}

function appRename(command: cli.IAppRenameCommand): Promise<void> {
  return runtime.sdk.renameApp(command.currentAppName, command.newAppName).then((): void => {
    runtime.log('Successfully renamed the "' + command.currentAppName + '" app to "' + command.newAppName + '".');
  });
}

export const createEmptyTempReleaseFolder = (folderPath: string) => {
  return deleteFolder(folderPath).then(() => {
    fs.mkdirSync(folderPath, { recursive: true });
  });
};

runtime.createEmptyTempReleaseFolder = createEmptyTempReleaseFolder;

function appTransfer(command: cli.IAppTransferCommand): Promise<void> {
  throwForInvalidEmail(command.email);

  return runtime.confirm().then((wasConfirmed: boolean): Promise<void> => {
    if (wasConfirmed) {
      return runtime.sdk.transferApp(command.appName, command.email).then((): void => {
        runtime.log(
          'Successfully transferred the ownership of app "' + command.appName + '" to the account with email "' + command.email + '".'
        );
      });
    }

    runtime.log("App transfer cancelled.");
  });
}

function addCollaborator(command: cli.ICollaboratorAddCommand): Promise<void> {
  throwForInvalidEmail(command.email);

  return runtime.sdk.addCollaborator(command.appName, command.email).then((): void => {
    runtime.log('Successfully added "' + command.email + '" as a collaborator to the app "' + command.appName + '".');
  });
}

function listCollaborators(command: cli.ICollaboratorListCommand): Promise<void> {
  throwForInvalidOutputFormat(command.format);

  return runtime.sdk.getCollaborators(command.appName).then((retrievedCollaborators: CollaboratorMap): void => {
    printCollaboratorsList(command.format, retrievedCollaborators);
  });
}

function removeCollaborator(command: cli.ICollaboratorRemoveCommand): Promise<void> {
  throwForInvalidEmail(command.email);

  return runtime.confirm().then((wasConfirmed: boolean): Promise<void> => {
    if (wasConfirmed) {
      return runtime.sdk.removeCollaborator(command.appName, command.email).then((): void => {
        runtime.log('Successfully removed "' + command.email + '" as a collaborator from the app "' + command.appName + '".');
      });
    }

    runtime.log("App collaborator removal cancelled.");
  });
}

function deleteConnectionInfoCache(printMessage: boolean = true): void {
  try {
    fs.unlinkSync(configFilePath);

    if (printMessage) {
      runtime.log(`Successfully logged-out. The session file located at ${chalk.cyan(configFilePath)} has been deleted.\r\n`);
    }
  } catch (ex) {}
}

function deleteFolder(folderPath: string): Promise<void> {
  return rimraf(folderPath).then(() => undefined);
}

function deploymentAdd(command: cli.IDeploymentAddCommand): Promise<void> {
  return runtime.sdk.addDeployment(command.appName, command.deploymentName, command.key).then((deployment: Deployment): void => {
    runtime.log(
      'Successfully added the "' +
        command.deploymentName +
        '" deployment with key "' +
        deployment.key +
        '" to the "' +
        command.appName +
        '" app.'
    );
  });
}

function deploymentHistoryClear(command: cli.IDeploymentHistoryClearCommand): Promise<void> {
  return runtime.confirm().then((wasConfirmed: boolean): Promise<void> => {
    if (wasConfirmed) {
      return runtime.sdk.clearDeploymentHistory(command.appName, command.deploymentName).then((): void => {
        runtime.log(
          'Successfully cleared the release history associated with the "' +
            command.deploymentName +
            '" deployment from the "' +
            command.appName +
            '" app.'
        );
      });
    }

    runtime.log("Clear deployment cancelled.");
  });
}

export const deploymentList = (command: cli.IDeploymentListCommand, showPackage: boolean = true): Promise<void> => {
  throwForInvalidOutputFormat(command.format);
  let deployments: Deployment[];

  return runtime.sdk
    .getDeployments(command.appName)
    .then((retrievedDeployments: Deployment[]) => {
      deployments = retrievedDeployments;
      if (showPackage) {
        const metricsPromises: Promise<void>[] = deployments.map((deployment: Deployment) => {
          if (deployment.package) {
            return runtime.sdk.getDeploymentMetrics(command.appName, deployment.name).then((metrics: DeploymentMetrics): void => {
              if (metrics[deployment.package.label]) {
                const totalActive: number = getTotalActiveFromDeploymentMetrics(metrics);
                (<PackageWithMetrics>deployment.package).metrics = {
                  active: metrics[deployment.package.label].active,
                  downloaded: metrics[deployment.package.label].downloaded,
                  failed: metrics[deployment.package.label].failed,
                  installed: metrics[deployment.package.label].installed,
                  totalActive: totalActive,
                };
              }
            });
          } else {
            return Promise.resolve();
          }
        });

        return Promise.all(metricsPromises);
      }
    })
    .then(() => {
      printDeploymentList(command, deployments, showPackage);
    });
};

function deploymentRemove(command: cli.IDeploymentRemoveCommand): Promise<void> {
  return runtime.confirm(
    "Are you sure you want to remove this deployment? Note that its deployment key will be PERMANENTLY unrecoverable."
  ).then((wasConfirmed: boolean): Promise<void> => {
    if (wasConfirmed) {
      return runtime.sdk.removeDeployment(command.appName, command.deploymentName).then((): void => {
        runtime.log('Successfully removed the "' + command.deploymentName + '" deployment from the "' + command.appName + '" app.');
      });
    }

    runtime.log("Deployment removal cancelled.");
  });
}

function deploymentRename(command: cli.IDeploymentRenameCommand): Promise<void> {
  return runtime.sdk.renameDeployment(command.appName, command.currentDeploymentName, command.newDeploymentName).then((): void => {
    runtime.log(
      'Successfully renamed the "' +
        command.currentDeploymentName +
        '" deployment to "' +
        command.newDeploymentName +
        '" for the "' +
        command.appName +
        '" app.'
    );
  });
}

function deploymentHistory(command: cli.IDeploymentHistoryCommand): Promise<void> {
  throwForInvalidOutputFormat(command.format);

  return Promise.all([
    runtime.sdk.getAccountInfo(),
    runtime.sdk.getDeploymentHistory(command.appName, command.deploymentName),
    runtime.sdk.getDeploymentMetrics(command.appName, command.deploymentName),
  ]).then(([account, deploymentHistory, metrics]: [Account, Package[], DeploymentMetrics]) => {
    const totalActive: number = getTotalActiveFromDeploymentMetrics(metrics);
    deploymentHistory.forEach((packageObject: Package) => {
      if (metrics[packageObject.label!]) {
        (<PackageWithMetrics>packageObject).metrics = {
          active: metrics[packageObject.label!].active,
          downloaded: metrics[packageObject.label!].downloaded,
          failed: metrics[packageObject.label!].failed,
          installed: metrics[packageObject.label!].installed,
          totalActive: totalActive,
        };
      }
    });
    printDeploymentHistory(command, deploymentHistory, account.email);
  });
}

function deserializeConnectionInfo(): ILoginConnectionInfo {
  try {
    const savedConnection: string = fs.readFileSync(configFilePath, {
      encoding: "utf8",
    });
    let connectionInfo: ILegacyLoginConnectionInfo | ILoginConnectionInfo = JSON.parse(savedConnection);

    // If the connection info is in the legacy format, convert it to the modern format
    if ((<ILegacyLoginConnectionInfo>connectionInfo).accessKeyName) {
      connectionInfo = <ILoginConnectionInfo>{
        accessKey: (<ILegacyLoginConnectionInfo>connectionInfo).accessKeyName,
      };
    }

    const connInfo = <ILoginConnectionInfo>connectionInfo;

    return connInfo;
  } catch (ex) {
    return;
  }
}

export async function execute(command: cli.ICommand): Promise<void> {
  connectionInfo = deserializeConnectionInfo();

  switch (command.type) {
    case cli.CommandType.login:
    case cli.CommandType.register:
      if (connectionInfo) {
        throw new Error("You are already logged in from this machine.");
      }
      break;

    case cli.CommandType.link:
      break;

    default:
      if (runtime.sdk) break;

      if (!connectionInfo) {
        throw new Error(
          "You are not currently logged in. Run the 'srcpush login' command to authenticate with the CodePush server."
        );
      }

      runtime.sdk = getSdk(connectionInfo.accessKey, CLI_HEADERS, connectionInfo.customServerUrl);
      break;
  }

  switch (command.type) {
    case cli.CommandType.accessKeyAdd:
      return accessKeyAdd(<cli.IAccessKeyAddCommand>command);

    case cli.CommandType.accessKeyPatch:
      return accessKeyPatch(<cli.IAccessKeyPatchCommand>command);

    case cli.CommandType.accessKeyList:
      return accessKeyList(<cli.IAccessKeyListCommand>command);

    case cli.CommandType.accessKeyRemove:
      return accessKeyRemove(<cli.IAccessKeyRemoveCommand>command);

    case cli.CommandType.appAdd:
      return appAdd(<cli.IAppAddCommand>command);

    case cli.CommandType.appList:
      return appList(<cli.IAppListCommand>command);

    case cli.CommandType.appRemove:
      return appRemove(<cli.IAppRemoveCommand>command);

    case cli.CommandType.appRename:
      return appRename(<cli.IAppRenameCommand>command);

    case cli.CommandType.appTransfer:
      return appTransfer(<cli.IAppTransferCommand>command);

    case cli.CommandType.collaboratorAdd:
      return addCollaborator(<cli.ICollaboratorAddCommand>command);

    case cli.CommandType.collaboratorList:
      return listCollaborators(<cli.ICollaboratorListCommand>command);

    case cli.CommandType.collaboratorRemove:
      return removeCollaborator(<cli.ICollaboratorRemoveCommand>command);

    case cli.CommandType.debug:
      return debugCommand(<cli.IDebugCommand>command);

    case cli.CommandType.deploymentAdd:
      return deploymentAdd(<cli.IDeploymentAddCommand>command);

    case cli.CommandType.deploymentHistoryClear:
      return deploymentHistoryClear(<cli.IDeploymentHistoryClearCommand>command);

    case cli.CommandType.deploymentHistory:
      return deploymentHistory(<cli.IDeploymentHistoryCommand>command);

    case cli.CommandType.deploymentList:
      return deploymentList(<cli.IDeploymentListCommand>command);

    case cli.CommandType.deploymentRemove:
      return deploymentRemove(<cli.IDeploymentRemoveCommand>command);

    case cli.CommandType.deploymentRename:
      return deploymentRename(<cli.IDeploymentRenameCommand>command);

    case cli.CommandType.link:
      return link(<cli.ILinkCommand>command);

    case cli.CommandType.login:
      return login(<cli.ILoginCommand>command);

    case cli.CommandType.logout:
      return logout(command);

    case cli.CommandType.patch:
      return patch(<cli.IPatchCommand>command);

    case cli.CommandType.promote:
      return promote(<cli.IPromoteCommand>command);

    case cli.CommandType.register:
      return register(<cli.IRegisterCommand>command);

    case cli.CommandType.release:
      return release(<cli.IReleaseCommand>command);

    case cli.CommandType.releaseReact:
      return releaseReact(<cli.IReleaseReactCommand>command);

    case cli.CommandType.rollback:
      return rollback(<cli.IRollbackCommand>command);

    case cli.CommandType.sessionList:
      return sessionList(<cli.ISessionListCommand>command);

    case cli.CommandType.sessionRemove:
      return sessionRemove(<cli.ISessionRemoveCommand>command);

    case cli.CommandType.whoami:
      return whoami(command);

    default:
      throw new Error("Invalid command:  " + JSON.stringify(command));
  }
}

function getTotalActiveFromDeploymentMetrics(metrics: DeploymentMetrics): number {
  let totalActive = 0;
  Object.keys(metrics).forEach((label: string) => {
    totalActive += metrics[label].active;
  });

  return totalActive;
}

function initiateExternalAuthenticationAsync(action: string, serverUrl?: string): void {
  const hostname: string = os.hostname();
  const url: string = `${serverUrl || AccountManager.APP_SERVER_URL}/cli-login?hostname=${hostname}`;
  runtime.log("Opening your browser...");
  runtime.log(`Visit ${url} and enter the code`);
  opener(url);
}

function link(command: cli.ILinkCommand): Promise<void> {
  initiateExternalAuthenticationAsync("link", command.serverUrl);
  return Promise.resolve();
}

function login(command: cli.ILoginCommand): Promise<void> {
  // Check if one of the flags were provided.
  if (command.accessKey) {
    runtime.sdk = getSdk(command.accessKey, CLI_HEADERS, command.apiServerUrl);
    return runtime.sdk.isAuthenticated().then((isAuthenticated: boolean): void => {
      if (isAuthenticated) {
        serializeConnectionInfo(command.accessKey, true, command.apiServerUrl);
      } else {
        throw new Error("Invalid access key.");
      }
    });
  } else {
    return loginWithExternalAuthentication("login", command.apiServerUrl, command.appServerUrl);
  }
}

function loginWithExternalAuthentication(action: string, apiServerUrl?: string, appServerUrl?: string): Promise<void> {
  initiateExternalAuthenticationAsync(action, appServerUrl);
  runtime.log(""); // Insert newline

  return requestAccessKey().then((accessKey: string): Promise<void> => {
    if (accessKey === null) {
      // The user has aborted the synchronous prompt (e.g.:  via [CTRL]+[C]).
      return;
    }

    runtime.sdk = getSdk(accessKey, CLI_HEADERS, apiServerUrl);

    return runtime.sdk.isAuthenticated().then((isAuthenticated: boolean): void => {
      if (isAuthenticated) {
        serializeConnectionInfo(accessKey, false, apiServerUrl);
      } else {
        throw new Error("Invalid access key.");
      }
    });
  });
}

function logout(command: cli.ICommand): Promise<void> {
  return Promise.resolve()
    .then((): Promise<void> => {
      if (!connectionInfo.preserveAccessKeyOnLogout) {
        const machineName: string = os.hostname();
        return runtime.sdk.removeSession(machineName).catch((error: CodePushError) => {
          // If we are not authenticated or the session doesn't exist anymore, just swallow the error instead of displaying it
          if (error.statusCode !== AccountManager.ERROR_UNAUTHORIZED && error.statusCode !== AccountManager.ERROR_NOT_FOUND) {
            throw error;
          }
        });
      }
    })
    .then((): void => {
      runtime.sdk = undefined;
      deleteConnectionInfoCache();
    });
}

function formatDate(unixOffset: number): string {
  const date = new Date(unixOffset);
  const now = new Date();
  const daysDiff = Math.abs((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 30) {
    return formatDistanceToNow(date, { addSuffix: true });
  } else if (isSameYear(now, date)) {
    return format(date, "MMM d");
  }
  return format(date, "MMM d, yyyy");
}

function printAppList(format: string, apps: App[]): void {
  if (format === "json") {
    printJson(apps);
  } else if (format === "table") {
    const headers = ["Name", "Deployments"];
    printTable(headers, (dataSource: any[]): void => {
      apps.forEach((app: App, index: number): void => {
        const row = [app.name, wordwrap(50)(app.deployments.join(", "))];
        dataSource.push(row);
      });
    });
  }
}

function getCollaboratorDisplayName(email: string, collaboratorProperties: CollaboratorProperties): string {
  return collaboratorProperties.permission === AccountManager.AppPermission.OWNER ? email + chalk.magenta(" (Owner)") : email;
}

function printCollaboratorsList(format: string, collaborators: CollaboratorMap): void {
  if (format === "json") {
    const dataSource = { collaborators: collaborators };
    printJson(dataSource);
  } else if (format === "table") {
    const headers = ["E-mail Address"];
    printTable(headers, (dataSource: any[]): void => {
      Object.keys(collaborators).forEach((email: string): void => {
        const row = [getCollaboratorDisplayName(email, collaborators[email])];
        dataSource.push(row);
      });
    });
  }
}

function printDeploymentList(command: cli.IDeploymentListCommand, deployments: Deployment[], showPackage: boolean = true): void {
  if (command.format === "json") {
    printJson(deployments);
  } else if (command.format === "table") {
    const headers = ["Name"];
    if (command.displayKeys) {
      headers.push("Deployment Key");
    }

    if (showPackage) {
      headers.push("Update Metadata");
      headers.push("Install Metrics");
    }

    printTable(headers, (dataSource: any[]): void => {
      deployments.forEach((deployment: Deployment): void => {
        const row = [deployment.name];
        if (command.displayKeys) {
          row.push(deployment.key);
        }

        if (showPackage) {
          row.push(getPackageString(deployment.package));
          row.push(getPackageMetricsString(deployment.package));
        }

        dataSource.push(row);
      });
    });
  }
}

function printDeploymentHistory(command: cli.IDeploymentHistoryCommand, deploymentHistory: Package[], currentUserEmail: string): void {
  if (command.format === "json") {
    printJson(deploymentHistory);
  } else if (command.format === "table") {
    const headers = ["Label", "Release Time", "App Version", "Mandatory"];
    if (command.displayAuthor) {
      headers.push("Released By");
    }

    headers.push("Description", "Install Metrics");

    printTable(headers, (dataSource: any[]) => {
      deploymentHistory.forEach((packageObject: Package) => {
        let releaseTime: string = formatDate(packageObject.uploadTime);
        let releaseSource: string;
        if (packageObject.releaseMethod === "Promote") {
          releaseSource = `Promoted ${packageObject.originalLabel} from "${packageObject.originalDeployment}"`;
        } else if (packageObject.releaseMethod === "Rollback") {
          const labelNumber: number = parseInt(packageObject.label.substring(1));
          const lastLabel: string = "v" + (labelNumber - 1);
          releaseSource = `Rolled back ${lastLabel} to ${packageObject.originalLabel}`;
        }

        if (releaseSource) {
          releaseTime += "\n" + chalk.magenta(`(${releaseSource})`).toString();
        }

        let row: string[] = [packageObject.label, releaseTime, packageObject.appVersion, packageObject.isMandatory ? "Yes" : "No"];
        if (command.displayAuthor) {
          let releasedBy: string = packageObject.releasedBy ? packageObject.releasedBy : "";
          if (currentUserEmail && releasedBy === currentUserEmail) {
            releasedBy = "You";
          }

          row.push(releasedBy);
        }

        row.push(packageObject.description ? wordwrap(30)(packageObject.description) : "");
        row.push(getPackageMetricsString(packageObject) + (packageObject.isDisabled ? `\n${chalk.green("Disabled:")} Yes` : ""));
        if (packageObject.isDisabled) {
          row = row.map((cellContents: string) => applyChalkSkippingLineBreaks(cellContents, (<any>chalk).dim));
        }

        dataSource.push(row);
      });
    });
  }
}

function applyChalkSkippingLineBreaks(applyString: string, chalkMethod: (string: string) => any): string {
  // Used to prevent "chalk" from applying styles to linebreaks which
  // causes table border chars to have the style applied as well.
  return applyString
    .split("\n")
    .map((token: string) => chalkMethod(token))
    .join("\n");
}

function getPackageString(packageObject: Package): string {
  if (!packageObject) {
    return chalk.magenta("No updates released").toString();
  }

  let packageString: string =
    chalk.green("Label: ") +
    packageObject.label +
    "\n" +
    chalk.green("App Version: ") +
    packageObject.appVersion +
    "\n" +
    chalk.green("Mandatory: ") +
    (packageObject.isMandatory ? "Yes" : "No") +
    "\n" +
    chalk.green("Release Time: ") +
    formatDate(packageObject.uploadTime) +
    "\n" +
    chalk.green("Released By: ") +
    (packageObject.releasedBy ? packageObject.releasedBy : "") +
    (packageObject.description ? wordwrap(70)("\n" + chalk.green("Description: ") + packageObject.description) : "");

  if (packageObject.isDisabled) {
    packageString += `\n${chalk.green("Disabled:")} Yes`;
  }

  return packageString;
}

function getPackageMetricsString(obj: Package): string {
  const packageObject = <PackageWithMetrics>obj;
  const rolloutString: string =
    obj && obj.rollout && obj.rollout !== 100 ? `\n${chalk.green("Rollout:")} ${obj.rollout.toLocaleString()}%` : "";

  if (!packageObject || !packageObject.metrics) {
    return chalk.magenta("No installs recorded").toString() + (rolloutString || "");
  }

  const activePercent: number = packageObject.metrics.totalActive
    ? (packageObject.metrics.active / packageObject.metrics.totalActive) * 100
    : 0.0;
  let percentString: string;
  if (activePercent === 100.0) {
    percentString = "100%";
  } else if (activePercent === 0.0) {
    percentString = "0%";
  } else {
    percentString = activePercent.toPrecision(2) + "%";
  }

  const numPending: number = packageObject.metrics.downloaded - packageObject.metrics.installed - packageObject.metrics.failed;
  let returnString: string =
    chalk.green("Active: ") +
    percentString +
    " (" +
    packageObject.metrics.active.toLocaleString() +
    " of " +
    packageObject.metrics.totalActive.toLocaleString() +
    ")\n" +
    chalk.green("Total: ") +
    packageObject.metrics.installed.toLocaleString();

  if (numPending > 0) {
    returnString += " (" + numPending.toLocaleString() + " pending)";
  }

  if (packageObject.metrics.failed) {
    returnString += "\n" + chalk.green("Rollbacks: ") + chalk.red(packageObject.metrics.failed.toLocaleString() + "");
  }

  if (rolloutString) {
    returnString += rolloutString;
  }

  return returnString;
}

function getReactNativeProjectAppVersion(command: cli.IReleaseReactCommand, projectName: string): Promise<string> {
  runtime.log(chalk.cyan(`Detecting ${command.platform} app version:\n`));

  if (command.platform === "ios") {
    let resolvedPlistFile: string = command.plistFile;
    if (resolvedPlistFile) {
      // If a plist file path is explicitly provided, then we don't
      // need to attempt to "resolve" it within the well-known locations.
      if (!fileExists(resolvedPlistFile)) {
        throw new Error("The specified plist file doesn't exist. Please check that the provided path is correct.");
      }
    } else {
      // Allow the plist prefix to be specified with or without a trailing
      // separator character, but prescribe the use of a hyphen when omitted,
      // since this is the most commonly used convetion for plist files.
      if (command.plistFilePrefix && /.+[^-.]$/.test(command.plistFilePrefix)) {
        command.plistFilePrefix += "-";
      }

      const iOSDirectory: string = "ios";
      const plistFileName = `${command.plistFilePrefix || ""}Info.plist`;

      const knownLocations = [path.join(iOSDirectory, projectName, plistFileName), path.join(iOSDirectory, plistFileName)];

      resolvedPlistFile = (<any>knownLocations).find(fileExists);

      if (!resolvedPlistFile) {
        throw new Error(
          `Unable to find either of the following plist files in order to infer your app's binary version: "${knownLocations.join(
            '", "'
          )}". If your plist has a different name, or is located in a different directory, consider using either the "--plistFile" or "--plistFilePrefix" parameters to help inform the CLI how to find it.`
        );
      }
    }

    const plistContents = fs.readFileSync(resolvedPlistFile).toString();

    let parsedPlist;

    try {
      parsedPlist = plist.parse(plistContents);
    } catch (e) {
      throw new Error(`Unable to parse "${resolvedPlistFile}". Please ensure it is a well-formed plist file.`);
    }

    if (parsedPlist && parsedPlist.CFBundleShortVersionString) {
      if (isValidVersion(parsedPlist.CFBundleShortVersionString)) {
        runtime.log(`Using the target binary version value "${parsedPlist.CFBundleShortVersionString}" from "${resolvedPlistFile}".\n`);
        return Promise.resolve(parsedPlist.CFBundleShortVersionString);
      } else {
        if (parsedPlist.CFBundleShortVersionString !== "$(MARKETING_VERSION)") {
          throw new Error(
            `The "CFBundleShortVersionString" key in the "${resolvedPlistFile}" file needs to specify a valid semver string, containing both a major and minor version (e.g. 1.3.2, 1.1).`
          );
        }

        return getAppVersionFromXcodeProject(command, projectName);
      }
    } else {
      throw new Error(`The "CFBundleShortVersionString" key doesn't exist within the "${resolvedPlistFile}" file.`);
    }
  } else if (command.platform === "android") {
    let buildGradlePath: string = path.join("android", "app");
    if (command.gradleFile) {
      buildGradlePath = command.gradleFile;
    }
    if (fs.lstatSync(buildGradlePath).isDirectory()) {
      buildGradlePath = path.join(buildGradlePath, "build.gradle");
    }

    if (fileDoesNotExistOrIsDirectory(buildGradlePath)) {
      throw new Error(`Unable to find gradle file "${buildGradlePath}".`);
    }

    return g2js
      .parseFile(buildGradlePath)
      .catch(() => {
        throw new Error(`Unable to parse the "${buildGradlePath}" file. Please ensure it is a well-formed Gradle file.`);
      })
      .then((buildGradle: any) => {
        let versionName: string = null;

        // First 'if' statement was implemented as workaround for case
        // when 'build.gradle' file contains several 'android' nodes.
        // In this case 'buildGradle.android' prop represents array instead of object
        // due to parsing issue in 'g2js.parseFile' method.
        if (buildGradle.android instanceof Array) {
          for (let i = 0; i < buildGradle.android.length; i++) {
            const gradlePart = buildGradle.android[i];
            if (gradlePart.defaultConfig && gradlePart.defaultConfig.versionName) {
              versionName = gradlePart.defaultConfig.versionName;
              break;
            }
          }
        } else if (buildGradle.android && buildGradle.android.defaultConfig && buildGradle.android.defaultConfig.versionName) {
          versionName = buildGradle.android.defaultConfig.versionName;
        } else {
          throw new Error(
            `The "${buildGradlePath}" file doesn't specify a value for the "android.defaultConfig.versionName" property.`
          );
        }

        if (typeof versionName !== "string") {
          throw new Error(
            `The "android.defaultConfig.versionName" property value in "${buildGradlePath}" is not a valid string. If this is expected, consider using the --targetBinaryVersion option to specify the value manually.`
          );
        }

        let appVersion: string = versionName.replace(/"/g, "").trim();

        if (isValidVersion(appVersion)) {
          // The versionName property is a valid semver string,
          // so we can safely use that and move on.
          runtime.log(`Using the target binary version value "${appVersion}" from "${buildGradlePath}".\n`);
          return appVersion;
        } else if (/^\d.*/.test(appVersion)) {
          // The versionName property isn't a valid semver string,
          // but it starts with a number, and therefore, it can't
          // be a valid Gradle property reference.
          throw new Error(
            `The "android.defaultConfig.versionName" property in the "${buildGradlePath}" file needs to specify a valid semver string, containing both a major and minor version (e.g. 1.3.2, 1.1).`
          );
        }

        // The version property isn't a valid semver string
        // so we assume it is a reference to a property variable.
        const propertyName = appVersion.replace("project.", "");
        const propertiesFileName = "gradle.properties";

        const knownLocations = [path.join("android", "app", propertiesFileName), path.join("android", propertiesFileName)];

        // Search for gradle properties across all `gradle.properties` files
        let propertiesFile: string = null;
        for (let i = 0; i < knownLocations.length; i++) {
          propertiesFile = knownLocations[i];
          if (fileExists(propertiesFile)) {
            const propertiesContent: string = fs.readFileSync(propertiesFile).toString();
            try {
              const parsedProperties: any = properties.parse(propertiesContent);
              appVersion = parsedProperties[propertyName];
              if (appVersion) {
                break;
              }
            } catch (e) {
              throw new Error(`Unable to parse "${propertiesFile}". Please ensure it is a well-formed properties file.`);
            }
          }
        }

        if (!appVersion) {
          throw new Error(`No property named "${propertyName}" exists in the "${propertiesFile}" file.`);
        }

        if (!isValidVersion(appVersion)) {
          throw new Error(
            `The "${propertyName}" property in the "${propertiesFile}" file needs to specify a valid semver string, containing both a major and minor version (e.g. 1.3.2, 1.1).`
          );
        }

        runtime.log(`Using the target binary version value "${appVersion}" from the "${propertyName}" key in the "${propertiesFile}" file.\n`);
        return appVersion.toString();
      });
  } else {
    const appxManifestFileName: string = "Package.appxmanifest";
    let appxManifestContainingFolder: string;
    let appxManifestContents: string;

    try {
      appxManifestContainingFolder = path.join("windows", projectName);
      appxManifestContents = fs.readFileSync(path.join(appxManifestContainingFolder, "Package.appxmanifest")).toString();
    } catch (err) {
      throw new Error(`Unable to find or read "${appxManifestFileName}" in the "${path.join("windows", projectName)}" folder.`);
    }

    return parseXml(appxManifestContents)
      .catch((err: any) => {
        throw new Error(
          `Unable to parse the "${path.join(appxManifestContainingFolder, appxManifestFileName)}" file, it could be malformed.`
        );
      })
      .then((parsedAppxManifest: any) => {
        try {
          return parsedAppxManifest.Package.Identity[0]["$"].Version.match(/^\d+\.\d+\.\d+/)[0];
        } catch (e) {
          throw new Error(
            `Unable to parse the package version from the "${path.join(appxManifestContainingFolder, appxManifestFileName)}" file.`
          );
        }
      });
  }
}

function getAppVersionFromXcodeProject(command: cli.IReleaseReactCommand, projectName: string): Promise<string> {
  const pbxprojFileName = "project.pbxproj";
  let resolvedPbxprojFile: string = command.xcodeProjectFile;
  if (resolvedPbxprojFile) {
    // If the xcode project file path is explicitly provided, then we don't
    // need to attempt to "resolve" it within the well-known locations.
    if (!resolvedPbxprojFile.endsWith(pbxprojFileName)) {
      // Specify path to pbxproj file if the provided file path is an Xcode project file.
      resolvedPbxprojFile = path.join(resolvedPbxprojFile, pbxprojFileName);
    }
    if (!fileExists(resolvedPbxprojFile)) {
      throw new Error("The specified pbx project file doesn't exist. Please check that the provided path is correct.");
    }
  } else {
    const iOSDirectory = "ios";
    const xcodeprojDirectory = `${projectName}.xcodeproj`;
    const pbxprojKnownLocations = [
      path.join(iOSDirectory, xcodeprojDirectory, pbxprojFileName),
      path.join(iOSDirectory, pbxprojFileName),
    ];
    resolvedPbxprojFile = pbxprojKnownLocations.find(fileExists);

    if (!resolvedPbxprojFile) {
      throw new Error(
        `Unable to find either of the following pbxproj files in order to infer your app's binary version: "${pbxprojKnownLocations.join(
          '", "'
        )}".`
      );
    }
  }

  const xcodeProj = xcode.project(resolvedPbxprojFile).parseSync();
  const marketingVersion = xcodeProj.getBuildProperty("MARKETING_VERSION", command.buildConfigurationName, command.xcodeTargetName);
  if (!isValidVersion(marketingVersion)) {
    throw new Error(
      `The "MARKETING_VERSION" key in the "${resolvedPbxprojFile}" file needs to specify a valid semver string, containing both a major and minor version (e.g. 1.3.2, 1.1).`
    );
  }
  runtime.log(`Using the target binary version value "${marketingVersion}" from "${resolvedPbxprojFile}".\n`);

  return marketingVersion;
}

function printJson(object: any): void {
  runtime.log(JSON.stringify(object, null, 2));
}

function printAccessKeys(format: string, keys: AccessKey[]): void {
  if (format === "json") {
    printJson(keys);
  } else if (format === "table") {
    printTable(["Name", "Created", "Expires"], (dataSource: any[]): void => {
      const now = new Date().getTime();

      function isExpired(key: AccessKey): boolean {
        return now >= key.expires;
      }

      function keyToTableRow(key: AccessKey, dim: boolean): string[] {
        const row: string[] = [key.name, key.createdTime ? formatDate(key.createdTime) : "", formatDate(key.expires)];

        if (dim) {
          row.forEach((col: string, index: number) => {
            row[index] = (<any>chalk).dim(col);
          });
        }

        return row;
      }

      keys.forEach((key: AccessKey) => !isExpired(key) && dataSource.push(keyToTableRow(key, false)));
      keys.forEach((key: AccessKey) => isExpired(key) && dataSource.push(keyToTableRow(key, true)));
    });
  }
}

function printSessions(format: string, sessions: Session[]): void {
  if (format === "json") {
    printJson(sessions);
  } else if (format === "table") {
    printTable(["Machine", "Logged in"], (dataSource: any[]): void => {
      sessions.forEach((session: Session) => dataSource.push([session.machineName, formatDate(session.loggedInTime)]));
    });
  }
}

function printTable(columnNames: string[], readData: (dataSource: any[]) => void): void {
  const table = new Table({
    head: columnNames,
    style: { head: ["cyan"] },
  });

  readData(table);

  runtime.log(table.toString());
}

function register(command: cli.IRegisterCommand): Promise<void> {
  return loginWithExternalAuthentication("register", command.serverUrl);
}

function promote(command: cli.IPromoteCommand): Promise<void> {
  const packageInfo: PackageInfo = {
    appVersion: command.appStoreVersion,
    description: command.description,
    label: command.label,
    isDisabled: command.disabled,
    isMandatory: command.mandatory,
    rollout: command.rollout,
  };

  return runtime.sdk
    .promote(command.appName, command.sourceDeploymentName, command.destDeploymentName, packageInfo)
    .then((): void => {
      runtime.log(
        "Successfully promoted " +
          (command.label != null ? '"' + command.label + '" of ' : "") +
          'the "' +
          command.sourceDeploymentName +
          '" deployment of the "' +
          command.appName +
          '" app to the "' +
          command.destDeploymentName +
          '" deployment.'
      );
    })
    .catch((err: CodePushError) => releaseErrorHandler(err, command));
}

function patch(command: cli.IPatchCommand): Promise<void> {
  const packageInfo: PackageInfo = {
    appVersion: command.appStoreVersion,
    description: command.description,
    isMandatory: command.mandatory,
    isDisabled: command.disabled,
    rollout: command.rollout,
  };

  for (const updateProperty in packageInfo) {
    if ((<any>packageInfo)[updateProperty] !== null) {
      return runtime.sdk.patchRelease(command.appName, command.deploymentName, command.label, packageInfo).then((): void => {
        runtime.log(
          `Successfully updated the "${command.label ? command.label : `latest`}" release of "${command.appName}" app's "${
            command.deploymentName
          }" deployment.`
        );
      });
    }
  }

  throw new Error("At least one property must be specified to patch a release.");
}

export const release = (command: cli.IReleaseCommand): Promise<void> => {
  if (isBinaryOrZip(command.package)) {
    throw new Error(
      "It is unnecessary to package releases in a .zip or binary file. Please specify the direct path to the update content's directory (e.g. /platforms/ios/www) or file (e.g. main.jsbundle)."
    );
  }

  throwForInvalidSemverRange(command.appStoreVersion);
  const filePath: string = command.package;
  let isSingleFilePackage: boolean = true;

  if (fs.lstatSync(filePath).isDirectory()) {
    isSingleFilePackage = false;
  }

  let lastTotalProgress = 0;
  const progressBar = new progress("Upload progress:[:bar] :percent :etas", {
    complete: "=",
    incomplete: " ",
    width: 50,
    total: 100,
  });

  const uploadProgress = (currentProgress: number): void => {
    progressBar.tick(currentProgress - lastTotalProgress);
    lastTotalProgress = currentProgress;
  };

  const updateMetadata: PackageInfo = {
    description: command.description,
    isDisabled: command.disabled,
    isMandatory: command.mandatory,
    rollout: command.rollout,
  };

  return runtime.sdk
    .isAuthenticated(true)
    .then((isAuth: boolean): Promise<void> => {
      return runtime.sdk.release(command.appName, command.deploymentName, filePath, command.appStoreVersion, updateMetadata, uploadProgress);
    })
    .then((): void => {
      runtime.log(
        'Successfully released an update containing the "' +
          command.package +
          '" ' +
          (isSingleFilePackage ? "file" : "directory") +
          ' to the "' +
          command.deploymentName +
          '" deployment of the "' +
          command.appName +
          '" app.'
      );
    })
    .catch((err: CodePushError) => releaseErrorHandler(err, command));
};

runtime.release = release;

export const releaseReact = (command: cli.IReleaseReactCommand): Promise<void> => {
  let bundleName: string = command.bundleName;
  let entryFile: string = command.entryFile;
  const outputFolder: string = command.outputDir || path.join(os.tmpdir(), "CodePush");
  const platform: string = (command.platform = command.platform.toLowerCase());
  const releaseCommand: cli.IReleaseCommand = <any>command;
  // Check for app and deployment exist before releasing an update.
  // This validation helps to save about 1 minute or more in case user has typed wrong app or deployment name.
  return (
    runtime.sdk
      .getDeployment(command.appName, command.deploymentName)
      .then((): any => {
        releaseCommand.package = outputFolder;

        switch (platform) {
          case "android":
          case "ios":
          case "windows":
            if (!bundleName) {
              bundleName = platform === "ios" ? "main.jsbundle" : `index.${platform}.bundle`;
            }

            break;
          default:
            throw new Error('Platform must be either "android", "ios" or "windows".');
        }

        let projectName: string;

        try {
          const projectPackageJson: any = require(path.join(process.cwd(), "package.json"));
          projectName = projectPackageJson.name;
          if (!projectName) {
            throw new Error('The "package.json" file in the CWD does not have the "name" field set.');
          }

          if (!projectPackageJson.dependencies["react-native"]) {
            throw new Error("The project in the CWD is not a React Native project.");
          }
        } catch (error) {
          throw new Error(
            'Unable to find or read "package.json" in the CWD. The "release-react" command must be executed in a React Native project folder.'
          );
        }

        if (!entryFile) {
          entryFile = `index.${platform}.js`;
          if (fileDoesNotExistOrIsDirectory(entryFile)) {
            entryFile = "index.js";
          }

          if (fileDoesNotExistOrIsDirectory(entryFile)) {
            throw new Error(`Entry file "index.${platform}.js" or "index.js" does not exist.`);
          }
        } else {
          if (fileDoesNotExistOrIsDirectory(entryFile)) {
            throw new Error(`Entry file "${entryFile}" does not exist.`);
          }
        }

        const appVersionPromise: Promise<string> = command.appStoreVersion
          ? Promise.resolve(command.appStoreVersion)
          : getReactNativeProjectAppVersion(command, projectName);

        if (command.sourcemapOutput && !command.sourcemapOutput.endsWith(".map")) {
          command.sourcemapOutput = path.join(command.sourcemapOutput, bundleName + ".map");
        }

        return appVersionPromise;
      })
      .then((appVersion: string) => {
        throwForInvalidSemverRange(appVersion);
        releaseCommand.appStoreVersion = appVersion;

        return runtime.createEmptyTempReleaseFolder(outputFolder);
      })
      // This is needed to clear the react native bundler cache:
      // https://github.com/facebook/react-native/issues/4289
      .then(() => deleteFolder(`${os.tmpdir()}/react-*`))
      .then(() =>
        runReactNativeBundleCommand(
          bundleName,
          command.development || false,
          entryFile,
          outputFolder,
          platform,
          command.sourcemapOutput,
          command.extraBundlerOptions
        )
      )
      .then(async () => {
        const isHermesEnabled =
          command.useHermes ||
          (platform === "android" && (await getAndroidHermesEnabled(command.gradleFile))) || // Check if we have to run hermes to compile JS to Byte Code if Hermes is enabled in build.gradle and we're releasing an Android build
          (platform === "ios" && (await getiOSHermesEnabled(command.podFile))); // Check if we have to run hermes to compile JS to Byte Code if Hermes is enabled in Podfile and we're releasing an iOS build

        if (isHermesEnabled) {
          runtime.log(chalk.cyan("\nRunning hermes compiler...\n"));
          await runHermesEmitBinaryCommand(
            bundleName,
            outputFolder,
            command.sourcemapOutput,
            command.extraHermesFlags,
            command.gradleFile
          );
        }
      })
      .then(async () => {
        if (command.privateKeyPath) {
          runtime.log(chalk.cyan("\nSigning the bundle:\n"));
          await sign(command.privateKeyPath, outputFolder);
        }
      })
      .then(() => {
        runtime.log(chalk.cyan("\nReleasing update contents to CodePush:\n"));
        return runtime.release(releaseCommand);
      })
      .then(() => {
        if (!command.outputDir) {
          deleteFolder(outputFolder);
        }
      })
      .catch((err: Error) => {
        deleteFolder(outputFolder);
        throw err;
      })
  );
};

function rollback(command: cli.IRollbackCommand): Promise<void> {
  return runtime.confirm().then((wasConfirmed: boolean) => {
    if (!wasConfirmed) {
      runtime.log("Rollback cancelled.");
      return;
    }

    return runtime.sdk.rollback(command.appName, command.deploymentName, command.targetRelease || undefined).then((): void => {
      runtime.log(
        'Successfully performed a rollback on the "' + command.deploymentName + '" deployment of the "' + command.appName + '" app.'
      );
    });
  });
}

async function requestAccessKey(): Promise<string | null> {
  try {
    const response = await inputPrompt({
      message: chalk.cyan("Enter your access key: "),
    });
    return response.trim();
  } catch {
    return null;
  }
}

export const runReactNativeBundleCommand = (
  bundleName: string,
  development: boolean,
  entryFile: string,
  outputFolder: string,
  platform: string,
  sourcemapOutput: string,
  extraBundlerOptions: string[] = []
): Promise<void> => {
  const reactNativeBundleArgs: string[] = [];
  const envNodeArgs: string = process.env.CODE_PUSH_NODE_ARGS;

  if (typeof envNodeArgs !== "undefined") {
    Array.prototype.push.apply(reactNativeBundleArgs, envNodeArgs.trim().split(/\s+/));
  }

  const isOldCLI = fs.existsSync(path.join("node_modules", "react-native", "local-cli", "cli.js"));

  Array.prototype.push.apply(reactNativeBundleArgs, [
    isOldCLI ? path.join("node_modules", "react-native", "local-cli", "cli.js") : path.join("node_modules", "react-native", "cli.js"),
    "bundle",
    "--assets-dest",
    outputFolder,
    "--bundle-output",
    path.join(outputFolder, bundleName),
    "--dev",
    development,
    "--entry-file",
    entryFile,
    "--platform",
    platform,
  ]);

  if (sourcemapOutput) {
    reactNativeBundleArgs.push("--sourcemap-output", sourcemapOutput);
  }

  if (extraBundlerOptions.length > 0) {
    reactNativeBundleArgs.push(...extraBundlerOptions);
  }

  runtime.log(chalk.cyan('Running "react-native bundle" command:\n'));
  const reactNativeBundleProcess = runtime.spawn("node", reactNativeBundleArgs);
  runtime.log(`node ${reactNativeBundleArgs.join(" ")}`);

  return new Promise<void>((resolve, reject) => {
    reactNativeBundleProcess.stdout.on("data", (data: Buffer) => {
      runtime.log(data.toString().trim());
    });

    reactNativeBundleProcess.stderr.on("data", (data: Buffer) => {
      console.error(data.toString().trim());
    });

    reactNativeBundleProcess.on("close", (exitCode: number) => {
      if (exitCode) {
        reject(new Error(`"react-native bundle" command exited with code ${exitCode}.`));
      }

      resolve(<void>null);
    });
  });
};

function serializeConnectionInfo(accessKey: string, preserveAccessKeyOnLogout: boolean, customServerUrl?: string): void {
  const connectionInfo: ILoginConnectionInfo = {
    accessKey: accessKey,
    preserveAccessKeyOnLogout: preserveAccessKeyOnLogout,
  };
  if (customServerUrl) {
    connectionInfo.customServerUrl = customServerUrl;
  }

  const json: string = JSON.stringify(connectionInfo);
  fs.writeFileSync(configFilePath, json, { encoding: "utf8" });

  runtime.log(
    `\r\nSuccessfully logged-in. Your session file was written to ${chalk.cyan(configFilePath)}. You can run the ${chalk.cyan(
      "code-push logout"
    )} command at any time to delete this file and terminate your session.\r\n`
  );
}

function sessionList(command: cli.ISessionListCommand): Promise<void> {
  throwForInvalidOutputFormat(command.format);

  return runtime.sdk.getSessions().then((sessions: Session[]): void => {
    printSessions(command.format, sessions);
  });
}

function sessionRemove(command: cli.ISessionRemoveCommand): Promise<void> {
  if (os.hostname() === command.machineName) {
    throw new Error("Cannot remove the current login session via this command. Please run 'srcpush logout' instead.");
  } else {
    return runtime.confirm().then((wasConfirmed: boolean): Promise<void> => {
      if (wasConfirmed) {
        return runtime.sdk.removeSession(command.machineName).then((): void => {
          runtime.log(`Successfully removed the login session for "${command.machineName}".`);
        });
      }

      runtime.log("Session removal cancelled.");
    });
  }
}

function releaseErrorHandler(error: CodePushError, command: cli.ICommand): void {
  if ((<any>command).noDuplicateReleaseError && error.statusCode === AccountManager.ERROR_CONFLICT) {
    console.warn(chalk.yellow("[Warning] " + error.message));
  } else {
    throw error;
  }
}

function throwForInvalidEmail(email: string): void {
  if (!emailValidator.validate(email)) {
    throw new Error('"' + email + '" is an invalid e-mail address.');
  }
}

function throwForInvalidSemverRange(semverRange: string): void {
  if (semver.validRange(semverRange) === null) {
    throw new Error('Please use a semver-compliant target binary version range, for example "1.0.0", "*" or "^1.2.3".');
  }
}

function throwForInvalidOutputFormat(format: string): void {
  switch (format) {
    case "json":
    case "table":
      break;

    default:
      throw new Error("Invalid format:  " + format + ".");
  }
}

function whoami(command: cli.ICommand): Promise<void> {
  return runtime.sdk.getAccountInfo().then((account): void => {
    const accountInfo = `${account.email} (${account.linkedProviders.join(", ")})`;

    runtime.log(accountInfo);
  });
}

function isCommandOptionSpecified(option: any): boolean {
  return option !== undefined && option !== null;
}

function getSdk(accessKey: string, headers: Headers, customServerUrl: string): AccountManager {
  const sdk: any = new AccountManager(accessKey, CLI_HEADERS, customServerUrl);
  Object.getOwnPropertyNames(AccountManager.prototype).forEach((functionName: any) => {
    if (typeof sdk[functionName] === "function") {
      const originalFunction = sdk[functionName];
      sdk[functionName] = function () {
        let maybePromise: Promise<any> = originalFunction.apply(sdk, arguments);
        if (maybePromise && maybePromise.then !== undefined) {
          maybePromise = maybePromise.catch((error: any) => {
            if (error.statusCode && error.statusCode === AccountManager.ERROR_UNAUTHORIZED) {
              deleteConnectionInfoCache(false);
            }

            throw error;
          });
        }

        return maybePromise;
      };
    }
  });

  return runtime.sdk;
}
