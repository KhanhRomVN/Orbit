#!/usr/bin/env node
/**
 * watchbuild.js
 * Watches source files and rebuilds on save if enabled in watchbuild.config.json
 */
import chokidar from "chokidar";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

const CONFIG_PATH = path.resolve(process.cwd(), "watchbuild.config.json");

function isEnabled() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    return cfg.enabled === true;
  } catch {
    return false;
  }
}

if (!isEnabled()) {
  process.exit(0);
}

const watcher = chokidar.watch(["src/**/*", CONFIG_PATH], {
  ignoreInitial: true,
});

watcher.on("change", (filePath) => {
  if (filePath === CONFIG_PATH) {
    if (!isEnabled()) {
      watcher.close();
      process.exit(0);
    }
    return;
  }
  const build = exec("npm run build", { cwd: process.cwd() });
  build.stdout?.pipe(process.stdout);
  build.stderr?.pipe(process.stderr);
});