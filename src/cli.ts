#!/usr/bin/env node


import chalk from "chalk";
import * as parser from "./commands/parser";
import * as execute from "./commands/executor";

async function run(): Promise<void> {
  const command = parser.createCommand();

  if (!command) {
    parser.showHelp(false);
    return;
  }

  try {
    await execute.execute(command);
  } catch (error: any) {
    console.error(chalk.red(`[Error]  ${error.message}`));
    process.exit(1);
  }
}

void run();
