import readline from "readline";
import path from "path";
import fs from "fs";
import { createDefaultToolRegistry } from "../core/tools/defaultRegistry";

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

const registry = createDefaultToolRegistry();

// JSON-RPC stdio Handler
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on("line", async (line: string) => {
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
        result: { tools: registry.getMcpDefinitions() },
      };
      process.stdout.write(JSON.stringify(res) + "\n");
    } else if (req.method === "tools/call") {
      const toolName = req.params?.name;
      const toolArgs = req.params?.arguments || {};
      const result = await registry.execute(toolName, toolArgs, { vaultPath, autoGitCommit: true });
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
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: `Parse error: ${err.message}` },
      }) + "\n"
    );
  }
});
