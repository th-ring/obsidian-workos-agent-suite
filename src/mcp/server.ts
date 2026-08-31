import readline from "readline";
import path from "path";
import fs from "fs";
import { getVaultStats } from "../core/stats";
import { listUnprocessedInbox, executeTriageAction } from "../core/triage";
import { decomposeTask } from "../core/decompose";
import { createWorkstream } from "../core/workstream";
import { setFileLock, releaseFileLock, isFileLocked } from "../core/lock";
import { safeGitCommit } from "../core/git";

// Resolve vault path from CLI arg --vault or environment or cwd
let vaultPath = process.cwd();
const vaultArgIdx = process.argv.indexOf("--vault");
if (vaultArgIdx !== -1 && process.argv[vaultArgIdx + 1]) {
  vaultPath = path.resolve(process.argv[vaultArgIdx + 1]);
} else if (fs.existsSync(path.join(process.cwd(), "00_Inbox"))) {
  vaultPath = process.cwd();
} else if (fs.existsSync(path.resolve("../Obsidian WorkOS/00_Inbox"))) {
  vaultPath = path.resolve("../Obsidian WorkOS");
}

const TOOLS = [
  {
    name: "workos_vault_stats",
    description: "Liefert aktuelle Metriken des Obsidian WorkOS Vaults (Inbox-Status, Task-Verteilung nach Priorität/Status, aktive Workstreams und Sperren).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "workos_triage_inbox",
    description: "Scannt 00_Inbox/ und verarbeitet eine oder alle unstrukturierten Notizen zu Tasks, Wissensnotizen oder Workstreams.",
    inputSchema: {
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
    },
  },
  {
    name: "workos_decompose_task",
    description: "Ergänzt konkrete Checkbox-Teilaufgaben (- [ ]) zu einem bestehenden Task in 10_Tasks/ oder 20_Workstreams/<Name>/Tasks/.",
    inputSchema: {
      type: "object",
      required: ["taskRelativePath", "subtasks"],
      properties: {
        taskRelativePath: {
          type: "string",
          description: "Relativer Pfad zum Task, z.B. '10_Tasks/Payment-fixen.md'",
        },
        subtasks: {
          type: "array",
          items: { type: "string" },
          description: "Liste der hinzuzufügenden Teilaufgaben",
        },
      },
    },
  },
  {
    name: "workos_create_workstream",
    description: "Erstellt eine neue gekapselte Initiative in 20_Workstreams/<Name> inklusive README.md, AGENTS.md, Tasks/ und Notes/.",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", description: "Name des Workstreams (Ordnername)" },
        title: { type: "string", description: "Vollständiger Titel" },
        priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
        personaDescription: { type: "string", description: "Lokale Persona-Richtlinie für AGENTS.md" },
        tags: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "workos_lock_guard",
    description: "Setzt oder löst den Concurrency-Schreibschutz (Agent Lock Guard) auf einer Datei.",
    inputSchema: {
      type: "object",
      required: ["relativePath", "action"],
      properties: {
        relativePath: { type: "string", description: "Relativer Dateipfad im Vault (z.B. '10_Tasks/Task-1.md')" },
        action: { type: "string", enum: ["lock", "unlock", "check"] },
        agentName: { type: "string", description: "Name des Agenten (z.B. 'agent:claude' oder 'agent:antigravity')" },
      },
    },
  },
];

async function handleToolCall(name: string, args: any): Promise<any> {
  switch (name) {
    case "workos_vault_stats": {
      const stats = getVaultStats(vaultPath);
      return {
        content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
      };
    }

    case "workos_triage_inbox": {
      const unprocessed = listUnprocessedInbox(vaultPath);
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
        // Return file contents for LLM to decide
        return {
          content: [
            {
              type: "text",
              text: `Unstrukturierte Notiz gefunden:\nDatei: ${target.file}\nTitel: ${target.data.title || "Ohne Titel"}\nInhalt:\n${target.content}\n\nBitte rufe workos_triage_inbox erneut mit dem 'decision'-Objekt auf.`,
            },
          ],
        };
      }

      const result = executeTriageAction(vaultPath, target.path, args.decision);
      await safeGitCommit(`feat(agent): triaged ${target.file} to ${result.action} [${result.title}]`, vaultPath);

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    case "workos_decompose_task": {
      const fullPath = path.isAbsolute(args.taskRelativePath)
        ? args.taskRelativePath
        : path.join(vaultPath, args.taskRelativePath);

      const result = decomposeTask(fullPath, args.subtasks);
      if (result.success) {
        await safeGitCommit(`feat(agent): decomposed task ${path.basename(fullPath)} into ${args.subtasks.length} subtasks`, vaultPath);
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    case "workos_create_workstream": {
      const result = createWorkstream(vaultPath, args.name, args);
      await safeGitCommit(`feat(agent): created workstream ${args.name}`, vaultPath);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    case "workos_lock_guard": {
      const fullPath = path.isAbsolute(args.relativePath)
        ? args.relativePath
        : path.join(vaultPath, args.relativePath);

      if (args.action === "lock") {
        const locked = setFileLock(fullPath, args.agentName || "agent:mcp");
        return { content: [{ type: "text", text: locked ? `🔒 Gesperrt: ${args.relativePath}` : `Fehler beim Sperren von ${args.relativePath}` }] };
      } else if (args.action === "unlock") {
        const unlocked = releaseFileLock(fullPath);
        return { content: [{ type: "text", text: unlocked ? `🔓 Freigegeben: ${args.relativePath}` : `Fehler beim Freigeben von ${args.relativePath}` }] };
      } else {
        const locked = isFileLocked(fullPath);
        return { content: [{ type: "text", text: `Status von ${args.relativePath}: ${locked ? "GESPERRT" : "FREI"}` }] };
      }
    }

    default:
      return {
        content: [{ type: "text", text: `Unbekanntes Tool: ${name}` }],
        isError: true,
      };
  }
}

// JSON-RPC stdio Handler
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", async (line) => {
  if (!line.trim()) return;
  try {
    const req = JSON.parse(line);
    const id = req.id;

    if (req.method === "initialize") {
      const res = {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "workos-mcp-server",
            version: "1.0.0",
          },
        },
      };
      process.stdout.write(JSON.stringify(res) + "\n");
    } else if (req.method === "notifications/initialized") {
      // Acknowledgement, no response required
    } else if (req.method === "ping") {
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result: {} }) + "\n");
    } else if (req.method === "tools/list") {
      const res = {
        jsonrpc: "2.0",
        id,
        result: { tools: TOOLS },
      };
      process.stdout.write(JSON.stringify(res) + "\n");
    } else if (req.method === "tools/call") {
      const toolName = req.params?.name;
      const toolArgs = req.params?.arguments || {};
      const result = await handleToolCall(toolName, toolArgs);
      const res = {
        jsonrpc: "2.0",
        id,
        result,
      };
      process.stdout.write(JSON.stringify(res) + "\n");
    } else {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${req.method}` },
        }) + "\n"
      );
    }
  } catch (err: any) {
    process.stderr.write(`MCP Parsing Error: ${err.message}\n`);
  }
});
