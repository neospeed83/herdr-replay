#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { exportReplay } from "./render.mjs";

const stateDir = process.env.HERDR_PLUGIN_STATE_DIR || join(process.cwd(), ".herdr-replay");
const pidPath = join(stateDir, "recorder.pid");
const recordingPath = join(stateDir, "latest.herdr-replay.json");
const htmlPath = join(stateDir, "latest.html");
mkdirSync(stateDir, { recursive: true });
function pid() { const value = existsSync(pidPath) ? Number(readFileSync(pidPath, "utf8").trim()) : 0; return Number.isInteger(value) && value > 0 ? value : 0; }
function alive(value) { if (!value) return false; try { process.kill(value, 0); return true; } catch { return false; } }
const command = process.argv[2] || "status";
if (command === "start") {
  if (alive(pid())) { process.stdout.write("Herdr Replay is already recording.\n"); process.exit(0); }
  const child = spawn(process.execPath, [join(process.env.HERDR_PLUGIN_ROOT || process.cwd(), "src", "recorder.mjs")], { detached:true, stdio:"ignore", env:{...process.env, HERDR_REPLAY_STATE_DIR:stateDir} });
  child.unref(); writeFileSync(pidPath, String(child.pid), "utf8"); process.stdout.write(`Recording started (PID ${child.pid}).\n`);
} else if (command === "stop") {
  const value = pid(); if (!alive(value)) { process.stdout.write("No recording is active.\n"); process.exit(0); }
  process.kill(value, "SIGTERM"); process.stdout.write(`Recording stopped. Replay: ${htmlPath}\n`);
} else if (command === "export") {
  if (!existsSync(recordingPath)) throw new Error("No recording exists yet."); exportReplay(recordingPath, htmlPath); process.stdout.write(`${htmlPath}\n`);
} else {
  process.stdout.write(alive(pid()) ? `Recording is active (PID ${pid()}).\n` : existsSync(recordingPath) ? `Idle. Latest replay: ${htmlPath}\n` : "Idle. No replay recorded yet.\n");
}
