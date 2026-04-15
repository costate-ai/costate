import chalk from "chalk";
import { loadConfig, getConfigPath, DEFAULT_SERVICE_URL } from "../config.js";
import { error as printError } from "../output.js";

export async function runWhoami(): Promise<void> {
  const config = await loadConfig();

  if (!config.userId && !config.token) {
    printError("Not logged in. Run `costate login` first.");
    process.exit(1);
  }

  console.log();
  console.log(chalk.bold("Costate Identity"));
  console.log();
  console.log(`  User:       ${chalk.cyan(config.userId || "unknown")}`);
  console.log(
    `  Service:    ${chalk.dim(config.url || DEFAULT_SERVICE_URL)}`,
  );
  console.log(
    `  Workspace:  ${config.workspaceId ? chalk.cyan(config.workspaceId) : chalk.dim("not set")}`,
  );
  console.log(
    `  Token:      ${config.token ? chalk.green("active") : chalk.red("none")}`,
  );
  console.log(`  Config:     ${chalk.dim(getConfigPath())}`);
  console.log();
}
