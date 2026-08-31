import fs from "fs";
import matter from "gray-matter";

export function setFileLock(filePath: string, agentName: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = matter(raw);
    parsed.data.agent_state = "processing";
    parsed.data.locked_by = agentName;
    parsed.data.locked_at = new Date().toISOString();

    const output = matter.stringify(parsed.content, parsed.data);
    fs.writeFileSync(filePath, output, "utf8");
    return true;
  } catch (err) {
    console.error(`Fehler beim Setzen der Sperre auf ${filePath}:`, err);
    return false;
  }
}

export function releaseFileLock(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = matter(raw);
    parsed.data.agent_state = "idle";
    delete parsed.data.locked_by;
    delete parsed.data.locked_at;

    const output = matter.stringify(parsed.content, parsed.data);
    fs.writeFileSync(filePath, output, "utf8");
    return true;
  } catch (err) {
    console.error(`Fehler beim Freigeben der Sperre auf ${filePath}:`, err);
    return false;
  }
}

export function isFileLocked(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = matter(raw);
    return parsed.data?.agent_state === "processing";
  } catch {
    return false;
  }
}
