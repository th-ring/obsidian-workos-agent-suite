# 🛠️ Developer & Extension Guide: WorkOS Agent Suite

This guide explains how to maintain, test, and extend the **WorkOS Agent Suite**.

---

## 🏛️ Architecture Overview

The codebase is built on modular, decoupled registries:

```text
src/
├── core/
│   ├── tools/
│   │   ├── toolRegistry.ts      # Extensible WorkOSTool interface & registry
│   │   ├── statsTool.ts         # workos_vault_stats
│   │   ├── triageTool.ts        # workos_triage_inbox
│   │   ├── decomposeTool.ts     # workos_decompose_task
│   │   ├── workstreamTool.ts    # workos_create_workstream
│   │   ├── lockTool.ts          # workos_lock_guard
│   │   └── defaultRegistry.ts   # Factory instantiating all tools
│   ├── git.ts                   # Atomic Turn-Commit helper
│   ├── lock.ts                  # Concurrency lock modifier
│   ├── stats.ts                 # Vault scanner & metrics aggregator
│   ├── triage.ts                # Triage execution engine
│   ├── decompose.ts             # Task checkbox decomposition
│   └── workstream.ts            # Workstream scaffolding
│
├── engines/
│   ├── baseEngine.ts            # WorkOSEngine interface
│   ├── ollamaEngine.ts          # Local Ollama runner
│   ├── cliEngine.ts             # Headless Codex / Claude / Antigravity CLI runner
│   ├── cloudEngine.ts           # Gemini, Anthropic, OpenAI cloud runner
│   └── runner.ts                # Multi-engine orchestrator
│
├── mcp/
│   └── server.ts                # Headless JSON-RPC MCP Server (stdio)
│
└── plugin/
    ├── main.ts                  # Obsidian Plugin entry point
    ├── settings.ts              # Settings Tab UI
    └── progressModal.ts         # Live execution progress modal
```

---

## ➕ How to Add a New MCP Tool / Skill

1. Create a new file in `src/core/tools/myCustomTool.ts` implementing `WorkOSTool`:
   ```typescript
   import { ToolContext, ToolResult, WorkOSTool } from "./toolRegistry";

   export class MyCustomTool implements WorkOSTool {
     name = "workos_my_custom_tool";
     description = "Description of what this tool does.";
     inputSchema = {
       type: "object",
       required: ["myParam"],
       properties: {
         myParam: { type: "string" },
       },
     };

     async execute(args: any, context: ToolContext): Promise<ToolResult> {
       return {
         content: [{ type: "text", text: "Result text" }],
       };
     }
   }
   ```
2. Register it in `src/core/tools/defaultRegistry.ts`:
   ```typescript
   registry.register(new MyCustomTool());
   ```
3. That's it! The tool is immediately exposed over MCP to Antigravity, Claude Code, and Codex without any other changes.

---

## ➕ How to Add a New AI Engine

1. Create a new file in `src/engines/myEngine.ts` implementing `WorkOSEngine`:
   ```typescript
   import { EngineResponse, WorkOSEngine } from "./baseEngine";

   export class MyEngine implements WorkOSEngine {
     name = "my_engine";
     async runPrompt(prompt: string, systemPrompt?: string): Promise<EngineResponse> {
       // Call your API or CLI
       return { success: true, content: "response" };
     }
   }
   ```
2. Register it in `src/engines/runner.ts`.

---

## 🧪 Testing & Building

```bash
# Install dependencies
npm install

# Run automated tests
npm test

# Build all targets (dist/mcp-server.js & .obsidian/plugins/workos-agent-suite/)
npm run build
```
