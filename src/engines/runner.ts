import { exec } from "child_process";
import { promisify } from "util";
import { AgentSuiteSettings } from "../types";

const execAsync = promisify(exec);

export interface LLMResponse {
  content: string;
  success: boolean;
  error?: string;
}

export class EngineRunner {
  private settings: AgentSuiteSettings;

  constructor(settings: AgentSuiteSettings) {
    this.settings = settings;
  }

  public async runPrompt(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    const engine = this.settings.engine;

    try {
      switch (engine) {
        case "ollama":
          return await this.runOllama(prompt, systemPrompt);
        case "gemini":
          return await this.runGemini(prompt, systemPrompt);
        case "anthropic":
          return await this.runAnthropic(prompt, systemPrompt);
        case "openai":
          return await this.runOpenAI(prompt, systemPrompt);
        case "codex":
          return await this.runCli(this.settings.codexCliCommand || "codex", prompt);
        case "claude":
          return await this.runCli(this.settings.claudeCliCommand || "claude", prompt);
        case "antigravity":
          return await this.runCli(this.settings.antigravityCliCommand || "agy", prompt);
        default:
          return { success: false, content: "", error: `Unbekannte Engine: ${engine}` };
      }
    } catch (err: any) {
      return { success: false, content: "", error: err.message || String(err) };
    }
  }

  // 1. Local Ollama Runner
  private async runOllama(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    const url = `${this.settings.ollamaUrl || "http://localhost:11434"}/api/generate`;
    const body = {
      model: this.settings.ollamaModel || "llama3",
      prompt: prompt,
      system: systemPrompt || "",
      stream: false,
      format: "json",
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Ollama Server Fehler (${res.status}): ${await res.text()}`);
    }

    const data: any = await res.json();
    return { success: true, content: data.response || "" };
  }

  // 2. Google Gemini API Runner
  private async runGemini(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    if (!this.settings.geminiApiKey) {
      throw new Error("Gemini API Key fehlt in den Einstellungen.");
    }
    const model = this.settings.geminiModel || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.settings.geminiApiKey}`;

    const body: any = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    };
    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Gemini API Fehler (${res.status}): ${await res.text()}`);
    }

    const data: any = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return { success: true, content };
  }

  // 3. Anthropic Claude API Runner
  private async runAnthropic(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    if (!this.settings.anthropicApiKey) {
      throw new Error("Anthropic API Key fehlt in den Einstellungen.");
    }
    const model = this.settings.anthropicModel || "claude-3-5-sonnet-20241022";
    const url = "https://api.anthropic.com/v1/messages";

    const body: any = {
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    };
    if (systemPrompt) {
      body.system = systemPrompt;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.settings.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API Fehler (${res.status}): ${await res.text()}`);
    }

    const data: any = await res.json();
    const content = data.content?.[0]?.text || "";
    return { success: true, content };
  }

  // 4. OpenAI API Runner
  private async runOpenAI(prompt: string, systemPrompt?: string): Promise<LLMResponse> {
    if (!this.settings.openaiApiKey) {
      throw new Error("OpenAI API Key fehlt in den Einstellungen.");
    }
    const model = this.settings.openaiModel || "gpt-4o";
    const url = "https://api.openai.com/v1/chat/completions";

    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.openaiApiKey}`,
      },
      body: JSON.stringify({ model, messages }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API Fehler (${res.status}): ${await res.text()}`);
    }

    const data: any = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    return { success: true, content };
  }

  // 5. Headless CLI Runner (Codex, Claude, Antigravity)
  private async runCli(command: string, prompt: string): Promise<LLMResponse> {
    try {
      const sanitized = prompt.replace(/"/g, '\"');
      const fullCmd = `${command} "${sanitized}"`;
      const { stdout, stderr } = await execAsync(fullCmd, { maxBuffer: 1024 * 1024 * 10 });
      return { success: true, content: stdout.trim() || stderr.trim() };
    } catch (err: any) {
      throw new Error(`CLI Fehler beim Ausführen von '${command}': ${err.message}`);
    }
  }
}
