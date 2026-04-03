#!/usr/bin/env node

import { auth } from "./auth.js";

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case "auth":
      await auth({
        save: args.includes("--save"),
        refresh: args.includes("--refresh"),
      });
      break;

    case "token":
      await showToken();
      break;

    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

async function showToken() {
  const { readFile } = await import("node:fs/promises");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");

  const tokenPath = join(homedir(), ".copilot-portal", "token");

  try {
    const token = (await readFile(tokenPath, "utf-8")).trim();
    console.log(token);
  } catch {
    console.error("No saved token found. Run: npx copilot-portal auth --save");
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
copilot-portal - Turn your GitHub Copilot subscription into your own API endpoint

USAGE:
  npx copilot-portal <command> [options]

COMMANDS:
  auth          Authenticate with GitHub (Device Flow)
  token         Show saved OAuth token

OPTIONS (auth):
  --save        Save token to ~/.copilot-portal/token
  --refresh     Force re-authentication

EXAMPLES:
  npx copilot-portal auth              # Get OAuth token (prints to stdout)
  npx copilot-portal auth --save       # Get and save token
  npx copilot-portal token             # Show saved token
`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
