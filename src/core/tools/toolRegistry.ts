export interface ToolContext {
  vaultPath: string;
  autoGitCommit?: boolean;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface WorkOSTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  execute(args: any, context: ToolContext): Promise<ToolResult>;
}

export class ToolRegistry {
  private tools: Map<string, WorkOSTool> = new Map();

  public register(tool: WorkOSTool) {
    this.tools.set(tool.name, tool);
  }

  public get(name: string): WorkOSTool | undefined {
    return this.tools.get(name);
  }

  public getAll(): WorkOSTool[] {
    return Array.from(this.tools.values());
  }

  public getMcpDefinitions(): Array<{ name: string; description: string; inputSchema: any }> {
    return this.getAll().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  public async execute(name: string, args: any, context: ToolContext): Promise<ToolResult> {
    const tool = this.get(name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Unbekanntes Tool: ${name}` }],
        isError: true,
      };
    }
    try {
      return await tool.execute(args, context);
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Fehler bei Ausführung von ${name}: ${err.message}` }],
        isError: true,
      };
    }
  }
}
