
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "superagent";
import AccountManager from "@/sdk/management";

let manager: AccountManager;

function rejectHandler(): void {
  expect.fail("Promise should have been rejected");
}

function mockReturn(bodyText: string, statusCode: number, header: Record<string, string> = {}): void {
  require("superagent-mock")(request, [
    {
      pattern: "http://localhost/(\\w+)/?",
      fixtures: function (_match: string[], _params: unknown) {
        const isOk = statusCode >= 200 && statusCode < 300;
        if (!isOk) {
          const err: any = new Error(bodyText);
          err.status = statusCode;
          throw err;
        }
        return {
          text: bodyText,
          status: statusCode,
          ok: isOk,
          header: header,
          headers: {},
        };
      },
      callback: function (_match: string[], data: unknown) {
        return data;
      },
    },
  ]);
}

describe("Management SDK", () => {
  beforeEach(() => {
    manager = new AccountManager("dummyAccessKey", undefined, "http://localhost");
  });

  afterAll(() => {
    (request as any).Request.prototype._callback = function () {};
  });

  it("methods reject the promise with status code info when an error occurs", async () => {
    mockReturn("Text", 404);

    const methodsWithErrorHandling = [
      () => manager.addApp("appName"),
      () => manager.getApp("appName"),
      () => manager.renameApp("appName", "newAppName"),
      () => manager.removeApp("appName"),
      () => manager.transferApp("appName", "email1"),
      () => manager.addDeployment("appName", "deploymentName"),
      () => manager.getDeployment("appName", "deploymentName"),
      () => manager.getDeployments("appName"),
      () => manager.renameDeployment("appName", "deploymentName", "newDeploymentName"),
      () => manager.removeDeployment("appName", "deploymentName"),
      () => manager.addCollaborator("appName", "email1"),
      () => manager.getCollaborators("appName"),
      () => manager.removeCollaborator("appName", "email1"),
      () => manager.patchRelease("appName", "deploymentName", "label", { description: "newDescription" }),
      () => manager.promote("appName", "deploymentName", "newDeploymentName", { description: "newDescription" }),
      () => manager.rollback("appName", "deploymentName", "targetReleaseLabel"),
    ];

    for (const method of methodsWithErrorHandling) {
      await expect(method()).rejects.toMatchObject({
        message: "Text",
        statusCode: expect.any(Number),
      });
    }
  });

  it("isAuthenticated handles successful auth", async () => {
    mockReturn(JSON.stringify({ authenticated: true }), 200, {});
    const authenticated = await manager.isAuthenticated();
    expect(authenticated).toBe(true);
  });

  it("isAuthenticated handles unsuccessful auth", async () => {
    mockReturn("Unauthorized", 401, {});
    const authenticated = await manager.isAuthenticated();
    expect(authenticated).toBe(false);
  });

  it("isAuthenticated handles unsuccessful auth with promise rejection", async () => {
    mockReturn("Unauthorized", 401, {});
    await expect(manager.isAuthenticated(true)).rejects.toMatchObject({
      message: "Unauthorized",
    });
  });

  it("isAuthenticated handles unexpected status codes", async () => {
    mockReturn("Not Found", 404, {});
    await expect(manager.isAuthenticated()).rejects.toMatchObject({
      message: "Not Found",
    });
  });

  it("addApp handles successful response", async () => {
    mockReturn(JSON.stringify({ success: true }), 201, { location: "/appName" });
    const obj = await manager.addApp("appName");
    expect(obj).toBeTruthy();
  });

  it("addApp handles error response", async () => {
    mockReturn(JSON.stringify({ success: false }), 404, {});
    await expect(manager.addApp("appName")).rejects.toBeTruthy();
  });

  it("getApp handles JSON response", async () => {
    mockReturn(JSON.stringify({ app: {} }), 200, {});
    const obj = await manager.getApp("appName");
    expect(obj).toBeTruthy();
  });

  it("updateApp handles success response", async () => {
    mockReturn(JSON.stringify({ apps: [] }), 200, {});
    const obj = await manager.renameApp("appName", "newAppName");
    expect(obj).toBeFalsy();
  });

  it("removeApp handles success response", async () => {
    mockReturn("", 200, {});
    const obj = await manager.removeApp("appName");
    expect(obj).toBeFalsy();
  });

  it("transferApp handles successful response", async () => {
    mockReturn("", 201);
    const obj = await manager.transferApp("appName", "email1");
    expect(obj).toBeFalsy();
  });

  it("addDeployment handles success response", async () => {
    mockReturn(JSON.stringify({ deployment: { name: "name", key: "key" } }), 201, { location: "/deploymentName" });
    const obj = await manager.addDeployment("appName", "deploymentName");
    expect(obj).toBeTruthy();
  });

  it("getDeployment handles JSON response", async () => {
    mockReturn(JSON.stringify({ deployment: {} }), 200, {});
    const obj = await manager.getDeployment("appName", "deploymentName");
    expect(obj).toBeTruthy();
  });

  it("getDeployments handles JSON response", async () => {
    mockReturn(JSON.stringify({ deployments: [] }), 200, {});
    const obj = await manager.getDeployments("appName");
    expect(obj).toBeTruthy();
  });

  it("renameDeployment handles success response", async () => {
    mockReturn(JSON.stringify({ apps: [] }), 200, {});
    const obj = await manager.renameDeployment("appName", "deploymentName", "newDeploymentName");
    expect(obj).toBeFalsy();
  });

  it("removeDeployment handles success response", async () => {
    mockReturn("", 200, {});
    const obj = await manager.removeDeployment("appName", "deploymentName");
    expect(obj).toBeFalsy();
  });

  it("getDeploymentHistory handles success response with no packages", async () => {
    mockReturn(JSON.stringify({ history: [] }), 200);
    const obj = await manager.getDeploymentHistory("appName", "deploymentName");
    expect(obj).toBeTruthy();
    expect(obj.length).toBe(0);
  });

  it("getDeploymentHistory handles success response with two packages", async () => {
    mockReturn(JSON.stringify({ history: [{ label: "v1" }, { label: "v2" }] }), 200);
    const obj = await manager.getDeploymentHistory("appName", "deploymentName");
    expect(obj.length).toBe(2);
    expect(obj[0].label).toBe("v1");
    expect(obj[1].label).toBe("v2");
  });

  it("getDeploymentHistory handles error response", async () => {
    mockReturn("", 404);
    await expect(manager.getDeploymentHistory("appName", "deploymentName")).rejects.toBeTruthy();
  });

  it("clearDeploymentHistory handles success response", async () => {
    mockReturn("", 204);
    const obj = await manager.clearDeploymentHistory("appName", "deploymentName");
    expect(obj).toBeFalsy();
  });

  it("clearDeploymentHistory handles error response", async () => {
    mockReturn("", 404);
    await expect(manager.clearDeploymentHistory("appName", "deploymentName")).rejects.toBeTruthy();
  });

  it("addCollaborator handles successful response", async () => {
    mockReturn("", 201, { location: "/collaborators" });
    const obj = await manager.addCollaborator("appName", "email1");
    expect(obj).toBeFalsy();
  });

  it("addCollaborator handles error response", async () => {
    mockReturn("", 404, {});
    await expect(manager.addCollaborator("appName", "email1")).rejects.toBeTruthy();
  });

  it("getCollaborators handles success response with no collaborators", async () => {
    mockReturn(JSON.stringify({ collaborators: {} }), 200);
    const obj = await manager.getCollaborators("appName");
    expect(Object.keys(obj).length).toBe(0);
  });

  it("getCollaborators handles success response with multiple collaborators", async () => {
    mockReturn(
      JSON.stringify({
        collaborators: {
          email1: { permission: "Owner", isCurrentAccount: true },
          email2: { permission: "Collaborator", isCurrentAccount: false },
        },
      }),
      200
    );
    const obj = await manager.getCollaborators("appName");
    expect(obj["email1"].permission).toBe("Owner");
    expect(obj["email2"].permission).toBe("Collaborator");
  });

  it("removeCollaborator handles success response", async () => {
    mockReturn("", 200, {});
    const obj = await manager.removeCollaborator("appName", "email1");
    expect(obj).toBeFalsy();
  });

  it("patchRelease handles success response", async () => {
    mockReturn(JSON.stringify({ package: { description: "newDescription" } }), 200);
    const obj = await manager.patchRelease("appName", "deploymentName", "label", { description: "newDescription" });
    expect(obj).toBeFalsy();
  });

  it("patchRelease handles error response", async () => {
    mockReturn("", 400);
    await expect(manager.patchRelease("appName", "deploymentName", "label", {})).rejects.toBeTruthy();
  });

  it("promote handles success response", async () => {
    mockReturn(JSON.stringify({ package: { description: "newDescription" } }), 200);
    const obj = await manager.promote("appName", "deploymentName", "newDeploymentName", { description: "newDescription" });
    expect(obj).toBeFalsy();
  });

  it("promote handles error response", async () => {
    mockReturn("", 400);
    await expect(manager.promote("appName", "deploymentName", "newDeploymentName", { rollout: 123 })).rejects.toBeTruthy();
  });

  it("rollback handles success response", async () => {
    mockReturn(JSON.stringify({ package: { label: "v1" } }), 200);
    const obj = await manager.rollback("appName", "deploymentName", "v1");
    expect(obj).toBeFalsy();
  });

  it("rollback handles error response", async () => {
    mockReturn("", 400);
    await expect(manager.rollback("appName", "deploymentName", "v1")).rejects.toBeTruthy();
  });
});
