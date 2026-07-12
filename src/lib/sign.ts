import * as fs from "fs/promises";
import * as path from "path";
import * as jwt from "jsonwebtoken";
import * as hashUtils from "./hash";
import { copyFileToTmpDir, isDirectory } from "../utils/file";

const CURRENT_CLAIM_VERSION: string = "1.0.0";
const METADATA_FILE_NAME: string = ".codepushrelease";

interface CodeSigningClaims {
  claimVersion: string;
  contentHash: string;
}

export default async function sign(privateKeyPath: string, updateContentsPath: string): Promise<void> {
  if (!privateKeyPath) {
    return;
  }

  let privateKey: Buffer;

  try {
    privateKey = await fs.readFile(privateKeyPath);
  } catch {
    throw new Error(`The path specified for the signing key ("${privateKeyPath}") was not valid.`);
  }

  try {
    if (!isDirectory(updateContentsPath)) {
      updateContentsPath = copyFileToTmpDir(updateContentsPath);
    }
  } catch (error) {
    throw error;
  }

  const signatureFilePath: string = path.join(updateContentsPath, METADATA_FILE_NAME);
  let prevSignatureExists = true;
  try {
    await fs.access(signatureFilePath, fs.constants.F_OK);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      prevSignatureExists = false;
    } else {
      throw new Error(
        `Could not delete previous release signature at ${signatureFilePath}.
                Please, check your access rights.`
      );
    }
  }

  if (prevSignatureExists) {
    console.log(`Deleting previous release signature at ${signatureFilePath}`);
    await fs.rm(signatureFilePath, { recursive: true, force: true });
  }

  const hash: string = await hashUtils.generatePackageHashFromDirectory(
    updateContentsPath,
    path.join(updateContentsPath, "..")
  );
  const claims: CodeSigningClaims = {
    claimVersion: CURRENT_CLAIM_VERSION,
    contentHash: hash,
  };

  return new Promise<void>((resolve, reject) => {
    jwt.sign(claims, privateKey, { algorithm: "RS256" }, async (err: Error | null, signedJwt?: string) => {
      if (err || !signedJwt) {
        reject(new Error("The specified signing key file was not valid"));
        return;
      }

      try {
        await fs.writeFile(signatureFilePath, signedJwt);
        console.log(`Generated a release signature and wrote it to ${signatureFilePath}`);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}
