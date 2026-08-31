import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function isGitAvailable(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync("git rev-parse --is-inside-work-tree", { cwd });
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

export async function safeGitCommit(message: string, cwd: string): Promise<{ success: boolean; output: string }> {
  try {
    const isGit = await isGitAvailable(cwd);
    if (!isGit) {
      return { success: false, output: "Git nicht initialisiert (Fallback aktiv)." };
    }

    // Stage all changes
    await execAsync("git add .", { cwd });

    // Check if there are changes to commit
    const { stdout: statusOut } = await execAsync("git status --porcelain", { cwd });
    if (!statusOut.trim()) {
      return { success: true, output: "Keine Änderungen zum Committen." };
    }

    // Sanitize commit message
    const cleanMsg = message.replace(/"/g, '\"');
    const { stdout: commitOut } = await execAsync(`git commit -m "${cleanMsg}"`, { cwd });

    return { success: true, output: commitOut.trim() };
  } catch (err: any) {
    console.warn("Git commit skipped or failed gracefully:", err.message);
    return { success: false, output: err.message };
  }
}
