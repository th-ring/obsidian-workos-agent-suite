import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { WorkstreamResult } from "../types";

export function createWorkstream(
  vaultPath: string,
  name: string,
  options: {
    title?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    lead?: "user" | "agent" | "team";
    targetDate?: string;
    tags?: string[];
    personaDescription?: string;
  } = {}
): WorkstreamResult {
  const sanitizedName = name.replace(/[\\/:*?"<>|]/g, "-").trim();
  const folderPath = path.join(vaultPath, "20_Workstreams", sanitizedName);
  const tasksPath = path.join(folderPath, "Tasks");
  const notesPath = path.join(folderPath, "Notes");
  const readmePath = path.join(folderPath, "README.md");
  const agentsPath = path.join(folderPath, "AGENTS.md");

  // Create folder structure
  [folderPath, tasksPath, notesPath].forEach((dir: string) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const today = new Date().toISOString().split("T")[0];

  // 1. Create README.md (Master Workstream MOC)
  const readmeFrontmatter = {
    type: "workstream",
    title: options.title || sanitizedName,
    status: "active",
    priority: options.priority || "medium",
    target_date: options.targetDate || null,
    created: today,
    lead: options.lead || "user",
    tags: options.tags || ["workstream"],
    agent_state: "idle",
  };

  const readmeBody = `
# 🏛️ ${options.title || sanitizedName}

Master-Übersicht und Vision für diesen Workstream.

## 🎯 Ziele & Meilensteine
- [ ] Initiales Setup abschließen
- [ ] Kern-Funktionen implementieren

## 📋 Aufgaben & Notizen
- Siehe Unterordner \`./Tasks/\` für Aufgaben
- Siehe Unterordner \`./Notes/\` für Mitschriften & ADRs
`;

  fs.writeFileSync(readmePath, matter.stringify(readmeBody.trim(), readmeFrontmatter), "utf8");

  // 2. Create AGENTS.md (Local Agent Persona & Guidelines)
  const agentsContent = `# 🤖 Workstream Agent Directives: ${sanitizedName}

Dieses Dokument definiert die spezifischen Fachrichtlinien und die Persona für KI-Agenten, die innerhalb dieses Workstreams arbeiten.

## 🎭 Persona & Rolle
${options.personaDescription || `Du agierst hier als spezialisierter Lead Engineer / Product Owner für ${sanitizedName}.`}

## 📌 Qualitätskriterien
- Alle Aufgaben in \`./Tasks/\` müssen vollständige Subtask-Listen enthalten.
- Architektur-Entscheidungen werden in \`./Notes/\` als ADR abgelegt.
- Halte die Schemas in \`.schemas/\` strikt ein.
`;

  fs.writeFileSync(agentsPath, agentsContent.trim(), "utf8");

  return {
    workstreamName: sanitizedName,
    folderPath,
    readmePath,
    agentsPath,
    success: true,
  };
}
