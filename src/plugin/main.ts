import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { AgentProgressModal } from "./progressModal";
import { AgentSuiteSettingTab } from "./settings";
import { EngineRunner } from "../engines/runner";
import { listUnprocessedInbox, executeTriageAction } from "../core/triage";
import { decomposeTask } from "../core/decompose";
import { createWorkstream } from "../core/workstream";
import { getVaultStats } from "../core/stats";
import { setFileLock, releaseFileLock } from "../core/lock";
import { safeGitCommit } from "../core/git";
import { AgentSuiteSettings, DEFAULT_SETTINGS } from "../types";

export default class WorkOSAgentSuitePlugin extends Plugin {
  settings: AgentSuiteSettings = DEFAULT_SETTINGS;
  engineRunner!: EngineRunner;

  async onload() {
    console.log("Loading WorkOS Agent Suite plugin...");
    await this.loadSettings();
    this.engineRunner = new EngineRunner(this.settings);

    // 1. Register Ribbon Icon
    this.addRibbonIcon("bot", "WorkOS Agent Suite: Schnell-Aktionen", () => {
      this.runInboxTriage();
    });

    // 2. Register Commands
    this.addCommand({
      id: "workos-triage-inbox",
      name: "Inbox triagieren (Automatische KI-Sortierung)",
      callback: () => this.runInboxTriage(),
    });

    this.addCommand({
      id: "workos-decompose-active-task",
      name: "Aktuelle Aufgabe zerlegen (Subtasks generieren)",
      checkCallback: (checking: boolean) => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView && activeView.file) {
          if (!checking) {
            this.runTaskDecomposition(activeView.file);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "workos-vault-stats",
      name: "Vault-Metriken & KI-Status analysieren",
      callback: () => this.showVaultStats(),
    });

    // 3. Register Global API for Dashboard Plugin Bridge
    (window as any).WorkOSAgentSuite = {
      triageInbox: () => this.runInboxTriage(),
      decomposeTask: (file: TFile) => this.runTaskDecomposition(file),
      getStats: () => {
        const adapter = this.app.vault.adapter as any;
        const basePath = adapter.getBasePath ? adapter.getBasePath() : "";
        return getVaultStats(basePath);
      },
    };

    // 4. Register Settings Tab
    this.addSettingTab(new AgentSuiteSettingTab(this.app, this));
  }

  onunload() {
    console.log("Unloading WorkOS Agent Suite plugin...");
    delete (window as any).WorkOSAgentSuite;
  }

  // --- Core Workflows ---

  public async runInboxTriage() {
    const adapter = this.app.vault.adapter as any;
    const vaultPath = adapter.getBasePath ? adapter.getBasePath() : "";

    const unprocessed = listUnprocessedInbox(vaultPath);
    if (unprocessed.length === 0) {
      new Notice("🎉 Die Inbox ist leer! Keine unstrukturierten Notizen gefunden.");
      return;
    }

    const modal = new AgentProgressModal(this.app, `Inbox Triage (${this.settings.engine.toUpperCase()})`);
    modal.open();
    modal.updateStatus(`Verarbeite ${unprocessed.length} Notiz(en)...`);

    try {
      for (let i = 0; i < unprocessed.length; i++) {
        const item = unprocessed[i];
        modal.addLog(`[${i + 1}/${unprocessed.length}] Analysiere: ${item.file}`);

        let isLocked = false;
        try {
          // Lock file during processing
          if (this.settings.lockNotesDuringProcessing) {
            setFileLock(item.path, `agent:${this.settings.engine}`);
            isLocked = true;
          }

          // Build prompt for LLM
          const prompt = `Analysiere folgende unstrukturierte Notiz aus der Inbox und entscheide, ob es ein 'task' (Aufgabe), 'note' (Wissen/Konzept) oder 'workstream' ist.
Antworte AUSSCHLIESSLICH als valides JSON-Objekt in folgendem Schema:
{
  "type": "task" | "note" | "workstream",
  "title": "Prägnanter Titel",
  "priority": "low" | "medium" | "high" | "urgent",
  "workstream": "[[Workstream-Name]]" oder null,
  "category": "architecture" | "concept" | "meeting" | "reference" | "general" (nur bei note),
  "subtasks": ["Subtask 1", "Subtask 2"] (optional bei task),
  "tags": ["tag1", "tag2"]
}

Notiz-Titel: ${item.data.title || item.file}
Notiz-Inhalt:
${item.content}`;

          const llmRes = await this.engineRunner.runPrompt(prompt, "Du bist ein präziser Task & Knowledge Triage Agent für Obsidian WorkOS.");

          let decision: any = { type: "task", title: item.data.title || item.file.replace(".md", "") };
          try {
            const cleanJson = llmRes.content.replace(/```json\n?|\n?```/g, "").trim();
            decision = JSON.parse(cleanJson);
          } catch {
            modal.addLog(`⚠️ Standard-Fallback für ${item.file} genutzt.`);
          }

          decision.reviewStatus = this.settings.defaultReviewStatus;

          // Execute triage action
          const triageResult = executeTriageAction(vaultPath, item.path, decision);
          modal.addLog(`✅ ${triageResult.summary}`);
        } catch (itemErr: any) {
          modal.addLog(`❌ Fehler bei ${item.file}: ${itemErr.message}`);
          if (isLocked) {
            releaseFileLock(item.path);
          }
        }
      }

      // Auto Git Commit if enabled
      if (this.settings.autoGitCommit) {
        modal.addLog("💾 Erstelle atomaren Git Turn-Commit...");
        const gitRes = await safeGitCommit(`feat(agent): triaged ${unprocessed.length} inbox items [engine:${this.settings.engine}]`, vaultPath);
        modal.addLog(`Git: ${gitRes.output}`);
      }

      modal.complete(`Triage von ${unprocessed.length} Notiz(en) erfolgreich abgeschlossen!`, true);
    } catch (err: any) {
      modal.addLog(`❌ Fehler: ${err.message}`);
      modal.complete("Triage mit Fehlern abgebrochen.", false);
    }
  }

  public async runTaskDecomposition(file: TFile) {
    const adapter = this.app.vault.adapter as any;
    const vaultPath = adapter.getBasePath ? adapter.getBasePath() : "";
    const fullPath = adapter.getFullPath ? adapter.getFullPath(file.path) : `${vaultPath}/${file.path}`;

    const modal = new AgentProgressModal(this.app, `Task Zerlegung (${this.settings.engine.toUpperCase()})`);
    modal.open();
    modal.updateStatus(`Zerlege Aufgabe "${file.basename}" in Subtasks...`);

    try {
      if (this.settings.lockNotesDuringProcessing) {
        setFileLock(fullPath, `agent:${this.settings.engine}`);
      }

      const raw = await this.app.vault.read(file);

      const prompt = `Zerlege folgende Aufgabe in 3 bis 6 konkrete, handlungsorientierte Teilaufgaben (Subtasks).
Antworte AUSSCHLIESSLICH als JSON-Array von Strings, z.B. ["Erste Teilaufgabe", "Zweite Teilaufgabe"].

Aufgaben-Inhalt:
${raw}`;

      modal.addLog("Frage KI-Engine nach Teilaufgaben...");
      const llmRes = await this.engineRunner.runPrompt(prompt, "Du bist ein Senior Engineering Lead, der Aufgaben in präzise Checkbox-Schritte zerlegt.");

      let subtasks: string[] = [];
      try {
        const cleanJson = llmRes.content.replace(/```json\n?|\n?```/g, "").trim();
        subtasks = JSON.parse(cleanJson);
      } catch {
        subtasks = ["Teilaufgabe 1: Analyse & Spezifikation", "Teilaufgabe 2: Implementierung", "Teilaufgabe 3: Review & Testing"];
      }

      const result = decomposeTask(fullPath, subtasks, {
        agentName: `agent:${this.settings.engine}`,
        reviewStatus: this.settings.defaultReviewStatus,
      });

      modal.addLog(`✅ ${subtasks.length} Subtasks hinzugefügt:`);
      subtasks.forEach((st) => modal.addLog(`  - [ ] ${st}`));

      if (this.settings.autoGitCommit) {
        modal.addLog("💾 Erstelle Git Commit...");
        const gitRes = await safeGitCommit(`feat(agent): decomposed task "${file.basename}" into ${subtasks.length} subtasks`, vaultPath);
        modal.addLog(`Git: ${gitRes.output}`);
      }

      modal.complete(`Aufgabe "${file.basename}" erfolgreich zerlegt!`, true);
    } catch (err: any) {
      modal.addLog(`❌ Fehler: ${err.message}`);
      modal.complete("Zerlegung abgebrochen.", false);
    } finally {
      if (this.settings.lockNotesDuringProcessing) {
        releaseFileLock(fullPath);
      }
    }
  }

  public showVaultStats() {
    const adapter = this.app.vault.adapter as any;
    const vaultPath = adapter.getBasePath ? adapter.getBasePath() : "";
    const stats = getVaultStats(vaultPath);

    new Notice(
      `📊 WorkOS Status:\n📥 Inbox: ${stats.unprocessedInboxCount}/${stats.inboxCount}\n✅ Tasks: ${stats.totalTasks}\n🏛️ Workstreams: ${stats.activeWorkstreams.length}\n🔒 Locks: ${stats.activeLocksCount}`,
      6000
    );
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.engineRunner = new EngineRunner(this.settings);
  }
}
