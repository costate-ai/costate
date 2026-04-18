import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { runStatus } from "./commands/status.js";
import { runLogin } from "./commands/login.js";
import {
  runTokenCreate,
  runTokenList,
  runTokenRevoke,
} from "./commands/token.js";
import { runWhoami } from "./commands/whoami.js";
import { runDoctor } from "./commands/doctor.js";
import { runMcpProxy } from "./commands/mcp-proxy.js";
import { runUpload } from "./commands/upload.js";
import { runMkdir } from "./commands/mkdir.js";
import { DEFAULT_SERVICE_URL } from "./config.js";

const program = new Command();

program
  .name("costate")
  .description("CLI for the Costate coordination service")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a new workspace from a template")
  .option("-t, --template <name>", "Template name", "blank")
  .option("-n, --name <dir>", "Directory name for the workspace")
  .action(runInit);

program
  .command("login")
  .description("Authenticate with Costate via browser OAuth")
  .action(runLogin);

const token = program.command("token").description("Manage API tokens (PATs)");

token
  .command("create")
  .description("Create a new PAT via the service")
  .action(runTokenCreate);

token
  .command("list")
  .description("List active tokens")
  .action(runTokenList);

token
  .command("revoke")
  .description("Revoke the active token")
  .action(runTokenRevoke);

program
  .command("whoami")
  .description("Show current identity and configuration")
  .action(runWhoami);

program
  .command("status")
  .description("Show workspace status")
  .action(runStatus);

program
  .command("doctor")
  .description("Check system requirements and service connectivity")
  .action(runDoctor);

program
  .command("upload <path>")
  .description(
    "Convert a local file (PDF/DOCX/PPTX/XLSX/...) to Markdown via markitdown and write it to the workspace",
  )
  .option(
    "-a, --as <uri>",
    "Target URI in the workspace (defaults to <basename>.md)",
  )
  .option(
    "-w, --workspace <id>",
    "Workspace ID (defaults to config.workspaceId)",
  )
  .action(runUpload);

program
  .command("mkdir <path>")
  .description("Create an empty folder in the workspace (trailing / optional)")
  .option(
    "-w, --workspace <id>",
    "Workspace ID (defaults to config.workspaceId)",
  )
  .action(runMkdir);

program
  .command("mcp")
  .description("Start a stdio MCP bridge (for Claude Desktop / Cursor / Code)")
  .option("-u, --url <url>", "Costate service URL", DEFAULT_SERVICE_URL)
  .option(
    "-t, --token <token>",
    "PAT (cst_...). Also reads COSTATE_TOKEN env var.",
  )
  .option("-w, --workspace <id>", "Default workspace ID")
  .action(runMcpProxy);

export { program };
