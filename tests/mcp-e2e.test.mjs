import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

test("WorkOS MCP Server CLI E2E Test", async (t) => {
  const tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), "workos-test-vault-"));
  fs.mkdirSync(path.join(tmpVault, "00_Inbox"), { recursive: true });
  fs.mkdirSync(path.join(tmpVault, "10_Tasks"), { recursive: true });

  t.after(() => {
    fs.rmSync(tmpVault, { recursive: true, force: true });
  });

  await t.test("1. workos_vault_stats via MCP JSON-RPC stdio", () => {
    const input = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "workos_vault_stats", arguments: {} } });
    const output = execSync(`node dist/mcp-server.js --vault "${tmpVault}"`, { input, encoding: "utf8" });
    const res = JSON.parse(output);
    assert.equal(res.id, 1);
    const stats = JSON.parse(res.result.content[0].text);
    assert.equal(stats.totalTasks, 0);
    assert.equal(stats.inboxCount, 0);
  });

  await t.test("2. tools/list returns all 5 MCP tools", () => {
    const input = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const output = execSync(`node dist/mcp-server.js --vault "${tmpVault}"`, { input, encoding: "utf8" });
    const res = JSON.parse(output);
    assert.equal(res.result.tools.length, 5);
    const toolNames = res.result.tools.map((t) => t.name);
    assert.ok(toolNames.includes("workos_vault_stats"));
    assert.ok(toolNames.includes("workos_triage_inbox"));
    assert.ok(toolNames.includes("workos_decompose_task"));
    assert.ok(toolNames.includes("workos_create_workstream"));
    assert.ok(toolNames.includes("workos_lock_guard"));
  });
});
