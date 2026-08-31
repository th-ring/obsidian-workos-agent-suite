import { safeGitCommit } from "../git";
import { executeTriageAction, listUnprocessedInbox } from "../triage";
import { ToolContext, ToolResult, WorkOSTool } from "./toolRegistry";

export class TriageTool implements WorkOSTool {
  name = "workos_triage_inbox";
  description = "Scannt 00_Inbox/ und verarbeitet eine oder alle unstrukturierten Notizen zu Tasks, Wissensnotizen oder Workstreams.";
  inputSchema = {
    type: "object",
    properties: {
      sourceFileName: {
        type: "string",
        description: "Optional: Spezifischer Dateiname in 00_Inbox/ (z.B. 'meeting.md'). Wenn weggelassen, wird der erste unstrukturierte Eintrag verarbeitet.",
      },
      decision: {
        type: "object",
        description: "Entscheidung der KI zur Umwandlung",
        required: ["type", "title"],
        properties: {
          type: { type: "string", enum: ["task", "note", "workstream", "archive"] },
          title: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
          workstream: { type: "string", description: "Zugehöriger Workstream z.B. 'Obsidian-WorkOS-Launch'" },
          category: { type: "string", enum: ["architecture", "concept", "meeting", "reference", "snippet", "general"] },
          due: { type: "string", description: "Fälligkeitsdatum YYYY-MM-DD" },
          tags: { type: "array", items: { type: "string" } },
          subtasks: { type: "array", items: { type: "string" } },
        },
      },
    },
  };

  async execute(args: any, context: ToolContext): Promise<ToolResult> {
    const unprocessed = listUnprocessedInbox(context.vaultPath);
    if (unprocessed.length === 0) {
      return {
        content: [{ type: "text", text: "Die Inbox ist leer! Keine unstrukturierten Notizen gefunden." }],
      };
    }

    const target = args.sourceFileName
      ? unprocessed.find((u) => u.file === args.sourceFileName || u.path.endsWith(args.sourceFileName))
      : unprocessed[0];

    if (!target) {
      return {
        content: [{ type: "text", text: `Datei '${args.sourceFileName}' nicht in der Inbox gefunden.` }],
        isError: true,
      };
    }

    if (!args.decision) {
      return {
        content: [
          {
            type: "text",
            text: `Unstrukturierte Notiz gefunden:\nDatei: ${target.file}\nTitel: ${target.data.title || "Ohne Titel"}\nInhalt:\n${target.content}\n\nBitte rufe workos_triage_inbox erneut mit dem 'decision'-Objekt auf.`,
          },
        ],
      };
    }

    const result = executeTriageAction(context.vaultPath, target.path, args.decision);
    if (context.autoGitCommit !== false) {
      await safeGitCommit(`feat(agent): triaged ${target.file} to ${result.action} [${result.title}]`, context.vaultPath);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
}
