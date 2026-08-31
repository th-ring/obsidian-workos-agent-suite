import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { VaultStatsResult } from "../types";

export function getVaultStats(vaultPath: string): VaultStatsResult {
  const stats: VaultStatsResult = {
    inboxCount: 0,
    unprocessedInboxCount: 0,
    totalTasks: 0,
    tasksByStatus: {
      inbox: 0,
      backlog: 0,
      todo: 0,
      in_progress: 0,
      blocked: 0,
      done: 0,
      archived: 0,
    },
    tasksByPriority: {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    },
    activeWorkstreams: [],
    totalNotes: 0,
    activeLocksCount: 0,
  };

  // 1. Scan 00_Inbox
  const inboxDir = path.join(vaultPath, "00_Inbox");
  if (fs.existsSync(inboxDir)) {
    const files = fs.readdirSync(inboxDir).filter((f) => f.endsWith(".md"));
    stats.inboxCount = files.length;
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(inboxDir, file), "utf8");
        const parsed = matter(raw);
        if (parsed.data?.status === "unprocessed") {
          stats.unprocessedInboxCount++;
        }
        if (parsed.data?.agent_state === "processing") {
          stats.activeLocksCount++;
        }
      } catch {}
    }
  }

  // 2. Scan 10_Tasks
  const tasksDir = path.join(vaultPath, "10_Tasks");
  if (fs.existsSync(tasksDir)) {
    const files = fs.readdirSync(tasksDir).filter((f) => f.endsWith(".md"));
    stats.totalTasks += files.length;
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(tasksDir, file), "utf8");
        const parsed = matter(raw);
        const status = parsed.data?.status || "todo";
        const priority = parsed.data?.priority || "medium";

        if (stats.tasksByStatus[status] !== undefined) {
          stats.tasksByStatus[status]++;
        }
        if (stats.tasksByPriority[priority] !== undefined) {
          stats.tasksByPriority[priority]++;
        }
        if (parsed.data?.agent_state === "processing") {
          stats.activeLocksCount++;
        }
      } catch {}
    }
  }

  // 3. Scan 20_Workstreams
  const workstreamsDir = path.join(vaultPath, "20_Workstreams");
  if (fs.existsSync(workstreamsDir)) {
    const streamFolders = fs
      .readdirSync(workstreamsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const stream of streamFolders) {
      const streamPath = path.join(workstreamsDir, stream);
      const readmePath = path.join(streamPath, "README.md");
      if (fs.existsSync(readmePath)) {
        try {
          const raw = fs.readFileSync(readmePath, "utf8");
          const parsed = matter(raw);
          if (parsed.data?.status === "active" || !parsed.data?.status) {
            stats.activeWorkstreams.push(stream);
          }
          if (parsed.data?.agent_state === "processing") {
            stats.activeLocksCount++;
          }
        } catch {
          stats.activeWorkstreams.push(stream);
        }
      }

      // Also check subtasks in 20_Workstreams/<Name>/Tasks/
      const streamTasksDir = path.join(streamPath, "Tasks");
      if (fs.existsSync(streamTasksDir)) {
        const subTasks = fs.readdirSync(streamTasksDir).filter((f) => f.endsWith(".md"));
        stats.totalTasks += subTasks.length;
        for (const st of subTasks) {
          try {
            const raw = fs.readFileSync(path.join(streamTasksDir, st), "utf8");
            const parsed = matter(raw);
            const status = parsed.data?.status || "todo";
            const priority = parsed.data?.priority || "medium";
            if (stats.tasksByStatus[status] !== undefined) stats.tasksByStatus[status]++;
            if (stats.tasksByPriority[priority] !== undefined) stats.tasksByPriority[priority]++;
            if (parsed.data?.agent_state === "processing") stats.activeLocksCount++;
          } catch {}
        }
      }
    }
  }

  // 4. Scan 30_Notes
  const notesDir = path.join(vaultPath, "30_Notes");
  if (fs.existsSync(notesDir)) {
    const files = fs.readdirSync(notesDir).filter((f) => f.endsWith(".md"));
    stats.totalNotes = files.length;
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(notesDir, file), "utf8");
        const parsed = matter(raw);
        if (parsed.data?.agent_state === "processing") {
          stats.activeLocksCount++;
        }
      } catch {}
    }
  }

  return stats;
}
