import { AgentSuiteSettings } from "../types";
import { EngineResponse, WorkOSEngine } from "./baseEngine";
import { OllamaEngine } from "./ollamaEngine";
import { CliEngine } from "./cliEngine";
import { CloudApiEngine } from "./cloudEngine";

export class EngineRunner {
  private settings: AgentSuiteSettings;
  private engines: Map<string, WorkOSEngine> = new Map();

  constructor(settings: AgentSuiteSettings) {
    this.settings = settings;
    this.initEngines();
  }

  private initEngines() {
    this.engines.set("ollama", new OllamaEngine(this.settings.ollamaUrl, this.settings.ollamaModel));
    this.engines.set("codex", new CliEngine("codex", this.settings.codexCliCommand || "codex"));
    this.engines.set("claude", new CliEngine("claude", this.settings.claudeCliCommand || "claude"));
    this.engines.set("antigravity", new CliEngine("antigravity", this.settings.antigravityCliCommand || "agy"));
    this.engines.set("gemini", new CloudApiEngine("gemini", this.settings.geminiApiKey, this.settings.geminiModel || "gemini-1.5-flash"));
    this.engines.set("anthropic", new CloudApiEngine("anthropic", this.settings.anthropicApiKey, this.settings.anthropicModel || "claude-3-5-sonnet-20241022"));
    this.engines.set("openai", new CloudApiEngine("openai", this.settings.openaiApiKey, this.settings.openaiModel || "gpt-4o"));
  }

  public registerEngine(engine: WorkOSEngine) {
    this.engines.set(engine.name, engine);
  }

  public async runPrompt(prompt: string, systemPrompt?: string): Promise<EngineResponse> {
    const engine = this.engines.get(this.settings.engine);
    if (!engine) {
      return {
        success: false,
        content: "",
        error: `Engine '${this.settings.engine}' ist nicht registriert.`,
      };
    }
    return await engine.runPrompt(prompt, systemPrompt);
  }
}
