import path from "path";
import { isFileLocked, releaseFileLock, setFileLock } from "../lock";
import { ToolContext, ToolResult, WorkOSTool } from "./toolRegistry";

export class LockTool implements WorkOSTool {
  name = "workos_lock_guard";
  description = "Setzt oder löst den Concurrency-Schreibschutz (Agent Lock Guard) auf einer Datei.";
  inputSchema = {
    type: "object",
    required: ["relativePath", "action"],
    properties: {
      relativePath: { type: "string", description: "Relativer Dateipfad im Vault (z.B. '10_Tasks/Task-1.md')" },
      action: { type: "string", enum: ["lock", "unlock", "check"] },
      agentName: { type: "string", description: "Name des Agenten (z.B. 'agent:claude' oder 'agent:antigravity')" },
    },
  };

  async execute(args: any, context: ToolContext): Promise<ToolResult> {
    const fullPath = path.isAbsolute(args.relativePath)
      ? args.relativePath
      : path.join(context.vaultPath, args.relativePath);

    if (args.action === "lock") {
      const locked = setFileLock(fullPath, args.agentName || "agent:mcp");
      return {
        content: [{ type: "text", text: locked ? `🔒 Gesperrt: ${args.relativePath}` : `Fehler beim Sperren von ${args.relativePath}` }],
      };
    } else if (args.action === "unlock") {
      const unlocked = releaseFileLock(fullPath);
      return {
        content: [{ type: "text", text: unlocked ? `🔓 Freigegeben: ${args.relativePath}` : `Fehler beim Freigeben von ${args.relativePath}` }],
      };
    } else {
      const locked = isFileLocked(fullPath);
      return {
        content: [{ type: "text", text: `Status von ${args.relativePath}: ${locked ? "GESPERRT" : "FREI"}` }],
      };
    }
  }
}
