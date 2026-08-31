import esbuild from "esbuild";
import process from "process";
import fs from "fs";
import path from "path";
import builtinModules from "builtin-modules";

const prod = process.argv[2] !== "dev";

// Target directories
const vaultPluginDir = path.resolve("../Obsidian WorkOS/.obsidian/plugins/workos-agent-suite");
const localDistDir = path.resolve("./dist");

[vaultPluginDir, localDistDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Copy manifest.json & styles.css
function copyAssets() {
  const manifestSrc = path.resolve("./manifest.json");
  const stylesSrc = path.resolve("./src/styles.css");

  [vaultPluginDir, localDistDir].forEach(targetDir => {
    if (fs.existsSync(manifestSrc)) {
      let content = fs.readFileSync(manifestSrc, "utf8");
      if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
      fs.writeFileSync(path.join(targetDir, "manifest.json"), content, "utf8");
    }
    if (fs.existsSync(stylesSrc)) {
      let content = fs.readFileSync(stylesSrc, "utf8");
      if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
      fs.writeFileSync(path.join(targetDir, "styles.css"), content, "utf8");
    }
  });
  console.log("Assets copied cleanly to Vault plugin folder and dist.");
}

copyAssets();

// 1. Build Target: Obsidian Plugin
const pluginContext = await esbuild.context({
  banner: {
    js: `/* WorkOS Agent Suite - Obsidian Plugin */\n`,
  },
  entryPoints: ["src/plugin/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtinModules
  ],
  format: "cjs",
  target: "es2022",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: path.join(vaultPluginDir, "main.js"),
});

// 2. Build Target: Headless MCP Server
const mcpContext = await esbuild.context({
  banner: {
    js: `#!/usr/bin/env node\n/* WorkOS Agent Suite - Headless MCP Server */\n`,
  },
  entryPoints: ["src/mcp/server.ts"],
  bundle: true,
  platform: "node",
  external: [...builtinModules],
  format: "cjs",
  target: "node18",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: path.join(localDistDir, "mcp-server.js"),
});

if (prod) {
  await pluginContext.rebuild();
  await pluginContext.dispose();

  await mcpContext.rebuild();
  await mcpContext.dispose();

  // Also copy main.js to local dist
  if (fs.existsSync(path.join(vaultPluginDir, "main.js"))) {
    fs.copyFileSync(path.join(vaultPluginDir, "main.js"), path.join(localDistDir, "plugin-main.js"));
  }

  console.log("Production build finished successfully for all targets!");
} else {
  await pluginContext.watch();
  await mcpContext.watch();
  console.log("Watching for changes...");
}
