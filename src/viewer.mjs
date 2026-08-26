#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
const stateDir = process.env.HERDR_PLUGIN_STATE_DIR || join(process.cwd(), ".herdr-replay");
const path = join(stateDir, "latest.herdr-replay.json");
process.stdout.write("\x1b[2J\x1b[HHERDR REPLAY\n\n");
if (!existsSync(path)) process.stdout.write("No recording yet. Run the Start recording action first.\n");
else { const r=JSON.parse(readFileSync(path,"utf8")); process.stdout.write(`${r.title}\n${r.startedAt} → ${r.endedAt||"recording"}\n${r.agents.length} agents · ${r.events.length} events\n\n`); for(const e of r.events.slice(-18)) process.stdout.write(`${e.at.slice(11,19)}  ${e.type.padEnd(18)} ${e.agent||""} ${e.status||""}\n`); process.stdout.write(`\nInteractive replay: ${join(stateDir,"latest.html")}\n`); }
process.stdout.write("\nPress Enter to close…"); if(process.stdin.isTTY){process.stdin.setEncoding("utf8");process.stdin.once("data",()=>process.exit(0));}
