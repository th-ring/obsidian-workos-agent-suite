import { getVaultStats } from "../stats";
import { ToolContext, ToolResult, WorkOSTool } from "./toolRegistry";

export class StatsTool implements WorkOSTool {
  name = "workos_vault_stats";
  description = "Liefert aktuelle Metriken des Obsidian WorkOS Vaults (Inbox-Status, Task-Verteilung nach Priorität/Status, aktive Workstreams und Sperren).";
  inputSchema = {
    type: "object",
    properties: {},
  };

  async execute(_args: any, context: ToolContext): Promise<ToolResult> {
    const stats = getVaultStats(context.vaultPath);
    return {
      content: [{ type: "text", text: JSON.stringify(stats, null, 2) }],
    };
  }
}
