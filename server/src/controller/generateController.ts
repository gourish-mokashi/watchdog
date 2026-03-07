import type { Request, Response } from "express";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { toolname } from "../../generated/prisma/enums.js";


const callRuleWriterAgent = async (
  selectedTool: toolname,
  contents: string,
  projectHints: string[],
): Promise<void> => {
  const rules = buildRules(contents, selectedTool, projectHints);
  const outputDir = path.resolve(process.cwd(), "generated-rules");
  await mkdir(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `rules-${selectedTool}-${timestamp}.txt`;
  const outputPath = path.join(outputDir, filename);
  await writeFile(outputPath, rules, "utf-8");
};

const getSingleValue = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
};

const isValidToolName = (value: unknown): value is toolname =>
  typeof value === "string" &&
  Object.values(toolname).includes(value as toolname);

const collectProjectHints = async (): Promise<string[]> => {
  const srcPath = path.resolve(process.cwd(), "src");
  const entries = await readdir(srcPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory() || entry.name.endsWith(".ts"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
};

const buildRules = (
  contents: string,
  selectedTool: toolname,
  projectHints: string[],
): string => {
  const generatedAt = new Date().toISOString();

  return `# Watchdog Rules

Generated at: ${generatedAt}
Tool: ${selectedTool}

## Agent Input
${contents.trim()}

## Project Hints
${projectHints.map((hint) => `- ${hint}`).join("\n")}

## Suggested Rules
- Prioritize detections and rule tuning for ${selectedTool}.
- Keep security events normalized by tool and threat description.
- Always preserve original raw payload for forensic traceability.
- Update duplicate threat counters and last-seen timestamps instead of creating noisy duplicates.
- Require explicit status tracking for analysis jobs (asked/finished/report URL).
- Validate all external inputs and reject malformed tool/event metadata.
`;
};

export const generateRules = async (req: Request, res: Response) => {
  try {
    const { contents } = req.body;
    const selectedTool = getSingleValue(req.query.toolname);

    if (!isValidToolName(selectedTool)) {
      return res.status(400).send("error");
    }

    if (typeof contents !== "string" || contents.trim().length === 0) {
      return res.status(400).send("error");
    }

    const projectHints = await collectProjectHints();
    await callRuleWriterAgent(selectedTool, contents, projectHints);

    return res.status(200).send("success");
  } catch {
    return res.status(500).send("error");
  }
};
