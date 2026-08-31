import { EngineResponse, WorkOSEngine } from "./baseEngine";

export class CloudApiEngine implements WorkOSEngine {
  name: string;
  private apiKey: string;
  private model: string;
  private provider: "gemini" | "anthropic" | "openai";

  constructor(provider: "gemini" | "anthropic" | "openai", apiKey: string, model: string) {
    this.provider = provider;
    this.name = provider;
    this.apiKey = apiKey;
    this.model = model;
  }

  async runPrompt(prompt: string, systemPrompt?: string): Promise<EngineResponse> {
    if (!this.apiKey) {
      return { success: false, content: "", error: `${this.provider.toUpperCase()} API-Key fehlt in den Einstellungen.` };
    }

    try {
      if (this.provider === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
        const body: any = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
        if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] };

        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`Gemini API Fehler (${res.status}): ${await res.text()}`);
        const data: any = await res.json();
        return { success: true, content: data.candidates?.[0]?.content?.parts?.[0]?.text || "" };
      } else if (this.provider === "anthropic") {
        const url = "https://api.anthropic.com/v1/messages";
        const body: any = { model: this.model, max_tokens: 4096, messages: [{ role: "user", content: prompt }] };
        if (systemPrompt) body.system = systemPrompt;

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Anthropic API Fehler (${res.status}): ${await res.text()}`);
        const data: any = await res.json();
        return { success: true, content: data.content?.[0]?.text || "" };
      } else {
        const url = "https://api.openai.com/v1/chat/completions";
        const messages = [];
        if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
        messages.push({ role: "user", content: prompt });

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
          body: JSON.stringify({ model: this.model, messages }),
        });
        if (!res.ok) throw new Error(`OpenAI API Fehler (${res.status}): ${await res.text()}`);
        const data: any = await res.json();
        return { success: true, content: data.choices?.[0]?.message?.content || "" };
      }
    } catch (err: any) {
      return { success: false, content: "", error: err.message };
    }
  }
}
