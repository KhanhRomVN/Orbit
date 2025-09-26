#!/usr/bin/env node
/**
 * toggle-watchbuild.js
 * Toggles the enabled flag in watchbuild.config.json
 */
import fs from "fs";
import path from "path";

const CONFIG_PATH = path.resolve(process.cwd(), "watchbuild.config.json");
const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
const cfg = JSON.parse(raw);
cfg.enabled = !cfg.enabled;
fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n");
