import { ToolRegistry } from "./toolRegistry";
import { StatsTool } from "./statsTool";
import { TriageTool } from "./triageTool";
import { DecomposeTool } from "./decomposeTool";
import { WorkstreamTool } from "./workstreamTool";
import { LockTool } from "./lockTool";

export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(new StatsTool());
  registry.register(new TriageTool());
  registry.register(new DecomposeTool());
  registry.register(new WorkstreamTool());
  registry.register(new LockTool());
  return registry;
}
