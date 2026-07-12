
import { describe, it, expect, beforeEach } from "vitest";
import * as acquisitionSdk from "@/sdk/acquisition";
import * as mockApi from "../helpers/acquisition-rest-mock";
import * as rest from "@/types/rest-definitions";

let latestPackage: rest.UpdateCheckResponse;

const configuration: acquisitionSdk.Configuration = {
  appVersion: "1.5.0",
  clientUniqueId: "My iPhone",
  deploymentKey: mockApi.validDeploymentKey,
  serverUrl: mockApi.serverUrl,
};

const templateCurrentPackage: acquisitionSdk.Package = {
  deploymentKey: mockApi.validDeploymentKey,
  description: "sdfsdf",
  label: "v1",
  appVersion: "1.5.0",
  packageHash: "hash001",
  isMandatory: false,
  packageSize: 100,
};

function clone<T>(initialObject: T): T {
  return JSON.parse(JSON.stringify(initialObject));
}

function queryUpdate(
  acquisition: acquisitionSdk.AcquisitionManager,
  currentPackage: acquisitionSdk.Package
): Promise<acquisitionSdk.RemotePackage | acquisitionSdk.NativeUpdateNotification | null> {
  return new Promise((resolve, reject) => {
    acquisition.queryUpdateWithCurrentPackage(currentPackage, (error, returnPackage) => {
      if (error) reject(error);
      else resolve(returnPackage);
    });
  });
}

describe("Acquisition SDK", () => {
  let scriptUpdateResult: acquisitionSdk.RemotePackage;
  let nativeUpdateResult: acquisitionSdk.NativeUpdateNotification;

  beforeEach(() => {
    latestPackage = clone(mockApi.latestPackage);
    mockApi.latestPackage.isMandatory = false;

    scriptUpdateResult = {
      deploymentKey: mockApi.validDeploymentKey,
      description: latestPackage.description!,
      downloadUrl: latestPackage.downloadURL!,
      label: latestPackage.label!,
      appVersion: latestPackage.appVersion!,
      isMandatory: latestPackage.isMandatory!,
      packageHash: latestPackage.packageHash!,
      packageSize: latestPackage.packageSize!,
    };

    nativeUpdateResult = {
      updateAppVersion: true,
      appVersion: latestPackage.appVersion!,
    };
  });

  it("Package with lower label and different package hash gives update", async () => {
    const acquisition = new acquisitionSdk.AcquisitionManager(new mockApi.HttpRequester(), configuration);
    const returnPackage = await queryUpdate(acquisition, templateCurrentPackage);
    expect(returnPackage).toEqual(scriptUpdateResult);
  });

  it("Package with equal package hash gives no update", async () => {
    const equalVersionPackage = clone(templateCurrentPackage);
    equalVersionPackage.packageHash = latestPackage.packageHash!;

    const acquisition = new acquisitionSdk.AcquisitionManager(new mockApi.HttpRequester(), configuration);
    const returnPackage = await queryUpdate(acquisition, equalVersionPackage);
    expect(returnPackage).toBeNull();
  });

  it("Package with higher different hash and higher label version gives update", async () => {
    const higherVersionPackage = clone(templateCurrentPackage);
    higherVersionPackage.packageHash = "hash990";

    const acquisition = new acquisitionSdk.AcquisitionManager(new mockApi.HttpRequester(), configuration);
    const returnPackage = await queryUpdate(acquisition, higherVersionPackage);
    expect(returnPackage).toEqual(scriptUpdateResult);
  });

  it("Package with lower native version gives update notification", async () => {
    const lowerAppVersionPackage = clone(templateCurrentPackage);
    lowerAppVersionPackage.appVersion = "0.0.1";

    const acquisition = new acquisitionSdk.AcquisitionManager(new mockApi.HttpRequester(), configuration);
    const returnPackage = await queryUpdate(acquisition, lowerAppVersionPackage);
    expect(returnPackage).toMatchObject({ updateAppVersion: true, appVersion: "1.5.0" });
  });

  it("Package with higher native version gives no update", async () => {
    const higherAppVersionPackage = clone(templateCurrentPackage);
    higherAppVersionPackage.appVersion = "9.9.0";

    const acquisition = new acquisitionSdk.AcquisitionManager(new mockApi.HttpRequester(), configuration);
    const returnPackage = await queryUpdate(acquisition, higherAppVersionPackage);
    expect(returnPackage).toBeNull();
  });

  it("An empty response gives no update", async () => {
    const lowerAppVersionPackage = clone(templateCurrentPackage);
    lowerAppVersionPackage.appVersion = "0.0.1";

    const emptyResponse: acquisitionSdk.Http.Response = {
      statusCode: 200,
      body: JSON.stringify({}),
    };

    const acquisition = new acquisitionSdk.AcquisitionManager(new mockApi.CustomResponseHttpRequester(emptyResponse), configuration);
    const returnPackage = await queryUpdate(acquisition, lowerAppVersionPackage);
    expect(returnPackage).toBeNull();
  });

  it("If latest package is mandatory, returned package is mandatory", async () => {
    mockApi.latestPackage.isMandatory = true;

    const acquisition = new acquisitionSdk.AcquisitionManager(new mockApi.HttpRequester(), configuration);
    const returnPackage = (await queryUpdate(acquisition, templateCurrentPackage)) as acquisitionSdk.RemotePackage;
    expect(returnPackage.isMandatory).toBe(true);
  });

  it("If invalid arguments are provided, an error is raised", () => {
    const invalidPackage = clone(templateCurrentPackage);
    invalidPackage.appVersion = null as unknown as string;

    const acquisition = new acquisitionSdk.AcquisitionManager(new mockApi.HttpRequester(), configuration);
    expect(() => {
      acquisition.queryUpdateWithCurrentPackage(invalidPackage, () => {});
    }).toThrow();
  });

  it("reportStatusDeploy(...) signals completion", async () => {
    const acquisition = new acquisitionSdk.AcquisitionManager(new mockApi.HttpRequester(), configuration);

    await new Promise<void>((resolve, reject) => {
      acquisition.reportStatusDeploy(
        templateCurrentPackage,
        acquisitionSdk.AcquisitionStatus.DeploymentFailed,
        "1.5.0",
        mockApi.validDeploymentKey,
        (error, parameter) => {
          if (error) reject(error);
          else {
            expect(parameter).toBeNull();
            resolve();
          }
        }
      );
    });
  });

  it("reportStatusDownload(...) signals completion", async () => {
    const acquisition = new acquisitionSdk.AcquisitionManager(new mockApi.HttpRequester(), configuration);

    await new Promise<void>((resolve, reject) => {
      acquisition.reportStatusDownload(templateCurrentPackage, (error, parameter) => {
        if (error) reject(error);
        else {
          expect(parameter).toBeNull();
          resolve();
        }
      });
    });
  });
});
