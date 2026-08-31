import { safeGitCommit } from "../git";
import { createWorkstream } from "../workstream";
import { ToolContext, ToolResult, WorkOSTool } from "./toolRegistry";

export class WorkstreamTool implements WorkOSTool {
  name = "workos_create_workstream";
  description = "Erstellt eine neue gekapselte Initiative in 20_Workstreams/<Name> inklusive README.md, AGENTS.md, Tasks/ und Notes/.";
  inputSchema = {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string", description: "Name des Workstreams (Ordnername)" },
      title: { type: "string", description: "Vollständiger Titel" },
      priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
      personaDescription: { type: "string", description: "Lokale Persona-Richtlinie für AGENTS.md" },
      tags: { type: "array", items: { type: "string" } },
    },
  };

  async execute(args: any, context: ToolContext): Promise<ToolResult> {
    const result = createWorkstream(context.vaultPath, args.name, args);
    if (context.autoGitCommit !== false) {
      await safeGitCommit(`feat(agent): created workstream ${args.name}`, context.vaultPath);
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
}
