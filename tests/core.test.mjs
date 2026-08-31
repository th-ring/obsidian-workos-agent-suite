import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createDefaultToolRegistry } from "../src/core/tools/defaultRegistry.ts";
import { createWorkstream } from "../src/core/workstream.ts";
import { decomposeTask } from "../src/core/decompose.ts";
import { setFileLock, releaseFileLock, isFileLocked } from "../src/core/lock.ts";

test("WorkOS Core & Tools Test Suite", async (t) => {
  const tmpVault = fs.mkdtempSync(path.join(os.tmpdir(), "workos-test-vault-"));

  t.after(() => {
    fs.rmSync(tmpVault, { recursive: true, force: true });
  });

  await t.test("1. ToolRegistry has 5 registered tools", () => {
    const registry = createDefaultToolRegistry();
    const tools = registry.getAll();
    assert.equal(tools.length, 5);
    const names = tools.map((t) => t.name);
    assert.ok(names.includes("workos_vault_stats"));
    assert.ok(names.includes("workos_triage_inbox"));
    assert.ok(names.includes("workos_decompose_task"));
    assert.ok(names.includes("workos_create_workstream"));
    assert.ok(names.includes("workos_lock_guard"));
  });

  await t.test("2. Workstream creation scaffolds correctly", () => {
    const res = createWorkstream(tmpVault, "Test-Stream", {
      title: "Test Initiative",
      priority: "high",
    });
    assert.equal(res.success, true);
    assert.ok(fs.existsSync(res.readmePath));
    assert.ok(fs.existsSync(res.agentsPath));
    assert.ok(fs.existsSync(path.join(tmpVault, "20_Workstreams", "Test-Stream", "Tasks")));
    assert.ok(fs.existsSync(path.join(tmpVault, "20_Workstreams", "Test-Stream", "Notes")));
  });

  await t.test("3. Concurrency Lock & Unlock", () => {
    const testFile = path.join(tmpVault, "test-lock.md");
    fs.writeFileSync(testFile, "---\ntype: task\ntitle: Lock Test\n---\nBody", "utf8");

    assert.equal(isFileLocked(testFile), false);
    setFileLock(testFile, "agent:test");
    assert.equal(isFileLocked(testFile), true);

    releaseFileLock(testFile);
    assert.equal(isFileLocked(testFile), false);
  });

  await t.test("4. Task Decomposition appends subtasks", () => {
    const testTask = path.join(tmpVault, "test-task.md");
    fs.writeFileSync(testTask, "---\ntype: task\ntitle: Decompose Test\n---\nInitial Content", "utf8");

    const res = decomposeTask(testTask, ["Subtask A", "Subtask B"]);
    assert.equal(res.success, true);
    const updated = fs.readFileSync(testTask, "utf8");
    assert.ok(updated.includes("- [ ] Subtask A"));
    assert.ok(updated.includes("- [ ] Subtask B"));
    assert.ok(updated.includes("review_status: pending"));
  });
});
