#!/usr/bin/env node
// @ts-nocheck
import { Command } from "commander";
import { scaffold } from "../src/scaffold.mjs";

const program = new Command();

program
  .name("create-frontend-setup")
  .description("Scaffold React + Vite + SCSS with Sonal's folder layout")
  .argument("<app-name>", "directory name for the new app")
  .option("-p, --package-manager <pm>", "npm | pnpm | yarn | bun", "npm")
  .option("--no-install", "skip installing deps after template creation")
  .action(async (appName, opts) => {
    try {
      await scaffold({ appName, packageManager: opts.packageManager, install: opts.install });
      console.log(`\n Done. Next:\n  cd ${appName}\n  ${opts.packageManager} run dev\n`);
    } catch (err) {
      console.error("\n Scaffold failed:", err?.message || err);
      process.exit(1);
    }
  });

program.parse();
