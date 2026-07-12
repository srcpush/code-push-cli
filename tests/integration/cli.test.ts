
import { describe, it, beforeEach, afterEach, expect } from "vitest";
import * as sinon from "sinon";

import * as path from "path";
import * as codePush from "@/types";
import * as cli from "@/types/cli";
import * as cmdexec from "@/commands/executor";
const { runtime } = cmdexec;
import * as os from "os";

function assertJsonDescribesObject(json: string, object: object): void {
  expect(json).toBe(JSON.stringify(object, null, 2));
}

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function ensureInTestAppDirectory(): void {
  process.chdir(path.join(__dirname, "../fixtures/resources/TestApp"));
}

function isDefined(object: any): boolean {
  return object !== undefined && object !== null;
}

const NOW = 1471460856191;
const DEFAULT_ACCESS_KEY_MAX_AGE = 1000 * 60 * 60 * 24 * 60; // 60 days
const TEST_MACHINE_NAME = "Test machine";

export class SdkStub {
  private productionDeployment: codePush.Deployment = {
    name: "Production",
    key: "6",
  };
  private stagingDeployment: codePush.Deployment = {
    name: "Staging",
    key: "6",
    package: {
      appVersion: "1.0.0",
      description: "fgh",
      label: "v2",
      packageHash: "jkl",
      isMandatory: true,
      size: 10,
      blobUrl: "http://mno.pqr",
      uploadTime: 1000,
    },
  };

  public getAccountInfo(): Promise<codePush.Account> {
    return Promise.resolve(<codePush.Account>{
      email: "a@a.com",
    });
  }

  public addAccessKey(name: string, ttl: number): Promise<codePush.AccessKey> {
    return Promise.resolve(<codePush.AccessKey>{
      key: "key123",
      createdTime: new Date().getTime(),
      name,
      expires: NOW + (isDefined(ttl) ? ttl : DEFAULT_ACCESS_KEY_MAX_AGE),
    });
  }

  public patchAccessKey(oldName: string, newName?: string, newTtl?: number): Promise<codePush.AccessKey> {
    return Promise.resolve(<codePush.AccessKey>{
      createdTime: new Date().getTime(),
      name: newName ?? oldName,
      expires: NOW + (isDefined(newTtl) ? newTtl : DEFAULT_ACCESS_KEY_MAX_AGE),
    });
  }

  public addApp(name: string): Promise<codePush.App> {
    return Promise.resolve(<codePush.App>{
      name: name,
    });
  }

  public addCollaborator(): Promise<void> {
    return Promise.resolve(<void>null);
  }

  public addDeployment(deploymentName: string): Promise<codePush.Deployment> {
    return Promise.resolve(<codePush.Deployment>{
      name: deploymentName,
      key: "6",
    });
  }

  public clearDeploymentHistory(): Promise<void> {
    return Promise.resolve(<void>null);
  }

  public getAccessKeys(): Promise<codePush.AccessKey[]> {
    return Promise.resolve([
      <codePush.AccessKey>{
        createdTime: 0,
        name: "Test name",
        expires: NOW + DEFAULT_ACCESS_KEY_MAX_AGE,
      },
    ]);
  }

  public getSessions(): Promise<codePush.Session[]> {
    return Promise.resolve([
      <codePush.Session>{
        loggedInTime: 0,
        machineName: TEST_MACHINE_NAME,
      },
    ]);
  }

  public getApps(): Promise<codePush.App[]> {
    return Promise.resolve([
      <codePush.App>{
        name: "a",
        collaborators: {
          "a@a.com": { permission: "Owner", isCurrentAccount: true },
        },
        deployments: ["Production", "Staging"],
      },
      <codePush.App>{
        name: "b",
        collaborators: {
          "a@a.com": { permission: "Owner", isCurrentAccount: true },
        },
        deployments: ["Production", "Staging"],
      },
    ]);
  }

  public getDeployments(appName: string): Promise<codePush.Deployment[]> {
    if (appName === "a") {
      return Promise.resolve([this.productionDeployment, this.stagingDeployment]);
    }

    return Promise.reject<codePush.Deployment[]>();
  }

  public getDeployment(appName: string, deploymentName: string): Promise<codePush.Deployment> {
    if (appName === "a") {
      if (deploymentName === "Production") {
        return Promise.resolve(this.productionDeployment);
      } else if (deploymentName === "Staging") {
        return Promise.resolve(this.stagingDeployment);
      }
    }

    return Promise.reject<codePush.Deployment>();
  }

  public getDeploymentHistory(): Promise<codePush.Package[]> {
    return Promise.resolve([
      <codePush.Package>{
        description: null,
        appVersion: "1.0.0",
        isMandatory: false,
        packageHash: "463acc7d06adc9c46233481d87d9e8264b3e9ffe60fe98d721e6974209dc71a0",
        blobUrl: "https://fakeblobstorage.net/storagev2/blobid1",
        uploadTime: 1447113596270,
        size: 1,
        label: "v1",
      },
      <codePush.Package>{
        description: "New update - this update does a whole bunch of things, including testing linewrapping",
        appVersion: "1.0.1",
        isMandatory: false,
        packageHash: "463acc7d06adc9c46233481d87d9e8264b3e9ffe60fe98d721e6974209dc71a0",
        blobUrl: "https://fakeblobstorage.net/storagev2/blobid2",
        uploadTime: 1447118476669,
        size: 2,
        label: "v2",
      },
    ]);
  }

  public getDeploymentMetrics(): Promise<any> {
    return Promise.resolve({
      "1.0.0": {
        active: 123,
      },
      v1: {
        active: 789,
        downloaded: 456,
        failed: 654,
        installed: 987,
      },
      v2: {
        active: 123,
        downloaded: 321,
        failed: 789,
        installed: 456,
      },
    });
  }

  public getCollaborators(): Promise<any> {
    return Promise.resolve({
      "a@a.com": {
        permission: "Owner",
        isCurrentAccount: true,
      },
      "b@b.com": {
        permission: "Collaborator",
        isCurrentAccount: false,
      },
    });
  }

  public patchRelease(): Promise<void> {
    return Promise.resolve(<void>null);
  }

  public promote(): Promise<void> {
    return Promise.resolve(<void>null);
  }

  public release(): Promise<string> {
    return Promise.resolve("Successfully released");
  }

  public removeAccessKey(): Promise<void> {
    return Promise.resolve(<void>null);
  }

  public removeApp(): Promise<void> {
    return Promise.resolve(<void>null);
  }

  public removeCollaborator(): Promise<void> {
    return Promise.resolve(<void>null);
  }

  public removeDeployment(): Promise<void> {
    return Promise.resolve(<void>null);
  }

  public removeSession(): Promise<void> {
    return Promise.resolve(<void>null);
  }

  public renameApp(): Promise<void> {
    return Promise.resolve(<void>null);
  }

  public rollback(): Promise<void> {
    return Promise.resolve(<void>null);
  }

  public transferApp(): Promise<void> {
    return Promise.resolve(<void>null);
  }

  public renameDeployment(): Promise<void> {
    return Promise.resolve(<void>null);
  }
}

describe("CLI", () => {
  var log: sinon.SinonStub;
  var sandbox: sinon.SinonSandbox;
  var spawn: sinon.SinonStub;
  var wasConfirmed = true;
  const INVALID_RELEASE_FILE_ERROR_MESSAGE: string =
    "It is unnecessary to package releases in a .zip or binary file. Please specify the direct path to the update content's directory (e.g. /platforms/ios/www) or file (e.g. main.jsbundle).";

  beforeEach((): void => {
    wasConfirmed = true;
    cmdexec.runtime.sdk = new SdkStub() as any;

    sandbox = sinon.createSandbox();

    sandbox.stub(runtime, "confirm").callsFake(async () => wasConfirmed);

    sandbox.stub(runtime, "createEmptyTempReleaseFolder").callsFake(() => Promise.resolve());
    log = sandbox.stub(runtime, "log").callsFake(() => {});
    spawn = sandbox.stub(runtime, "spawn").callsFake(() => {
      return {
        stdout: { on: () => {} },
        stderr: { on: () => {} },
        on: (event: string, callback: () => void) => {
          callback();
        },
      };
    });
  });

  afterEach((): void => {
    cmdexec.runtime.sdk = undefined as any;
    sandbox.restore();
  });

  it("accessKeyAdd creates access key with name and default ttl", async () => {
    var command: cli.IAccessKeyAddCommand = {
      type: cli.CommandType.accessKeyAdd,
      name: "Test name",
    };

    await cmdexec.execute(command);

      sinon.assert.calledTwice(log);
      expect(log.args[0].length).toBe(1);

      var actual: string = log.args[0][0];
      var expected = `Successfully created the "Test name" access key: key123`;
      expect(actual).toBe(expected);

      actual = log.args[1][0];
      expected = "Make sure to save this key value somewhere safe, since you won't be able to view it from the CLI again!";
      expect(actual).toBe(expected);
  });

  it("accessKeyAdd creates access key with name and specified ttl", async () => {
    var ttl = 10000;
    var command: cli.IAccessKeyAddCommand = {
      type: cli.CommandType.accessKeyAdd,
      name: "Test name",
      ttl,
    };

    await cmdexec.execute(command);

      sinon.assert.calledTwice(log);
      expect(log.args[0].length).toBe(1);

      var actual: string = log.args[0][0];
      var expected = `Successfully created the "Test name" access key: key123`;
      expect(actual).toBe(expected);

      actual = log.args[1][0];
      expected = "Make sure to save this key value somewhere safe, since you won't be able to view it from the CLI again!";
      expect(actual).toBe(expected);
  });

  it("accessKeyPatch updates access key with new name", async () => {
    var command: cli.IAccessKeyPatchCommand = {
      type: cli.CommandType.accessKeyPatch,
      oldName: "Test name",
      newName: "Updated name",
    };

    await cmdexec.execute(command);

      sinon.assert.calledOnce(log);
      expect(log.args[0].length).toBe(1);

      var actual: string = log.args[0][0];
      var expected = `Successfully renamed the access key "Test name" to "Updated name".`;

      expect(actual).toBe(expected);
  });

  it("accessKeyPatch updates access key with new ttl", async () => {
    var ttl = 10000;
    var command: cli.IAccessKeyPatchCommand = {
      type: cli.CommandType.accessKeyPatch,
      oldName: "Test name",
      ttl,
    };

    await cmdexec.execute(command);

      sinon.assert.calledOnce(log);
      expect(log.args[0].length).toBe(1);

      var actual: string = log.args[0][0];
      expect(actual).toMatch(/Successfully changed the expiration date of the "Test name" access key to /);
  });

  it("accessKeyPatch updates access key with new name and ttl", async () => {
    var ttl = 10000;
    var command: cli.IAccessKeyPatchCommand = {
      type: cli.CommandType.accessKeyPatch,
      oldName: "Test name",
      newName: "Updated name",
      ttl,
    };

    await cmdexec.execute(command);

      sinon.assert.calledOnce(log);
      expect(log.args[0].length).toBe(1);

      var actual: string = log.args[0][0];
      expect(actual).toMatch(/Successfully renamed the access key "Test name" to "Updated name" and changed its expiration date to /);
  });

  it("accessKeyList lists access key name and expires fields", async () => {
    var command: cli.IAccessKeyListCommand = {
      type: cli.CommandType.accessKeyList,
      format: "json",
    };

    await cmdexec.execute(command);

      sinon.assert.calledOnce(log);
      expect(log.args[0].length).toBe(1);

      var actual: string = log.args[0][0];
      var expected = [
        {
          createdTime: 0,
          name: "Test name",
          expires: NOW + DEFAULT_ACCESS_KEY_MAX_AGE,
        },
      ];

      assertJsonDescribesObject(actual, expected);
  });

  it("accessKeyRemove removes access key", async () => {
    var command: cli.IAccessKeyRemoveCommand = {
      type: cli.CommandType.accessKeyRemove,
      accessKey: "8",
    };

    var removeAccessKey: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "removeAccessKey");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(removeAccessKey);
      sinon.assert.calledWithExactly(removeAccessKey, "8");
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, 'Successfully removed the "8" access key.');
  });

  it("accessKeyRemove does not remove access key if cancelled", async () => {
    var command: cli.IAccessKeyRemoveCommand = {
      type: cli.CommandType.accessKeyRemove,
      accessKey: "8",
    };

    var removeAccessKey: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "removeAccessKey");

    wasConfirmed = false;

    await cmdexec.execute(command);

      sinon.assert.notCalled(removeAccessKey);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, "Access key removal cancelled.");
  });

  it("appAdd reports new app name and ID", async () => {
    var command: cli.IAppAddCommand = {
      type: cli.CommandType.appAdd,
      appName: "a",
      os: "",
      platform: "",
    };

    var addApp: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "addApp");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(addApp);
      sinon.assert.calledTwice(log);
      sinon.assert.calledWithExactly(log, 'Successfully added the "a" app, along with the following default deployments:');
  });

  it("appList lists app names and ID's", async () => {
    var command: cli.IAppListCommand = {
      type: cli.CommandType.appList,
      format: "json",
    };

    await cmdexec.execute(command);

      sinon.assert.calledOnce(log);
      expect(log.args[0].length).toBe(1);

      var actual: string = log.args[0][0];
      var expected = [
        {
          name: "a",
          collaborators: {
            "a@a.com": {
              permission: "Owner",
              isCurrentAccount: true,
            },
          },
          deployments: ["Production", "Staging"],
        },
        {
          name: "b",
          collaborators: {
            "a@a.com": {
              permission: "Owner",
              isCurrentAccount: true,
            },
          },
          deployments: ["Production", "Staging"],
        },
      ];

      assertJsonDescribesObject(actual, expected);
  });

  it("appRemove removes app", async () => {
    var command: cli.IAppRemoveCommand = {
      type: cli.CommandType.appRemove,
      appName: "a",
    };

    var removeApp: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "removeApp");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(removeApp);
      sinon.assert.calledWithExactly(removeApp, "a");
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, 'Successfully removed the "a" app.');
  });

  it("appRemove does not remove app if cancelled", async () => {
    var command: cli.IAppRemoveCommand = {
      type: cli.CommandType.appRemove,
      appName: "a",
    };

    var removeApp: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "removeApp");

    wasConfirmed = false;

    await cmdexec.execute(command);

      sinon.assert.notCalled(removeApp);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, "App removal cancelled.");
  });

  it("appRename renames app", async () => {
    var command: cli.IAppRenameCommand = {
      type: cli.CommandType.appRename,
      currentAppName: "a",
      newAppName: "c",
    };

    var renameApp: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "renameApp");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(renameApp);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, 'Successfully renamed the "a" app to "c".');
  });

  it("appTransfer transfers app", async () => {
    var command: cli.IAppTransferCommand = {
      type: cli.CommandType.appTransfer,
      appName: "a",
      email: "b@b.com",
    };

    var transferApp: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "transferApp");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(transferApp);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, 'Successfully transferred the ownership of app "a" to the account with email "b@b.com".');
  });

  it("collaboratorAdd adds collaborator", async () => {
    var command: cli.ICollaboratorAddCommand = {
      type: cli.CommandType.collaboratorAdd,
      appName: "a",
      email: "b@b.com",
    };

    var addCollaborator: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "addCollaborator");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(addCollaborator);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, 'Successfully added "b@b.com" as a collaborator to the app "a".');
  });

  it("collaboratorList lists collaborators email and properties", async () => {
    var command: cli.ICollaboratorListCommand = {
      type: cli.CommandType.collaboratorList,
      appName: "a",
      format: "json",
    };

    await cmdexec.execute(command);

      sinon.assert.calledOnce(log);
      expect(log.args[0].length).toBe(1);

      var actual: string = log.args[0][0];
      var expected = {
        collaborators: {
          "a@a.com": { permission: "Owner", isCurrentAccount: true },
          "b@b.com": { permission: "Collaborator", isCurrentAccount: false },
        },
      };

      assertJsonDescribesObject(actual, expected);
  });

  it("collaboratorRemove removes collaborator", async () => {
    var command: cli.ICollaboratorRemoveCommand = {
      type: cli.CommandType.collaboratorRemove,
      appName: "a",
      email: "b@b.com",
    };

    var removeCollaborator: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "removeCollaborator");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(removeCollaborator);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, 'Successfully removed "b@b.com" as a collaborator from the app "a".');
  });

  it("deploymentAdd reports new app name and ID", async () => {
    var command: cli.IDeploymentAddCommand = {
      type: cli.CommandType.deploymentAdd,
      appName: "a",
      deploymentName: "b",
      default: false,
    };

    var addDeployment: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "addDeployment");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(addDeployment);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, 'Successfully added the "b" deployment with key "6" to the "a" app.');
  });

  it("deploymentHistoryClear clears deployment", async () => {
    var command: cli.IDeploymentHistoryClearCommand = {
      type: cli.CommandType.deploymentHistoryClear,
      appName: "a",
      deploymentName: "Staging",
    };

    var clearDeployment: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "clearDeploymentHistory");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(clearDeployment);
      sinon.assert.calledWithExactly(clearDeployment, "a", "Staging");
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(
        log,
        'Successfully cleared the release history associated with the "Staging" deployment from the "a" app.'
      );
  });

  it("deploymentHistoryClear does not clear deployment if cancelled", async () => {
    var command: cli.IDeploymentHistoryClearCommand = {
      type: cli.CommandType.deploymentHistoryClear,
      appName: "a",
      deploymentName: "Staging",
    };

    var clearDeployment: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "clearDeploymentHistory");

    wasConfirmed = false;

    await cmdexec.execute(command);

      sinon.assert.notCalled(clearDeployment);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, "Clear deployment cancelled.");
  });

  it("deploymentList lists deployment names, deployment keys, and package information", async () => {
    var command: cli.IDeploymentListCommand = {
      type: cli.CommandType.deploymentList,
      appName: "a",
      format: "json",
      displayKeys: true,
    };

    await cmdexec.execute(command);

      sinon.assert.calledOnce(log);
      expect(log.args[0].length).toBe(1);

      var actual: string = log.args[0][0];
      var expected = [
        {
          name: "Production",
          key: "6",
        },
        {
          name: "Staging",
          key: "6",
          package: {
            appVersion: "1.0.0",
            description: "fgh",
            label: "v2",
            packageHash: "jkl",
            isMandatory: true,
            size: 10,
            blobUrl: "http://mno.pqr",
            uploadTime: 1000,
            metrics: {
              active: 123,
              downloaded: 321,
              failed: 789,
              installed: 456,
              totalActive: 1035,
            },
          },
        },
      ];

      assertJsonDescribesObject(actual, expected);
  });

  it("deploymentRemove removes deployment", async () => {
    var command: cli.IDeploymentRemoveCommand = {
      type: cli.CommandType.deploymentRemove,
      appName: "a",
      deploymentName: "Staging",
    };

    var removeDeployment: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "removeDeployment");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(removeDeployment);
      sinon.assert.calledWithExactly(removeDeployment, "a", "Staging");
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, 'Successfully removed the "Staging" deployment from the "a" app.');
  });

  it("deploymentRemove does not remove deployment if cancelled", async () => {
    var command: cli.IDeploymentRemoveCommand = {
      type: cli.CommandType.deploymentRemove,
      appName: "a",
      deploymentName: "Staging",
    };

    var removeDeployment: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "removeDeployment");

    wasConfirmed = false;

    await cmdexec.execute(command);

      sinon.assert.notCalled(removeDeployment);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, "Deployment removal cancelled.");
  });

  it("deploymentRename renames deployment", async () => {
    var command: cli.IDeploymentRenameCommand = {
      type: cli.CommandType.deploymentRename,
      appName: "a",
      currentDeploymentName: "Staging",
      newDeploymentName: "c",
    };

    var renameDeployment: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "renameDeployment");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(renameDeployment);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, 'Successfully renamed the "Staging" deployment to "c" for the "a" app.');
  });

  it("deploymentHistory lists package history information", async () => {
    var command: cli.IDeploymentHistoryCommand = {
      type: cli.CommandType.deploymentHistory,
      appName: "a",
      deploymentName: "Staging",
      format: "json",
      displayAuthor: false,
    };

    var getDeploymentHistory: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "getDeploymentHistory");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(getDeploymentHistory);
      sinon.assert.calledOnce(log);
      expect(log.args[0].length).toBe(1);

      var actual: string = log.args[0][0];
      const parsed = JSON.parse(actual);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].label).toBe("v1");
      expect(parsed[1].label).toBe("v2");
  });

  it("patch command successfully updates specific label", async () => {
    var command: cli.IPatchCommand = {
      type: cli.CommandType.patch,
      appName: "a",
      deploymentName: "Staging",
      label: "v1",
      disabled: false,
      description: "Patched",
      mandatory: true,
      rollout: 25,
      appStoreVersion: "1.0.1",
    };

    var patch: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "patchRelease");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(patch);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, `Successfully updated the "v1" release of "a" app's "Staging" deployment.`);
  });

  it("patch command successfully updates latest release", async () => {
    var command: cli.IPatchCommand = {
      type: cli.CommandType.patch,
      appName: "a",
      deploymentName: "Staging",
      label: null,
      disabled: false,
      description: "Patched",
      mandatory: true,
      rollout: 25,
      appStoreVersion: "1.0.1",
    };

    var patch: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "patchRelease");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(patch);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, `Successfully updated the "latest" release of "a" app's "Staging" deployment.`);
  });

  it("patch command successfully updates without appStoreVersion", async () => {
    var command: cli.IPatchCommand = {
      type: cli.CommandType.patch,
      appName: "a",
      deploymentName: "Staging",
      label: null,
      disabled: false,
      description: "Patched",
      mandatory: true,
      rollout: 25,
      appStoreVersion: null,
    };

    var patch: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "patchRelease");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(patch);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, `Successfully updated the "latest" release of "a" app's "Staging" deployment.`);
  });

  it("patch command fails if no properties were specified for update", async () => {
    var command: cli.IPatchCommand = {
      type: cli.CommandType.patch,
      appName: "a",
      deploymentName: "Staging",
      label: null,
      disabled: null,
      description: null,
      mandatory: null,
      rollout: null,
      appStoreVersion: null,
    };

    var patch: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "patchRelease");

    await expect(cmdexec.execute(command)).rejects.toMatchObject({ message: "At least one property must be specified to patch a release." })
        sinon.assert.notCalled(patch);
      
  });

  it("promote works successfully", async () => {
    var command: cli.IPromoteCommand = {
      type: cli.CommandType.promote,
      appName: "a",
      sourceDeploymentName: "Staging",
      destDeploymentName: "Production",
      description: "Promoted",
      mandatory: true,
      rollout: 25,
      appStoreVersion: "1.0.1",
    };

    var promote: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "promote");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(promote);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(
        log,
        `Successfully promoted the "Staging" deployment of the "a" app to the "Production" deployment.`
      );
  });

  it("promote works successfully without appStoreVersion", async () => {
    var command: cli.IPromoteCommand = {
      type: cli.CommandType.promote,
      appName: "a",
      sourceDeploymentName: "Staging",
      destDeploymentName: "Production",
      description: "Promoted",
      mandatory: true,
      rollout: 25,
      appStoreVersion: null,
    };

    var promote: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "promote");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(promote);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(
        log,
        `Successfully promoted the "Staging" deployment of the "a" app to the "Production" deployment.`
      );
  });

  it("rollback works successfully", async () => {
    var command: cli.IRollbackCommand = {
      type: cli.CommandType.rollback,
      appName: "a",
      deploymentName: "Staging",
      targetRelease: "v2",
    };

    var rollback: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "rollback");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(rollback);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, `Successfully performed a rollback on the "Staging" deployment of the "a" app.`);
  });

  it("release doesn't allow non valid semver ranges", async () => {
    var command: cli.IReleaseCommand = {
      type: cli.CommandType.release,
      appName: "a",
      deploymentName: "Staging",
      description: "test releasing zip file",
      mandatory: false,
      rollout: null,
      appStoreVersion: "not semver",
      package: "./resources",
    };

    await releaseHelperFunction(
      command,
      'Please use a semver-compliant target binary version range, for example "1.0.0", "*" or "^1.2.3".'
    );
  });

  it("release doesn't allow releasing .zip file", async () => {
    var command: cli.IReleaseCommand = {
      type: cli.CommandType.release,
      appName: "a",
      deploymentName: "Staging",
      description: "test releasing zip file",
      mandatory: false,
      rollout: null,
      appStoreVersion: "1.0.0",
      package: "/fake/path/test/file.zip",
    };

    await releaseHelperFunction(command, INVALID_RELEASE_FILE_ERROR_MESSAGE);
  });

  it("release doesn't allow releasing .ipa file", async () => {
    var command: cli.IReleaseCommand = {
      type: cli.CommandType.release,
      appName: "a",
      deploymentName: "Staging",
      description: "test releasing ipa file",
      mandatory: false,
      rollout: null,
      appStoreVersion: "1.0.0",
      package: "/fake/path/test/file.ipa",
    };

    await releaseHelperFunction(command, INVALID_RELEASE_FILE_ERROR_MESSAGE);
  });

  it("release doesn't allow releasing .apk file", async () => {
    var command: cli.IReleaseCommand = {
      type: cli.CommandType.release,
      appName: "a",
      deploymentName: "Staging",
      description: "test releasing apk file",
      mandatory: false,
      rollout: null,
      appStoreVersion: "1.0.0",
      package: "/fake/path/test/file.apk",
    };

    await releaseHelperFunction(command, INVALID_RELEASE_FILE_ERROR_MESSAGE);
  });

  it("release-react fails if CWD does not contain package.json", async () => {
    var command: cli.IReleaseReactCommand = {
      type: cli.CommandType.releaseReact,
      appName: "a",
      appStoreVersion: null,
      deploymentName: "Staging",
      description: "Test invalid folder",
      mandatory: false,
      rollout: null,
      platform: "ios",
    };

    await expect(cmdexec.execute(command)).rejects.toMatchObject({
      message:
        'Unable to find or read "package.json" in the CWD. The "release-react" command must be executed in a React Native project folder.',
    });
  });

  it("release-react fails if entryFile does not exist", async () => {
    var command: cli.IReleaseReactCommand = {
      type: cli.CommandType.releaseReact,
      appName: "a",
      appStoreVersion: null,
      deploymentName: "Staging",
      description: "Test invalid entryFile",
      entryFile: "doesntexist.js",
      mandatory: false,
      rollout: null,
      platform: "ios",
    };

    ensureInTestAppDirectory();

    await expect(cmdexec.execute(command)).rejects.toMatchObject({
      message: 'Entry file "doesntexist.js" does not exist.',
    });
  });

  it("release-react fails if platform is invalid", async () => {
    var command: cli.IReleaseReactCommand = {
      type: cli.CommandType.releaseReact,
      appName: "a",
      appStoreVersion: null,
      deploymentName: "Staging",
      description: "Test invalid platform",
      mandatory: false,
      rollout: null,
      platform: "blackberry",
    };

    ensureInTestAppDirectory();

    await expect(cmdexec.execute(command)).rejects.toMatchObject({
      message: 'Platform must be either "android", "ios" or "windows".',
    });
  });

  it("release-react fails if targetBinaryRange is not a valid semver range expression", async () => {
    var bundleName = "bundle.js";
    var command: cli.IReleaseReactCommand = {
      type: cli.CommandType.releaseReact,
      appName: "a",
      appStoreVersion: "notsemver",
      bundleName: bundleName,
      deploymentName: "Staging",
      description: "Test uses targetBinaryRange",
      mandatory: false,
      rollout: null,
      platform: "android",
      sourcemapOutput: "index.android.js.map",
    };

    ensureInTestAppDirectory();

    var release: sinon.SinonSpy = sandbox.stub(runtime, "release");

    await expect(cmdexec.execute(command)).rejects.toMatchObject({
      message: 'Please use a semver-compliant target binary version range, for example "1.0.0", "*" or "^1.2.3".',
    });
    sinon.assert.notCalled(release);
    sinon.assert.notCalled(spawn);
  });

  it("release-react defaults entry file to index.{platform}.js if not provided", async () => {
    var bundleName = "bundle.js";
    var command: cli.IReleaseReactCommand = {
      type: cli.CommandType.releaseReact,
      appName: "a",
      appStoreVersion: null,
      bundleName: bundleName,
      deploymentName: "Staging",
      description: "Test default entry file",
      mandatory: false,
      rollout: null,
      platform: "ios",
    };

    ensureInTestAppDirectory();

    var release: sinon.SinonSpy = sandbox.stub(runtime, "release");

    await cmdexec.execute(command);

    var releaseCommand: cli.IReleaseCommand = <any>command;
    releaseCommand.package = path.join(os.tmpdir(), "CodePush");
    releaseCommand.appStoreVersion = "1.2.3";

    sinon.assert.calledOnce(spawn);
    var spawnCommand: string = spawn.args[0][0];
    var spawnCommandArgs: string = spawn.args[0][1].join(" ");
    expect(spawnCommand).toBe("node");
    expect(spawnCommandArgs).toBe(
      `${path.join("node_modules", "react-native", "local-cli", "cli.js")} bundle --assets-dest ${path.join(
        os.tmpdir(),
        "CodePush"
      )} --bundle-output ${path.join(os.tmpdir(), "CodePush", bundleName)} --dev false --entry-file index.ios.js --platform ios`
    );
    assertJsonDescribesObject(JSON.stringify(release.args[0][0], /*replacer=*/ null, /*spacing=*/ 2), releaseCommand);
  });

  it('release-react defaults bundle name to "main.jsbundle" if not provided and platform is "ios"', async () => {
    var command: cli.IReleaseReactCommand = {
      type: cli.CommandType.releaseReact,
      appName: "a",
      appStoreVersion: null,
      deploymentName: "Staging",
      description: "Test default entry file",
      mandatory: false,
      rollout: null,
      platform: "ios",
    };

    ensureInTestAppDirectory();

    var release: sinon.SinonSpy = sandbox.stub(runtime, "release");

    await cmdexec.execute(command);

    var releaseCommand: cli.IReleaseCommand = <any>clone(command);
    var packagePath: string = path.join(os.tmpdir(), "CodePush");
    releaseCommand.package = packagePath;
    releaseCommand.appStoreVersion = "1.2.3";

    sinon.assert.calledOnce(spawn);
    var spawnCommand: string = spawn.args[0][0];
    var spawnCommandArgs: string = spawn.args[0][1].join(" ");
    expect(spawnCommand).toBe("node");
    expect(spawnCommandArgs).toBe(
      `${path.join(
        "node_modules",
        "react-native",
        "local-cli",
        "cli.js"
      )} bundle --assets-dest ${packagePath} --bundle-output ${path.join(
        packagePath,
        "main.jsbundle"
      )} --dev false --entry-file index.ios.js --platform ios`
    );
    assertJsonDescribesObject(JSON.stringify(release.args[0][0], /*replacer=*/ null, /*spacing=*/ 2), releaseCommand);
  });

  it('release-react defaults bundle name to "index.android.bundle" if not provided and platform is "android"', async () => {
    var command: cli.IReleaseReactCommand = {
      type: cli.CommandType.releaseReact,
      appName: "a",
      appStoreVersion: null,
      deploymentName: "Staging",
      description: "Test default entry file",
      mandatory: false,
      rollout: null,
      platform: "android",
    };

    ensureInTestAppDirectory();

    var release: sinon.SinonSpy = sandbox.stub(runtime, "release");

    await cmdexec.execute(command);

    var releaseCommand: cli.IReleaseCommand = <any>clone(command);
    var packagePath: string = path.join(os.tmpdir(), "CodePush");
    releaseCommand.package = packagePath;
    releaseCommand.appStoreVersion = "1.0.0";

    sinon.assert.calledOnce(spawn);
    var spawnCommand: string = spawn.args[0][0];
    var spawnCommandArgs: string = spawn.args[0][1].join(" ");
    expect(spawnCommand).toBe("node");
    expect(spawnCommandArgs).toBe(
      `${path.join(
        "node_modules",
        "react-native",
        "local-cli",
        "cli.js"
      )} bundle --assets-dest ${packagePath} --bundle-output ${path.join(
        packagePath,
        "index.android.bundle"
      )} --dev false --entry-file index.android.js --platform android`
    );
    assertJsonDescribesObject(JSON.stringify(release.args[0][0], /*replacer=*/ null, /*spacing=*/ 2), releaseCommand);
  });

  it('release-react defaults bundle name to "index.windows.bundle" if not provided and platform is "windows"', async () => {
    var command: cli.IReleaseReactCommand = {
      type: cli.CommandType.releaseReact,
      appName: "a",
      appStoreVersion: null,
      deploymentName: "Staging",
      description: "Test default entry file",
      mandatory: false,
      rollout: null,
      platform: "windows",
    };

    ensureInTestAppDirectory();

    var release: sinon.SinonSpy = sandbox.stub(runtime, "release");

    await cmdexec.execute(command);

    var releaseCommand: cli.IReleaseCommand = <any>clone(command);
    var packagePath = path.join(os.tmpdir(), "CodePush");
    releaseCommand.package = packagePath;
    releaseCommand.appStoreVersion = "1.0.0";

    sinon.assert.calledOnce(spawn);
    var spawnCommand: string = spawn.args[0][0];
    var spawnCommandArgs: string = spawn.args[0][1].join(" ");
    expect(spawnCommand).toBe("node");
    expect(spawnCommandArgs).toBe(
      `${path.join(
        "node_modules",
        "react-native",
        "local-cli",
        "cli.js"
      )} bundle --assets-dest ${packagePath} --bundle-output ${path.join(
        packagePath,
        "index.windows.bundle"
      )} --dev false --entry-file index.windows.js --platform windows`
    );
    assertJsonDescribesObject(JSON.stringify(release.args[0][0], /*replacer=*/ null, /*spacing=*/ 2), releaseCommand);
  });

  it("release-react generates dev bundle", async () => {
    var bundleName = "bundle.js";
    var command: cli.IReleaseReactCommand = {
      type: cli.CommandType.releaseReact,
      appName: "a",
      appStoreVersion: null,
      bundleName: bundleName,
      deploymentName: "Staging",
      development: true,
      description: "Test generates dev bundle",
      mandatory: false,
      rollout: null,
      platform: "android",
      sourcemapOutput: "index.android.js.map",
    };

    ensureInTestAppDirectory();

    var release: sinon.SinonSpy = sandbox.stub(runtime, "release");

    await cmdexec.execute(command);

    var releaseCommand: cli.IReleaseCommand = <any>command;
    releaseCommand.package = path.join(os.tmpdir(), "CodePush");
    releaseCommand.appStoreVersion = "1.2.3";

    sinon.assert.calledOnce(spawn);
    var spawnCommand: string = spawn.args[0][0];
    var spawnCommandArgs: string = spawn.args[0][1].join(" ");
    expect(spawnCommand).toBe("node");
    expect(spawnCommandArgs).toBe(
      `${path.join("node_modules", "react-native", "local-cli", "cli.js")} bundle --assets-dest ${path.join(
        os.tmpdir(),
        "CodePush"
      )} --bundle-output ${path.join(
        os.tmpdir(),
        "CodePush",
        bundleName
      )} --dev true --entry-file index.android.js --platform android --sourcemap-output index.android.js.map`
    );
    assertJsonDescribesObject(JSON.stringify(release.args[0][0], /*replacer=*/ null, /*spacing=*/ 2), releaseCommand);
  });

  it("release-react generates sourcemaps", async () => {
    var bundleName = "bundle.js";
    var command: cli.IReleaseReactCommand = {
      type: cli.CommandType.releaseReact,
      appName: "a",
      appStoreVersion: null,
      bundleName: bundleName,
      deploymentName: "Staging",
      description: "Test generates sourcemaps",
      mandatory: false,
      rollout: null,
      platform: "android",
      sourcemapOutput: "index.android.js.map",
    };

    ensureInTestAppDirectory();

    var release: sinon.SinonSpy = sandbox.stub(runtime, "release");

    await cmdexec.execute(command);

    var releaseCommand: cli.IReleaseCommand = <any>command;
    releaseCommand.package = path.join(os.tmpdir(), "CodePush");
    releaseCommand.appStoreVersion = "1.2.3";

    sinon.assert.calledOnce(spawn);
    var spawnCommand: string = spawn.args[0][0];
    var spawnCommandArgs: string = spawn.args[0][1].join(" ");
    expect(spawnCommand).toBe("node");
    expect(spawnCommandArgs).toBe(
      `${path.join("node_modules", "react-native", "local-cli", "cli.js")} bundle --assets-dest ${path.join(
        os.tmpdir(),
        "CodePush"
      )} --bundle-output ${path.join(
        os.tmpdir(),
        "CodePush",
        bundleName
      )} --dev false --entry-file index.android.js --platform android --sourcemap-output index.android.js.map`
    );
    assertJsonDescribesObject(JSON.stringify(release.args[0][0], /*replacer=*/ null, /*spacing=*/ 2), releaseCommand);
  });

  it("release-react uses specified targetBinaryRange option", async () => {
    var bundleName = "bundle.js";
    var command: cli.IReleaseReactCommand = {
      type: cli.CommandType.releaseReact,
      appName: "a",
      appStoreVersion: ">=1.0.0 <1.0.5",
      bundleName: bundleName,
      deploymentName: "Staging",
      description: "Test uses targetBinaryRange",
      mandatory: false,
      rollout: null,
      platform: "android",
      sourcemapOutput: "index.android.js.map",
    };

    ensureInTestAppDirectory();

    var release: sinon.SinonSpy = sandbox.stub(runtime, "release");

    await cmdexec.execute(command);

    var releaseCommand: cli.IReleaseCommand = <any>command;
    releaseCommand.package = path.join(os.tmpdir(), "CodePush");

    sinon.assert.calledOnce(spawn);
    var spawnCommand: string = spawn.args[0][0];
    var spawnCommandArgs: string = spawn.args[0][1].join(" ");
    expect(spawnCommand).toBe("node");
    expect(spawnCommandArgs).toBe(
      `${path.join("node_modules", "react-native", "local-cli", "cli.js")} bundle --assets-dest ${path.join(
        os.tmpdir(),
        "CodePush"
      )} --bundle-output ${path.join(
        os.tmpdir(),
        "CodePush",
        bundleName
      )} --dev false --entry-file index.android.js --platform android --sourcemap-output index.android.js.map`
    );
    assertJsonDescribesObject(JSON.stringify(release.args[0][0], /*replacer=*/ null, /*spacing=*/ 2), releaseCommand);
  });

  it("release-react applies arguments to node binary provided via the CODE_PUSH_NODE_ARGS env var", async () => {
    var bundleName = "bundle.js";
    var command: cli.IReleaseReactCommand = {
      type: cli.CommandType.releaseReact,
      appName: "a",
      appStoreVersion: null,
      bundleName: bundleName,
      deploymentName: "Staging",
      description: "Test default entry file",
      mandatory: false,
      rollout: null,
      platform: "ios",
    };

    ensureInTestAppDirectory();

    var release: sinon.SinonSpy = sandbox.stub(runtime, "release");

    var _CODE_PUSH_NODE_ARGS: string = process.env.CODE_PUSH_NODE_ARGS;
    process.env.CODE_PUSH_NODE_ARGS = "  --foo=bar    --baz  ";

    try {
      await cmdexec.execute(command);

      var releaseCommand: cli.IReleaseCommand = <any>command;
      releaseCommand.package = path.join(os.tmpdir(), "CodePush");
      releaseCommand.appStoreVersion = "1.2.3";

      sinon.assert.calledOnce(spawn);
      var spawnCommand: string = spawn.args[0][0];
      var spawnCommandArgs: string = spawn.args[0][1].join(" ");
      expect(spawnCommand).toBe("node");
      expect(spawnCommandArgs).toBe(
        `--foo=bar --baz ${path.join("node_modules", "react-native", "local-cli", "cli.js")} bundle --assets-dest ${path.join(
          os.tmpdir(),
          "CodePush"
        )} --bundle-output ${path.join(os.tmpdir(), "CodePush", bundleName)} --dev false --entry-file index.ios.js --platform ios`
      );
      assertJsonDescribesObject(JSON.stringify(release.args[0][0], /*replacer=*/ null, /*spacing=*/ 2), releaseCommand);
    } finally {
      if (_CODE_PUSH_NODE_ARGS === undefined) {
        delete process.env.CODE_PUSH_NODE_ARGS;
      } else {
        process.env.CODE_PUSH_NODE_ARGS = _CODE_PUSH_NODE_ARGS;
      }
    }
  });

  it("release-react applies extraBundlerOptions to bundler command", async () => {
    var bundleName = "bundle.js";
    var command: cli.IReleaseReactCommand = {
      type: cli.CommandType.releaseReact,
      appName: "a",
      appStoreVersion: null,
      bundleName: bundleName,
      deploymentName: "Staging",
      description: "Test default entry file",
      mandatory: false,
      rollout: null,
      platform: "ios",
      extraBundlerOptions: ["--foo=bar", "--baz"],
    };

    ensureInTestAppDirectory();

    var release: sinon.SinonSpy = sandbox.stub(runtime, "release");

    await cmdexec.execute(command);

    var releaseCommand: cli.IReleaseCommand = <any>command;
    releaseCommand.package = path.join(os.tmpdir(), "CodePush");
    releaseCommand.appStoreVersion = "1.2.3";

    sinon.assert.calledOnce(spawn);
    var spawnCommand: string = spawn.args[0][0];
    var spawnCommandArgs: string = spawn.args[0][1].join(" ");
    expect(spawnCommand).toBe("node");
    expect(spawnCommandArgs).toBe(
      `${path.join("node_modules", "react-native", "local-cli", "cli.js")} bundle --assets-dest ${path.join(
        os.tmpdir(),
        "CodePush"
      )} --bundle-output ${path.join(os.tmpdir(), "CodePush", bundleName)} --dev false --entry-file index.ios.js --platform ios --foo=bar --baz`
    );
    assertJsonDescribesObject(JSON.stringify(release.args[0][0], /*replacer=*/ null, /*spacing=*/ 2), releaseCommand);
  });

  it("sessionList lists session name and expires fields", async () => {
    var command: cli.IAccessKeyListCommand = {
      type: cli.CommandType.sessionList,
      format: "json",
    };

    await cmdexec.execute(command);

      sinon.assert.calledOnce(log);
      expect(log.args[0].length).toBe(1);

      var actual: string = log.args[0][0];
      var expected = [
        {
          loggedInTime: 0,
          machineName: TEST_MACHINE_NAME,
        },
      ];

      assertJsonDescribesObject(actual, expected);
  });

  it("sessionRemove removes session", async () => {
    var machineName = TEST_MACHINE_NAME;
    var command: cli.ISessionRemoveCommand = {
      type: cli.CommandType.sessionRemove,
      machineName: machineName,
    };

    var removeSession: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "removeSession");

    await cmdexec.execute(command);

      sinon.assert.calledOnce(removeSession);
      sinon.assert.calledWithExactly(removeSession, machineName);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, `Successfully removed the login session for "${machineName}".`);
  });

  it("sessionRemove does not remove session if cancelled", async () => {
    var machineName = TEST_MACHINE_NAME;
    var command: cli.ISessionRemoveCommand = {
      type: cli.CommandType.sessionRemove,
      machineName: machineName,
    };

    var removeSession: sinon.SinonSpy = sandbox.spy(cmdexec.runtime.sdk, "removeSession");

    wasConfirmed = false;

    await cmdexec.execute(command);

      sinon.assert.notCalled(removeSession);
      sinon.assert.calledOnce(log);
      sinon.assert.calledWithExactly(log, "Session removal cancelled.");
  });

  it("sessionRemove does not remove current session", async () => {
    var machineName = os.hostname();
    var command: cli.ISessionRemoveCommand = {
      type: cli.CommandType.sessionRemove,
      machineName: machineName,
    };

    wasConfirmed = false;

    await expect(cmdexec.execute(command)).rejects.toThrow(/Cannot remove the current login session/);
  });

  async function releaseHelperFunction(command: cli.IReleaseCommand, expectedError: string): Promise<void> {
    await expect(cmdexec.execute(command)).rejects.toMatchObject({ message: expectedError });
  }
});
