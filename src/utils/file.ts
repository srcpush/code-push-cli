import * as fs from "fs";
import * as path from "path";
import { rimrafSync } from "rimraf";
import * as temp from "temp";

export function isBinaryOrZip(filePath: string): boolean {
  return filePath.search(/\.zip$/i) !== -1 || filePath.search(/\.apk$/i) !== -1 || filePath.search(/\.ipa$/i) !== -1;
}

export function isDirectory(filePath: string): boolean {
  return fs.statSync(filePath).isDirectory();
}

export function fileExists(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

export function copyFileToTmpDir(filePath: string): string {
  if (!isDirectory(filePath)) {
    const outputFolderPath: string = temp.mkdirSync("code-push");
    rimrafSync(outputFolderPath);
    fs.mkdirSync(outputFolderPath);

    const outputFilePath: string = path.join(outputFolderPath, path.basename(filePath));
    fs.writeFileSync(outputFilePath, fs.readFileSync(filePath));

    return outputFolderPath;
  }

  return filePath;
}

export function fileDoesNotExistOrIsDirectory(filePath: string): boolean {
  try {
    return isDirectory(filePath);
  } catch {
    return true;
  }
}

export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}
