
import { describe, it, expect } from "vitest";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { mkdirp } from "mkdirp";
import yauzl from "yauzl";
import * as hashUtils from "@/lib/hash";
import { PackageManifest } from "@/lib/hash";

function randomString(): string {
  const stringLength = 10;
  return crypto.randomBytes(Math.ceil(stringLength / 2)).toString("hex").slice(0, stringLength);
}

async function unzipToDirectory(zipPath: string, directoryPath: string): Promise<void> {
  await mkdirp(directoryPath);

  await new Promise<void>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err: Error | null, zipfile: any) => {
      if (err) {
        reject(err);
        return;
      }

      zipfile.readEntry();
      zipfile.on("entry", (entry: any) => {
        const entryPath = path.join(directoryPath, entry.fileName);
        if (/\/$/.test(entry.fileName)) {
          mkdirp(entryPath).then(() => zipfile.readEntry()).catch(reject);
        } else {
          zipfile.openReadStream(entry, (streamErr: Error | null, readStream: any) => {
            if (streamErr) {
              reject(streamErr);
              return;
            }

            mkdirp(path.dirname(entryPath))
              .then(() => {
                readStream.pipe(fs.createWriteStream(entryPath));
                readStream.on("end", () => zipfile.readEntry());
              })
              .catch(reject);
          });
        }
      });

      zipfile.on("end", (endErr: Error | null) => {
        if (endErr) reject(endErr);
        else resolve();
      });
    });
  });
}

describe("Hashing utility", () => {
  const TEST_DIRECTORY = path.join(os.tmpdir(), "codepushtests", randomString());
  const TEST_ARCHIVE_FILE_PATH = path.join(__dirname, "../fixtures/resources/test.zip");
  const TEST_ZIP_HASH = "540fed8df3553079e81d1353c5cc4e3cac7db9aea647a85d550f646e8620c317";
  const TEST_ZIP_MANIFEST_HASH = "9e0499ce7df5c04cb304c9deed684dc137fc603cb484a5b027478143c595d80b";
  const HASH_B = "3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d";
  const HASH_C = "2e7d2c03a9507ae265ecf5b5356885a53393a2029d241394997265a1a25aefc6";
  const HASH_D = "18ac3e7343f016890c510e93f935261169d9e3f565436429830faf0934f4f8e4";
  const IGNORED_METADATA_ARCHIVE_FILE_PATH = path.join(__dirname, "../fixtures/resources/ignoredMetadata.zip");
  const INDEX_HASH = "b0693dc92f76e08bf1485b3dd9b514a2e31dfd6f39422a6b60edb722671dc98f";

  it("generates a package hash from file", async () => {
    const packageHash = await hashUtils.hashFile(TEST_ARCHIVE_FILE_PATH);
    expect(packageHash).toBe(TEST_ZIP_HASH);
  });

  it("generates a package manifest for an archive", async () => {
    const manifest = await hashUtils.generatePackageManifestFromZip(TEST_ARCHIVE_FILE_PATH);
    const fileHashesMap = manifest!.toMap();
    expect(fileHashesMap.size).toBe(3);
    expect(fileHashesMap.get("b.txt")).toBe(HASH_B);
    expect(fileHashesMap.get("c.txt")).toBe(HASH_C);
    expect(fileHashesMap.get("d.txt")).toBe(HASH_D);
  });

  it("generates a package manifest for a directory", async () => {
    const directory = path.join(TEST_DIRECTORY, "testZip");
    await unzipToDirectory(TEST_ARCHIVE_FILE_PATH, directory);
    const manifest = await hashUtils.generatePackageManifestFromDirectory(directory, directory);
    const fileHashesMap = manifest.toMap();
    expect(fileHashesMap.size).toBe(3);
    expect(fileHashesMap.get("b.txt")).toBe(HASH_B);
    expect(fileHashesMap.get("c.txt")).toBe(HASH_C);
    expect(fileHashesMap.get("d.txt")).toBe(HASH_D);
  });

  it("generates a package hash from manifest", async () => {
    const manifest = await hashUtils.generatePackageManifestFromZip(TEST_ARCHIVE_FILE_PATH);
    const packageHash = await manifest!.computePackageHash();
    expect(packageHash).toBe(TEST_ZIP_MANIFEST_HASH);
  });

  it("generates a package manifest for an archive with ignorable metadata", async () => {
    const manifest = await hashUtils.generatePackageManifestFromZip(IGNORED_METADATA_ARCHIVE_FILE_PATH);
    expect(manifest!.toMap().size).toBe(1);
    expect(manifest!.toMap().get("www/index.html")).toBe(INDEX_HASH);
  });

  it("generates a package manifest for a directory with ignorable metadata", async () => {
    const directory = path.join(TEST_DIRECTORY, "ignorableMetadata");
    await unzipToDirectory(IGNORED_METADATA_ARCHIVE_FILE_PATH, directory);
    const manifest = await hashUtils.generatePackageManifestFromDirectory(directory, directory);
    expect(manifest.toMap().size).toBe(1);
    expect(manifest.toMap().get("www/index.html")).toBe(INDEX_HASH);
  });
});
