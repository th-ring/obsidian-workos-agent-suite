import { exec } from "child_process";
import { promisify } from "util";
import { EngineResponse, WorkOSEngine } from "./baseEngine";

const execAsync = promisify(exec);

export class CliEngine implements WorkOSEngine {
  name: string;
  private command: string;

  constructor(name: string, command: string) {
    this.name = name;
    this.command = command;
  }

  async runPrompt(prompt: string, systemPrompt?: string): Promise<EngineResponse> {
    try {
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
      const sanitized = fullPrompt.replace(/"/g, '\"');
      const fullCmd = `${this.command} "${sanitized}"`;
      const { stdout, stderr } = await execAsync(fullCmd, { maxBuffer: 1024 * 1024 * 10 });
      return { success: true, content: stdout.trim() || stderr.trim() };
    } catch (err: any) {
      return { success: false, content: "", error: `CLI Fehler bei '${this.command}': ${err.message}` };
    }
  }
}
