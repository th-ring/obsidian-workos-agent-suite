import { EngineResponse, WorkOSEngine } from "./baseEngine";

export class OllamaEngine implements WorkOSEngine {
  name = "ollama";
  private url: string;
  private model: string;

  constructor(url: string = "http://localhost:11434", model: string = "llama3") {
    this.url = url;
    this.model = model;
  }

  async runPrompt(prompt: string, systemPrompt?: string): Promise<EngineResponse> {
    try {
      const endpoint = `${this.url}/api/generate`;
      const body = {
        model: this.model,
        prompt: prompt,
        system: systemPrompt || "",
        stream: false,
        format: "json",
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Ollama Fehler (${res.status}): ${await res.text()}`);
      }

      const data: any = await res.json();
      return { success: true, content: data.response || "" };
    } catch (err: any) {
      return { success: false, content: "", error: err.message };
    }
  }
}
