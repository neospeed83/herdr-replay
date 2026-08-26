#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import process from "node:process";
import { diffAgents, digest, gitEvidence, parseCliJson, redact } from "./core.mjs";
import { exportReplay } from "./render.mjs";

const stateDir = process.env.HERDR_REPLAY_STATE_DIR || process.env.HERDR_PLUGIN_STATE_DIR || join(process.cwd(), ".herdr-replay");
const herdr = process.env.HERDR_BIN_PATH || "herdr";
const interval = Number(process.env.HERDR_REPLAY_INTERVAL_MS || 1200);
const recordingPath = join(stateDir, "latest.herdr-replay.json");
const htmlPath = join(stateDir, "latest.html");
const pidPath = join(stateDir, "recorder.pid");
const recordingsDir = join(stateDir, "recordings");
const workspaceFilter = process.env.HERDR_REPLAY_WORKSPACE_ID || "";
mkdirSync(stateDir, { recursive: true });
mkdirSync(recordingsDir, { recursive: true });

let recording = { schemaVersion: 1, title: "agent-session", startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), endedAt: null, agents: [], events: [], redaction: "built-in" };
let previousAgents = [];
const terminalHashes = new Map();
const gitHashes = new Map();
let stopping = false;

function call(args) { return execFileSync(herdr, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
function persist() { recording.updatedAt = new Date().toISOString(); const temp = recordingPath + ".tmp"; writeFileSync(temp, JSON.stringify(recording, null, 2), "utf8"); renameSync(temp, recordingPath); }
function sample() {
  const at = new Date().toISOString();
  const snapshot = parseCliJson(call(["api", "snapshot"]));
  const allAgents = snapshot.agents || [];
  const agents = workspaceFilter ? allAgents.filter(agent => agent.workspace_id === workspaceFilter) : allAgents;
  const workspace = (snapshot.workspaces || []).find(item => item.workspace_id === workspaceFilter);
  if (workspace?.label && recording.title === "agent-session") recording.title = workspace.label;
  recording.events.push(...diffAgents(previousAgents, agents, at));
  recording.agents = [...new Map(agents.map(a => [a.pane_id, { paneId:a.pane_id, workspaceId:a.workspace_id, agent:a.agent, cwd:a.cwd }])).values()];
  for (const agent of agents) {
    try {
      const text = redact(call(["pane", "read", agent.pane_id, "--source", "recent-unwrapped", "--lines", "80"])).slice(-24000);
      const hash = digest(text);
      if (text.trim() && terminalHashes.get(agent.pane_id) !== hash) {
        recording.events.push({ at, type:"terminal.snapshot", paneId:agent.pane_id, workspaceId:agent.workspace_id, agent:agent.agent, status:agent.agent_status, hash, text });
        terminalHashes.set(agent.pane_id, hash);
      }
    } catch {}
    const git = gitEvidence(agent.cwd);
    if (git) {
      const hash = digest(JSON.stringify(git));
      if (gitHashes.get(git.root) !== hash) {
        recording.events.push({ at, type:"git.snapshot", paneId:agent.pane_id, workspaceId:agent.workspace_id, agent:agent.agent, repo:basename(git.root), ...git });
        gitHashes.set(git.root, hash);
      }
    }
  }
  previousAgents = agents;
  persist();
}
function finish() { if (stopping) return; stopping = true; recording.endedAt = new Date().toISOString(); persist(); exportReplay(recordingPath, htmlPath); const stamp=recording.startedAt.replace(/[:.]/g,"-");const slug=(recording.title||"session").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"session";copyFileSync(recordingPath,join(recordingsDir,`${stamp}-${slug}.herdr-replay.json`));copyFileSync(htmlPath,join(recordingsDir,`${stamp}-${slug}.html`));try { writeFileSync(pidPath, "", "utf8"); } catch {} process.exit(0); }
process.on("SIGTERM", finish); process.on("SIGINT", finish);
writeFileSync(pidPath, String(process.pid), "utf8");
try { sample(); } catch (error) { recording.events.push({ at:new Date().toISOString(), type:"recorder.error", message:error.message }); persist(); }
setInterval(() => { try { sample(); } catch (error) { recording.events.push({ at:new Date().toISOString(), type:"recorder.error", message:error.message }); persist(); } }, interval);
