import { App, Modal, setIcon } from "obsidian";

export class AgentProgressModal extends Modal {
  private title: string;
  private statusText: string;
  private logs: string[] = [];
  private isDone: boolean = false;
  private logContainer: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private actionBtn: HTMLButtonElement | null = null;

  constructor(app: App, title: string) {
    super(app);
    this.title = title;
    this.statusText = "Initialisiere Agent Engine...";
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("workos-agent-progress-modal");

    // Header
    const headerEl = contentEl.createDiv({ cls: "agent-progress-header" });
    const iconEl = headerEl.createSpan({ cls: "agent-progress-icon" });
    setIcon(iconEl, "bot");
    headerEl.createEl("h2", { text: this.title });

    // Status row
    const statusRow = contentEl.createDiv({ cls: "agent-progress-status-row" });
    const spinner = statusRow.createDiv({ cls: "agent-progress-spinner" });
    this.statusEl = statusRow.createDiv({ cls: "agent-progress-status-text", text: this.statusText });

    // Log terminal container
    this.logContainer = contentEl.createDiv({ cls: "agent-progress-log-box" });
    this.renderLogs();

    // Footer actions
    const footerEl = contentEl.createDiv({ cls: "agent-progress-footer" });
    this.actionBtn = footerEl.createEl("button", {
      cls: "mod-cta agent-progress-btn",
      text: "Schließen",
    });
    this.actionBtn.disabled = true;
    this.actionBtn.addEventListener("click", () => this.close());
  }

  onClose() {
    this.contentEl.empty();
  }

  public updateStatus(text: string) {
    this.statusText = text;
    if (this.statusEl) {
      this.statusEl.setText(text);
    }
  }

  public addLog(message: string) {
    this.logs.push(message);
    this.renderLogs();
  }

  public complete(finalMessage: string, success: boolean = true) {
    this.isDone = true;
    this.updateStatus(finalMessage);
    if (this.actionBtn) {
      this.actionBtn.disabled = false;
      this.actionBtn.setText("Fertig");
    }
    const spinner = this.contentEl.querySelector(".agent-progress-spinner") as HTMLElement | null;
    if (spinner) {
      spinner.style.display = "none";
      const checkIcon = createSpan({ cls: success ? "agent-progress-check-icon" : "agent-progress-err-icon" });
      setIcon(checkIcon, success ? "check-circle" : "alert-circle");
      spinner.parentElement?.prepend(checkIcon);
    }
  }

  private renderLogs() {
    if (!this.logContainer) return;
    this.logContainer.empty();
    for (const log of this.logs) {
      const line = this.logContainer.createDiv({ cls: "agent-progress-log-line" });
      line.setText(log);
    }
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
  }
}
