import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { TriageItemResult, TriageResult } from "../types";
import { createWorkstream } from "./workstream";

export function listUnprocessedInbox(vaultPath: string): { file: string; path: string; data: any; content: string }[] {
  const inboxDir = path.join(vaultPath, "00_Inbox");
  if (!fs.existsSync(inboxDir)) return [];

  const files = fs.readdirSync(inboxDir).filter((f: string) => f.endsWith(".md"));
  const items: { file: string; path: string; data: any; content: string }[] = [];

  for (const file of files) {
    const fullPath = path.join(inboxDir, file);
    try {
      const raw = fs.readFileSync(fullPath, "utf8");
      const parsed = matter(raw);
      if (parsed.data?.status === "unprocessed" || !parsed.data?.status) {
        items.push({
          file,
          path: fullPath,
          data: parsed.data || {},
          content: parsed.content,
        });
      }
    } catch {}
  }
  return items;
}

export function executeTriageAction(
  vaultPath: string,
  sourceFilePath: string,
  decision: {
    type: "task" | "note" | "workstream" | "archive";
    title: string;
    priority?: "low" | "medium" | "high" | "urgent";
    workstream?: string;
    category?: string;
    due?: string;
    tags?: string[];
    subtasks?: string[];
    reviewStatus?: "pending" | "approved";
  }
): TriageItemResult {
  const raw = fs.readFileSync(sourceFilePath, "utf8");
  const { data, content } = matter(raw);

  const today = new Date().toISOString().split("T")[0];
  const sanitizedTitle = (decision.title || data.title || path.basename(sourceFilePath, ".md"))
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim();

  let targetPath = "";
  const archiveDir = path.join(vaultPath, "40_Archive");
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

  const cleanStream = decision.workstream ? decision.workstream.replace(/[\[\]]/g, "").trim() : null;
  const formattedStream = cleanStream ? `[[${cleanStream}]]` : null;

  if (decision.type === "task") {
    // 1. Create Task in 20_Workstreams/<Name>/Tasks or 10_Tasks
    let targetDir = path.join(vaultPath, "10_Tasks");
    if (cleanStream) {
      targetDir = path.join(vaultPath, "20_Workstreams", cleanStream, "Tasks");
    }
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    targetPath = path.join(targetDir, `${sanitizedTitle}.md`);

    const taskFrontmatter = {
      type: "task",
      title: decision.title || sanitizedTitle,
      status: "todo",
      priority: decision.priority || "medium",
      workstream: formattedStream,
      due: decision.due || null,
      created: today,
      tags: decision.tags || data.tags || [],
      assigned_to: "hybrid",
      review_status: decision.reviewStatus || "pending",
      agent_state: "idle",
    };

    let body = content.trim();
    if (decision.subtasks && decision.subtasks.length > 0) {
      const subtaskBoxes = decision.subtasks.map((st) => `- [ ] ${st}`).join("\n");
      body = `${body}\n\n## Subtasks\n${subtaskBoxes}`;
    }

    fs.writeFileSync(targetPath, matter.stringify(body, taskFrontmatter), "utf8");

    // Move source to archive
    const archivedSource = path.join(archiveDir, path.basename(sourceFilePath));
    data.status = "triaged";
    data.triaged_to = `[[${sanitizedTitle}]]`;
    data.agent_state = "idle";
    delete data.locked_by;
    delete data.locked_at;
    fs.writeFileSync(archivedSource, matter.stringify(content, data), "utf8");
    fs.unlinkSync(sourceFilePath);

    return {
      sourceFile: path.basename(sourceFilePath),
      action: "task_created",
      targetPath,
      title: sanitizedTitle,
      workstream: formattedStream || undefined,
      priority: decision.priority,
      summary: `In Aufgabe "${sanitizedTitle}" unter ${path.relative(vaultPath, targetDir)} umgewandelt und archiviert.`,
    };
  } else if (decision.type === "note") {
    // 2. Create Knowledge Note in 20_Workstreams/<Name>/Notes or 30_Notes
    let targetDir = path.join(vaultPath, "30_Notes");
    if (cleanStream) {
      targetDir = path.join(vaultPath, "20_Workstreams", cleanStream, "Notes");
    }
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    targetPath = path.join(targetDir, `${sanitizedTitle}.md`);

    const noteFrontmatter = {
      type: "note",
      title: decision.title || sanitizedTitle,
      category: decision.category || "concept",
      workstream: formattedStream,
      created: today,
      updated: today,
      tags: decision.tags || data.tags || [],
      agent_state: "idle",
    };

    fs.writeFileSync(targetPath, matter.stringify(content.trim(), noteFrontmatter), "utf8");

    // Move source to archive
    const archivedSource = path.join(archiveDir, path.basename(sourceFilePath));
    data.status = "triaged";
    data.triaged_to = `[[${sanitizedTitle}]]`;
    data.agent_state = "idle";
    delete data.locked_by;
    delete data.locked_at;
    fs.writeFileSync(archivedSource, matter.stringify(content, data), "utf8");
    fs.unlinkSync(sourceFilePath);

    return {
      sourceFile: path.basename(sourceFilePath),
      action: "note_created",
      targetPath,
      title: sanitizedTitle,
      workstream: formattedStream || undefined,
      summary: `In Wissensnotiz "${sanitizedTitle}" unter ${path.relative(vaultPath, targetDir)} umgewandelt und archiviert.`,
    };
  } else if (decision.type === "workstream") {
    // 3. Create Workstream
    const result = createWorkstream(vaultPath, sanitizedTitle, {
      title: decision.title,
      priority: decision.priority,
      tags: decision.tags,
    });

    // Move source to archive
    const archivedSource = path.join(archiveDir, path.basename(sourceFilePath));
    data.status = "triaged";
    data.triaged_to = `[[${sanitizedTitle}]]`;
    data.agent_state = "idle";
    delete data.locked_by;
    delete data.locked_at;
    fs.writeFileSync(archivedSource, matter.stringify(content, data), "utf8");
    fs.unlinkSync(sourceFilePath);

    return {
      sourceFile: path.basename(sourceFilePath),
      action: "workstream_created",
      targetPath: result.readmePath,
      title: sanitizedTitle,
      summary: `Neuen Workstream "20_Workstreams/${sanitizedTitle}" angelegt und archiviert.`,
    };
  } else {
    // 4. Pure archive
    const archivedSource = path.join(archiveDir, path.basename(sourceFilePath));
    data.status = "archived";
    data.agent_state = "idle";
    delete data.locked_by;
    delete data.locked_at;
    fs.writeFileSync(archivedSource, matter.stringify(content, data), "utf8");
    fs.unlinkSync(sourceFilePath);

    return {
      sourceFile: path.basename(sourceFilePath),
      action: "archived",
      targetPath: archivedSource,
      title: sanitizedTitle,
      summary: `Ins Archiv verschoben.`,
    };
  }
}
