import test from "node:test";
import assert from "node:assert/strict";
import { diffAgents, parseCliJson, redact } from "../src/core.mjs";
import { renderReplay } from "../src/render.mjs";

test("redact removes common credentials",()=>{const value=redact("Authorization: Bearer abc.def.ghi api_key=secret123 sk-abcdefghijklmnopqrstuvwxyz");assert.doesNotMatch(value,/abc\.def|secret123|sk-abc/);assert.match(value,/\[REDACTED\]/)});
test("parseCliJson extracts snapshots",()=>{assert.deepEqual(parseCliJson('{"result":{"snapshot":{"agents":[]}}}'),{agents:[]})});
test("diffAgents emits discoveries and transitions",()=>{const a={pane_id:"w1:p1",workspace_id:"w1",agent:"codex",agent_status:"idle",state_change_seq:1,cwd:"/repo"};assert.equal(diffAgents([], [a]).at(0).type,"agent.discovered");const events=diffAgents([a],[{...a,agent_status:"working",state_change_seq:2}]);assert.equal(events[0].type,"agent.state");assert.equal(events[0].status,"working")});
test("renderReplay returns self-contained interactive HTML",()=>{const html=renderReplay({title:"demo",startedAt:"2026-01-01T00:00:00Z",endedAt:"2026-01-01T00:01:00Z",agents:[],events:[]});assert.match(html,/<!doctype html>/);assert.match(html,/herdr replay \/ demo/);assert.match(html,/type="range"/)});
