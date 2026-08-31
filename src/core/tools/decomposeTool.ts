import path from "path";
import { decomposeTask } from "../decompose";
import { safeGitCommit } from "../git";
import { ToolContext, ToolResult, WorkOSTool } from "./toolRegistry";

export class DecomposeTool implements WorkOSTool {
  name = "workos_decompose_task";
  description = "Ergänzt konkrete Checkbox-Teilaufgaben (- [ ]) zu einem bestehenden Task in 10_Tasks/ oder 20_Workstreams/<Name>/Tasks/.";
  inputSchema = {
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
  };

  async execute(args: any, context: ToolContext): Promise<ToolResult> {
    const fullPath = path.isAbsolute(args.taskRelativePath)
      ? args.taskRelativePath
      : path.join(context.vaultPath, args.taskRelativePath);

    const result = decomposeTask(fullPath, args.subtasks);
    if (result.success && context.autoGitCommit !== false) {
      await safeGitCommit(
        `feat(agent): decomposed task ${path.basename(fullPath)} into ${args.subtasks.length} subtasks`,
        context.vaultPath
      );
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
}
