import fs from "fs";
import matter from "gray-matter";
import { DecomposeResult } from "../types";

export function decomposeTask(
  filePath: string,
  newSubtasks: string[],
  options: {
    agentName?: string;
    reviewStatus?: "pending" | "approved";
  } = {}
): DecomposeResult {
  if (!fs.existsSync(filePath)) {
    return {
      taskPath: filePath,
      title: "",
      subtasks: [],
      success: false,
      message: `Datei nicht gefunden: ${filePath}`,
    };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = matter(raw);

    const title = parsed.data.title || "Aufgabe";

    // Update frontmatter
    parsed.data.assigned_to = parsed.data.assigned_to === "user" ? "hybrid" : parsed.data.assigned_to || "hybrid";
    parsed.data.review_status = options.reviewStatus || "pending";
    parsed.data.agent_state = "idle";

    // Format subtasks into markdown
    const formattedCheckboxes = newSubtasks
      .map((st) => (st.startsWith("- [ ]") || st.startsWith("- [x]") ? st : `- [ ] ${st}`))
      .join("\n");

    let content = parsed.content;

    // If ## Subtasks section exists, append or insert
    if (content.includes("## Subtasks")) {
      content = content.replace(
        /## Subtasks([\s\S]*?)(##|$)/,
        (match: string, existingSubtasks: string, nextSection: string) => {
          const combined = `${existingSubtasks.trim()}\n${formattedCheckboxes}`.trim();
          return `## Subtasks\n${combined}\n\n${nextSection}`;
        }
      );
    } else {
      content = `${content.trim()}\n\n## Subtasks\n${formattedCheckboxes}\n`;
    }

    const output = matter.stringify(content.trim(), parsed.data);
    fs.writeFileSync(filePath, output, "utf8");

    return {
      taskPath: filePath,
      title,
      subtasks: newSubtasks,
      success: true,
      message: `${newSubtasks.length} Teilaufgaben erfolgreich hinzugefügt.`,
    };
  } catch (err: any) {
    return {
      taskPath: filePath,
      title: "",
      subtasks: [],
      success: false,
      message: `Fehler beim Zerlegen der Aufgabe: ${err.message}`,
    };
  }
}
