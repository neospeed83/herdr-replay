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
function openReplay(){if(!existsSync(htmlPath))throw new Error("No replay exists yet.");const spec=process.platform==="darwin"?["open",[htmlPath]]:process.platform==="win32"?["cmd",["/c","start","",htmlPath]]:["xdg-open",[htmlPath]];const child=spawn(spec[0],spec[1],{detached:true,stdio:"ignore"});child.unref();process.stdout.write(`Opened ${htmlPath}\n`)}
async function stopRecording(){const value=pid();if(!alive(value)){process.stdout.write("No recording is active.\n");return}process.kill(value,"SIGTERM");for(let i=0;i<20;i++){await new Promise(resolve=>setTimeout(resolve,100));try{const recording=JSON.parse(readFileSync(recordingPath,"utf8"));if(recording.endedAt)break}catch{}}process.stdout.write(`Recording stopped. Replay: ${htmlPath}\n`)}
const command = process.argv[2] || "status";
if (command === "toggle" && alive(pid())) {
  await stopRecording(); openReplay();
} else if (command === "toggle" || command === "start") {
  if (alive(pid())) { process.stdout.write("Herdr Replay is already recording.\n"); process.exit(0); }
  const child = spawn(process.execPath, [join(process.env.HERDR_PLUGIN_ROOT || process.cwd(), "src", "recorder.mjs")], { detached:true, stdio:"ignore", env:{...process.env, HERDR_REPLAY_STATE_DIR:stateDir, HERDR_REPLAY_WORKSPACE_ID:process.env.HERDR_WORKSPACE_ID||""} });
  child.unref(); writeFileSync(pidPath, String(child.pid), "utf8"); process.stdout.write(`Recording started (PID ${child.pid}).\n`);
} else if (command === "stop") {
  await stopRecording();
} else if (command === "export") {
  if (!existsSync(recordingPath)) throw new Error("No recording exists yet."); exportReplay(recordingPath, htmlPath); process.stdout.write(`${htmlPath}\n`);
} else if (command === "open") {
  openReplay();
} else {
  process.stdout.write(alive(pid()) ? `Recording is active (PID ${pid()}).\n` : existsSync(recordingPath) ? `Idle. Latest replay: ${htmlPath}\n` : "Idle. No replay recorded yet.\n");
}
