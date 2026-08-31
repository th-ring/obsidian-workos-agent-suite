# 🤖 Obsidian WorkOS Agent Suite

**Unified AI Agent & Skills Suite: Headless MCP Server, Universal CLI Runner (Codex, Claude, Antigravity, Ollama) & Obsidian Plugin Bridge.**

---

## ⚡ Architecture & Features

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        OBSIDIAN WORKOS AGENT SUITE                                     │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. UNIVERSAL SKILLS CORE:                                                              │
│    • workos_triage_inbox • workos_decompose_task • workos_create_workstream            │
│    • workos_vault_stats  • workos_lock_guard     • Atomic Git Turn-Commit              │
│                                                                                        │
│ 2. HEADLESS MCP SERVER (dist/mcp-server.js):                                           │
│    • Standard Model Context Protocol via JSON-RPC stdio                                │
│    • Seamless integration for Antigravity, Claude Code CLI, Codex & Cursor             │
│                                                                                        │
│ 3. OBSIDIAN PLUGIN BRIDGE (.obsidian/plugins/workos-agent-suite/):                     │
│    • 1-Click Dashboard actions with live floating progress modal                       │
│    • Multi-Engine Settings: Codex, Claude CLI, Antigravity, Ollama, Gemini, OpenAI     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start: Connect MCP to Claude Code / Antigravity

```bash
claude mcp add workos -- node "C:\path\to\obsidian-workos-agent-suite\dist\mcp-server.js" --vault "C:\path\to\vault"
```
