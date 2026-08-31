import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type WorkOSAgentSuitePlugin from "./main";
import { EngineRunner } from "../engines/runner";

export class AgentSuiteSettingTab extends PluginSettingTab {
  plugin: WorkOSAgentSuitePlugin;

  constructor(app: App, plugin: WorkOSAgentSuitePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "🤖 WorkOS Agent Suite Einstellungen" });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Konfiguriere KI-Engines (Codex, Claude Code, Antigravity, Ollama, Cloud APIs) und Skills für dein Obsidian WorkOS.",
    });

    // --------------------------------------------------------------------------
    // 1. ENGINE AUSWAHL
    // --------------------------------------------------------------------------
    containerEl.createEl("h3", { text: "🧠 Aktive KI-Engine" });

    new Setting(containerEl)
      .setName("Ausführungs-Engine")
      .setDesc("Wähle die Engine, die für 1-Klick-Aktionen (Triage, Zerlegung) verwendet werden soll.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("codex", "Codex CLI (OpenAI Codex / Terminal)")
          .addOption("claude", "Claude Code CLI (Anthropic)")
          .addOption("antigravity", "Antigravity CLI (agy)")
          .addOption("ollama", "Ollama (Lokal & 100% Offline)")
          .addOption("gemini", "Google Gemini API (Direkt)")
          .addOption("anthropic", "Anthropic Claude API (Direkt)")
          .addOption("openai", "OpenAI GPT-4o API (Direkt)")
          .setValue(this.plugin.settings.engine)
          .onChange(async (value: any) => {
            this.plugin.settings.engine = value;
            await this.plugin.saveSettings();
            this.display(); // Re-render to show relevant fields
          })
      );

    // Dynamic Engine Settings
    if (this.plugin.settings.engine === "codex") {
      new Setting(containerEl)
        .setName("Codex CLI Befehl")
        .setDesc("Pfad oder Befehlsname zum Ausführen von Codex im Terminal.")
        .addText((text) =>
          text
            .setPlaceholder("codex")
            .setValue(this.plugin.settings.codexCliCommand)
            .onChange(async (val) => {
              this.plugin.settings.codexCliCommand = val;
              await this.plugin.saveSettings();
            })
        );
    } else if (this.plugin.settings.engine === "claude") {
      new Setting(containerEl)
        .setName("Claude Code CLI Befehl")
        .setDesc("Befehlsname für Claude Code im Terminal.")
        .addText((text) =>
          text
            .setPlaceholder("claude")
            .setValue(this.plugin.settings.claudeCliCommand)
            .onChange(async (val) => {
              this.plugin.settings.claudeCliCommand = val;
              await this.plugin.saveSettings();
            })
        );
    } else if (this.plugin.settings.engine === "antigravity") {
      new Setting(containerEl)
        .setName("Antigravity CLI Befehl")
        .setDesc("Befehlsname für Antigravity im Terminal.")
        .addText((text) =>
          text
            .setPlaceholder("agy")
            .setValue(this.plugin.settings.antigravityCliCommand)
            .onChange(async (val) => {
              this.plugin.settings.antigravityCliCommand = val;
              await this.plugin.saveSettings();
            })
        );
    } else if (this.plugin.settings.engine === "ollama") {
      new Setting(containerEl)
        .setName("Ollama Server URL")
        .setDesc("Lokale URL des Ollama-Daemons.")
        .addText((text) =>
          text
            .setPlaceholder("http://localhost:11434")
            .setValue(this.plugin.settings.ollamaUrl)
            .onChange(async (val) => {
              this.plugin.settings.ollamaUrl = val;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName("Ollama Modell")
        .setDesc("Name des installierten Modells (z. B. llama3, mistral, qwen2.5, phi3).")
        .addText((text) =>
          text
            .setPlaceholder("llama3")
            .setValue(this.plugin.settings.ollamaModel)
            .onChange(async (val) => {
              this.plugin.settings.ollamaModel = val;
              await this.plugin.saveSettings();
            })
        );
    } else if (this.plugin.settings.engine === "gemini") {
      new Setting(containerEl)
        .setName("Google Gemini API Key")
        .setDesc("Dein Gemini API-Key (von aistudio.google.com).")
        .addText((text) =>
          text
            .setPlaceholder("AIzaSy...")
            .setValue(this.plugin.settings.geminiApiKey)
            .onChange(async (val) => {
              this.plugin.settings.geminiApiKey = val;
              await this.plugin.saveSettings();
            })
        );
    } else if (this.plugin.settings.engine === "anthropic") {
      new Setting(containerEl)
        .setName("Anthropic API Key")
        .setDesc("Dein Claude API-Key (von console.anthropic.com).")
        .addText((text) =>
          text
            .setPlaceholder("sk-ant-...")
            .setValue(this.plugin.settings.anthropicApiKey)
            .onChange(async (val) => {
              this.plugin.settings.anthropicApiKey = val;
              await this.plugin.saveSettings();
            })
        );
    } else if (this.plugin.settings.engine === "openai") {
      new Setting(containerEl)
        .setName("OpenAI API Key")
        .setDesc("Dein OpenAI API-Key (von platform.openai.com).")
        .addText((text) =>
          text
            .setPlaceholder("sk-proj-...")
            .setValue(this.plugin.settings.openaiApiKey)
            .onChange(async (val) => {
              this.plugin.settings.openaiApiKey = val;
              await this.plugin.saveSettings();
            })
        );
    }

    // Test Engine Connection Button
    new Setting(containerEl)
      .setName("Verbindung testen")
      .setDesc("Sendet einen kurzen Ping an die aktuell ausgewählte Engine.")
      .addButton((btn) =>
        btn
          .setButtonText("⚡ Engine testen")
          .onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText("Teste...");
            const runner = new EngineRunner(this.plugin.settings);
            const res = await runner.runPrompt("Antworte bitte nur mit 'OK' im JSON-Format: {\"status\": \"OK\"}");
            btn.setDisabled(false);
            btn.setButtonText("⚡ Engine testen");

            if (res.success) {
              new Notice(`✅ Verbindung zu ${this.plugin.settings.engine.toUpperCase()} erfolgreich!`);
            } else {
              new Notice(`❌ Fehler: ${res.error}`, 6000);
            }
          })
      );

    // --------------------------------------------------------------------------
    // 2. SKILLS & TOOLS TOGGLES
    // --------------------------------------------------------------------------
    containerEl.createEl("h3", { text: "🛠️ Aktive Skills & Tools" });

    new Setting(containerEl)
      .setName("Inbox Triage Tool")
      .setDesc("Ermöglicht das automatische Sortieren von 00_Inbox/ Notizen in Tasks und Wissen.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableTriageTool).onChange(async (v) => {
          this.plugin.settings.enableTriageTool = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Task Decomposition Tool")
      .setDesc("Ermöglicht das automatisierte Zerlegen komplexer Aufgaben in Checkboxen.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableDecomposeTool).onChange(async (v) => {
          this.plugin.settings.enableDecomposeTool = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Workstream Architect Tool")
      .setDesc("Ermöglicht das Anlegen neuer Workstreams inklusive README und AGENTS.md.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableWorkstreamTool).onChange(async (v) => {
          this.plugin.settings.enableWorkstreamTool = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Vault Metrics & Stats Tool")
      .setDesc("Stellt Metriken und Kontext über den Vault für KI-Assistenten bereit.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableStatsTool).onChange(async (v) => {
          this.plugin.settings.enableStatsTool = v;
          await this.plugin.saveSettings();
        })
      );

    // --------------------------------------------------------------------------
    // 3. WORKFLOW & GIT INTEGRATION
    // --------------------------------------------------------------------------
    containerEl.createEl("h3", { text: "🛡️ Sicherheit & Git-Integration" });

    new Setting(containerEl)
      .setName("Agent Lock Guard Integration")
      .setDesc("Sperrt Notizen während der KI-Bearbeitung automatisch, um Kollisionen zu verhindern.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.lockNotesDuringProcessing).onChange(async (v) => {
          this.plugin.settings.lockNotesDuringProcessing = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Automatischer Git Atomic Commit")
      .setDesc("Erstellt nach jedem erfolgreichen KI-Turn automatisch einen sauberen Commit auf 'main'.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoGitCommit).onChange(async (v) => {
          this.plugin.settings.autoGitCommit = v;
          await this.plugin.saveSettings();
        })
      );
  }
}
