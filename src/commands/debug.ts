
import * as childProcess from "child_process";
import { format } from "date-fns";
import * as path from "path";
import * as cli from "../types/cli";

const simctl = require("simctl");
const which = require("which");

interface IDebugPlatform {
  getLogProcess(): childProcess.ChildProcess;
  normalizeLogMessage(message: string): string;
}

class AndroidDebugPlatform implements IDebugPlatform {
  public getLogProcess(): childProcess.ChildProcess {
    try {
      which.sync("adb");
    } catch {
      throw new Error("ADB command not found. Please ensure it is installed and available on your path.");
    }

    const numberOfAvailableDevices = this.getNumberOfAvailableDevices();
    if (numberOfAvailableDevices === 0) {
      throw new Error("No Android devices found. Re-run this command after starting one.");
    }

    if (numberOfAvailableDevices > 1) {
      throw new Error(`Found "${numberOfAvailableDevices}" android devices. Please leave only one device you need to debug.`);
    }

    return childProcess.spawn("adb", ["logcat"]);
  }

  private getNumberOfAvailableDevices(): number {
    const output = childProcess.execSync("adb devices").toString();
    const matches = output.match(/\b(device)\b/gim);
    if (matches != null) {
      return matches.length;
    }
    return 0;
  }

  public normalizeLogMessage(message: string): string {
    const sourceURLIndex: number = message.indexOf('", source: file:///');
    if (~sourceURLIndex) {
      return message.substring(0, sourceURLIndex);
    }
    return message;
  }
}

class iOSDebugPlatform implements IDebugPlatform {
  private getSimulatorID(): string {
    const output: any = simctl.list({ devices: true, silent: true });
    const simulators: string[] = output.json.devices
      .map((platform: any) => platform.devices)
      .reduce((prev: any, next: any) => prev.concat(next))
      .filter((device: any) => device.state === "Booted")
      .map((device: any) => device.id);

    return simulators[0];
  }

  public getLogProcess(): childProcess.ChildProcess {
    if (process.platform !== "darwin") {
      throw new Error("iOS debug logs can only be viewed on OS X.");
    }

    const simulatorID: string = this.getSimulatorID();
    if (!simulatorID) {
      throw new Error("No iOS simulators found. Re-run this command after starting one.");
    }

    const logFilePath: string = path.join(process.env.HOME!, "Library/Logs/CoreSimulator", simulatorID, "system.log");
    return childProcess.spawn("tail", ["-f", logFilePath]);
  }

  public normalizeLogMessage(message: string): string {
    return message;
  }
}

const logMessagePrefix = "[CodePush] ";

function processLogData(this: IDebugPlatform, logData: Buffer) {
  const content = logData.toString();
  content
    .split("\n")
    .filter((line: string) => line.indexOf(logMessagePrefix) > -1)
    .map((line: string) => {
      line = this.normalizeLogMessage(line);
      const message = line.substring(line.indexOf(logMessagePrefix) + logMessagePrefix.length);
      const timeStamp = format(new Date(), "hh:mm:ss");
      return `[${timeStamp}] ${message}`;
    })
    .forEach((line: string) => console.log(line));
}

const debugPlatforms: Record<string, IDebugPlatform> = {
  android: new AndroidDebugPlatform(),
  ios: new iOSDebugPlatform(),
};

export default function debug(command: cli.IDebugCommand): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const platform: string = command.platform.toLowerCase();
    const debugPlatform: IDebugPlatform = debugPlatforms[platform];

    if (!debugPlatform) {
      const availablePlatforms = Object.getOwnPropertyNames(debugPlatforms);
      reject(new Error(`"${platform}" is an unsupported platform. Available options are ${availablePlatforms.join(", ")}.`));
      return;
    }

    try {
      const logProcess = debugPlatform.getLogProcess();
      console.log(`Listening for ${platform} debug logs (Press CTRL+C to exit)`);

      logProcess.stdout?.on("data", processLogData.bind(debugPlatform));
      logProcess.stderr?.on("data", reject);

      logProcess.on("close", () => resolve());
    } catch (e) {
      reject(e);
    }
  });
}
