import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export function redact(text) {
  return String(text)
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi, "$1[REDACTED]")
    .replace(/\b(api[_-]?key|token|password|secret)\s*[:=]\s*([^\s'\"]+)/gi, "$1=[REDACTED]")
    .replace(/\b(sk-[A-Za-z0-9_-]{12,})\b/g, "[REDACTED]");
}

export function digest(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

export function parseCliJson(output) {
  const parsed = JSON.parse(output);
  return parsed.result?.snapshot || parsed.result || parsed;
}

export function diffAgents(previous = [], current = [], at = new Date().toISOString()) {
  const before = new Map(previous.map((agent) => [agent.pane_id, agent]));
  const events = [];
  for (const agent of current) {
    const old = before.get(agent.pane_id);
    if (!old) {
      events.push({ at, type: "agent.discovered", paneId: agent.pane_id, workspaceId: agent.workspace_id, agent: agent.agent, status: agent.agent_status, cwd: agent.cwd });
    } else if (old.agent_status !== agent.agent_status || old.state_change_seq !== agent.state_change_seq) {
      events.push({ at, type: "agent.state", paneId: agent.pane_id, workspaceId: agent.workspace_id, agent: agent.agent, from: old.agent_status, status: agent.agent_status, cwd: agent.cwd });
    }
    before.delete(agent.pane_id);
  }
  for (const old of before.values()) events.push({ at, type: "agent.closed", paneId: old.pane_id, workspaceId: old.workspace_id, agent: old.agent, status: old.agent_status, cwd: old.cwd });
  return events;
}

export function gitEvidence(cwd, runner = execFileSync) {
  if (!cwd) return null;
  try {
    const root = runner("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const branch = runner("git", ["-C", root, "branch", "--show-current"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const changes = runner("git", ["-C", root, "status", "--short"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").filter(Boolean).slice(0, 100);
    const head = runner("git", ["-C", root, "log", "-1", "--pretty=%H%x1f%s"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return { root, branch, changes, head };
  } catch { return null; }
}
