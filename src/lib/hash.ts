
/**
 * NOTE!!! This utility file is duplicated for use by the CodePush service (for server-driven hashing/
 * integrity checks) and Management SDK (for end-to-end code signing), please keep them in sync.
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as stream from "stream";

let recursiveFs: typeof import("recursive-fs") | undefined;
let yauzl: typeof import("yauzl") | undefined;

try {
  recursiveFs = require("recursive-fs");
} catch {}
try {
  yauzl = require("yauzl");
} catch {}

const HASH_ALGORITHM = "sha256";

export function generatePackageHashFromDirectory(directoryPath: string, basePath: string): Promise<string> {
  if (!fs.lstatSync(directoryPath).isDirectory()) {
    throw new Error("Not a directory. Please either create a directory, or use hashFile().");
  }

  return generatePackageManifestFromDirectory(directoryPath, basePath).then((manifest: PackageManifest) => {
    return manifest.computePackageHash();
  });
}

export function generatePackageManifestFromZip(filePath: string): Promise<PackageManifest | null> {
  return new Promise((resolve, reject) => {
    let zipFile: any;

    const cleanup = () => {
      if (zipFile) {
        zipFile.close();
      }
    };

    yauzl!.open(filePath, { lazyEntries: true }, (error?: Error, openedZipFile?: any): void => {
      if (error) {
        resolve(null);
        return;
      }

      zipFile = openedZipFile;
      const fileHashesMap = new Map<string, string>();
      const hashFilePromises: Promise<void>[] = [];

      zipFile.readEntry();
      zipFile
        .on("error", (zipError: Error): void => {
          cleanup();
          reject(zipError);
        })
        .on("entry", (entry: any): void => {
          const fileName: string = PackageManifest.normalizePath(entry.fileName);
          if (PackageManifest.isIgnored(fileName)) {
            zipFile.readEntry();
            return;
          }

          zipFile.openReadStream(entry, (streamError?: Error, readStream?: stream.Readable): void => {
            if (streamError) {
              cleanup();
              reject(streamError);
              return;
            }

            hashFilePromises.push(
              hashStream(readStream!).then((hash: string) => {
                fileHashesMap.set(fileName, hash);
                zipFile.readEntry();
              })
            );
          });
        })
        .on("end", (): void => {
          Promise.all(hashFilePromises)
            .then(() => {
              cleanup();
              resolve(new PackageManifest(fileHashesMap));
            })
            .catch((endError) => {
              cleanup();
              reject(endError);
            });
        });
    });
  });
}

export function generatePackageManifestFromDirectory(directoryPath: string, basePath: string): Promise<PackageManifest> {
  return new Promise((resolve, reject) => {
    const fileHashesMap = new Map<string, string>();

    recursiveFs!.readdirr(directoryPath, (error?: Error, _directories?: string[], files?: string[]): void => {
      if (error) {
        reject(error);
        return;
      }

      if (!files || files.length === 0) {
        reject(new Error("Error: Can't sign the release because no files were found."));
        return;
      }

      const generateManifestPromise = files.reduce<Promise<void>>((soFar, filePath) => {
        return soFar.then(() => {
          const relativePath: string = PackageManifest.normalizePath(path.relative(basePath, filePath));
          if (!PackageManifest.isIgnored(relativePath)) {
            return hashFile(filePath).then((hash: string) => {
              fileHashesMap.set(relativePath, hash);
            });
          }
        });
      }, Promise.resolve());

      generateManifestPromise
        .then(() => {
          resolve(new PackageManifest(fileHashesMap));
        })
        .catch(reject);
    });
  });
}

export function hashFile(filePath: string): Promise<string> {
  const readStream: fs.ReadStream = fs.createReadStream(filePath);
  return hashStream(readStream);
}

export function hashStream(readStream: stream.Readable): Promise<string> {
  const hashTransform = crypto.createHash(HASH_ALGORITHM);

  return new Promise((resolve, reject) => {
    readStream
      .on("error", (error: Error): void => {
        reject(error);
      })
      .on("end", (): void => {
        const buffer = hashTransform.digest();
        resolve(buffer.toString("hex"));
      });

    readStream.pipe(hashTransform);
  });
}

export class PackageManifest {
  private _map: Map<string, string>;

  public constructor(map?: Map<string, string>) {
    this._map = map ?? new Map<string, string>();
  }

  public toMap(): Map<string, string> {
    return this._map;
  }

  public computePackageHash(): Promise<string> {
    const entries: string[] = [];
    this._map.forEach((hash: string, name: string): void => {
      entries.push(name + ":" + hash);
    });

    entries.sort();

    return Promise.resolve(crypto.createHash(HASH_ALGORITHM).update(JSON.stringify(entries)).digest("hex"));
  }

  public serialize(): string {
    const obj: Record<string, string> = {};

    this._map.forEach((value, key) => {
      obj[key] = value;
    });

    return JSON.stringify(obj);
  }

  public static deserialize(serializedContents: string): PackageManifest | undefined {
    try {
      const obj: Record<string, string> = JSON.parse(serializedContents);
      const map = new Map<string, string>();

      for (const key of Object.keys(obj)) {
        map.set(key, obj[key]);
      }

      return new PackageManifest(map);
    } catch {
      return undefined;
    }
  }

  public static normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, "/");
  }

  public static isIgnored(relativeFilePath: string): boolean {
    const __MACOSX = "__MACOSX/";
    const DS_STORE = ".DS_Store";

    return (
      startsWith(relativeFilePath, __MACOSX) || relativeFilePath === DS_STORE || endsWith(relativeFilePath, "/" + DS_STORE)
    );
  }
}

function startsWith(str: string, prefix: string): boolean {
  return !!str && str.substring(0, prefix.length) === prefix;
}

function endsWith(str: string, suffix: string): boolean {
  return !!str && str.indexOf(suffix, str.length - suffix.length) !== -1;
}
