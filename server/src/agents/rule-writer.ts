import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import model from "./client.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  editWithToolApi,
  readWithToolApi,
  restartToolWithApi,
  writeWithToolApi,
  validateRulesWithToolApi,
} from "../services/daemonToolsClient.js";
import type { toolname } from "../../generated/prisma/enums.js";
import { PROJECT_SUMMARY_REMOTE_PATH } from "./project-summariser.js";
import { logDebug, logInfo } from "../utils/logger.js";
import { RedisSession } from "./memory/redis.js";

const writeToFile = tool({
  name: "writeToFile",
  description: "Write full content to a tool file on the daemon host.",
  parameters: z.object({
    filePath: z
      .string()
      .describe("Absolute destination path, including file name and extension."),
    content: z.string().describe("Complete file contents to write."),
  }),
  async execute({ filePath, content }) {
    return writeWithToolApi(filePath, content);
  },
});

const readFromFile = tool({
  name: "readFromFile",
  description: "Read the current file contents from the daemon host before editing.",
  parameters: z.object({
    filePath: z
      .string()
      .describe("Absolute source path, including file name and extension."),
  }),
  async execute({ filePath }) {
    return readWithToolApi(filePath);
  },
});

const editFile = tool({
  name: "editFile",
  description: "Replace old text with new text in a daemon-managed file.",
  parameters: z.object({
    oldContents: z.string().describe("Exact old content snippet to replace."),
    newContents: z.string().describe("New content snippet to replace with."),
  }),
  async execute({ oldContents, newContents }) {
    return editWithToolApi(oldContents, newContents);
  },
});

const restartTool = tool({
  name: "restartTool",
  description: "Restart a security tool after successful rule updates. Make sure to validate rules before restarting.",
  parameters: z.object({
    toolname: z.enum(["falco", "suricata", "wazuh", "zeek"]),
  }),
  async execute({ toolname }) {
    return restartToolWithApi(toolname);
  },
});

const validateRules = tool({
  name: "validateRules",
  description: "Validate the syntax and check errors of the updated rules file before restarting the tool.",
  parameters: z.object({
    toolname: z.enum(["falco", "suricata", "wazuh", "zeek"]),
    rules: z.string().describe("The rules content to validate."),
  }),
  async execute({ toolname, rules }) {
    return validateRulesWithToolApi(toolname, rules);
  },
});

const skillDir = path.resolve(process.cwd(), "skills", "rule-writing-guidelines");

const loadSkillContext = async (selectedTool: toolname): Promise<string> => {
  const filesToLoad = [
    path.join(skillDir, "SKILL.md"),
    path.join(skillDir, "watchdog.yaml"),
    path.join(skillDir, `${selectedTool}.md`),
  ];
  const contents = await Promise.all(filesToLoad.map((file) => readFile(file, "utf-8")));

  return `--- SKILL OVERVIEW ---\n${contents[0]}\n\n--- WATCHDOG CONFIG ---\n${contents[1]}\n\n--- TOOL GUIDE (${selectedTool}) ---\n${contents[2]}`;
};

const loadProjectSummaryContext = async (projectSummary?: string): Promise<string> => {
  if (typeof projectSummary === "string" && projectSummary.trim().length > 0) {
    logDebug("agent.rule-writer", "using inline project summary");
    return projectSummary.trim();
  }

  try {
    const storedSummary = await readWithToolApi(PROJECT_SUMMARY_REMOTE_PATH);
    if (storedSummary.contents.trim().length > 0) {
      logDebug("agent.rule-writer", "using stored project summary", {
        path: PROJECT_SUMMARY_REMOTE_PATH,
      });
      return storedSummary.contents.trim();
    }
  } catch {
    // Fall through to conservative fallback behavior.
  }

  return "Project summary unavailable. Use conservative default detections. Do not add broad suppressions without explicit environment evidence.";
};

const createRuleWriterAgent = (skillContext: string) =>
  new Agent({
    name: "Rule Writer Agent",
    instructions: `
You are a senior detection engineer focused on reducing noisy alerts while preserving high-signal detections.

Follow this workflow exactly:
1) Read the provided project summary if available and extract workload profile, known noisy behaviors, and critical assets.
2) Use the skill context to follow tool-specific syntax, placement, validation, and tuning guidance.
3) Generate a production-ready rules file for the selected tool.
4) Add rationale comments near major rule blocks so operators understand why each rule exists and how it suppresses noise.
5) Write the final rules file via writeToFile to the exact path from watchdog.yaml.
6) Validate the rules file using validateRules before restarting the tool.
7) Restart the selected tool using restartTool only after writeToFile returns success.

Hard requirements:
- Keep rules conservative: minimize false positives.
- Avoid generic catch-all detections without context constraints.
- Keep syntax valid for the specific tool.
- If project summary is missing, avoid suppression-heavy tuning and keep rules narrowly scoped.
- If uncertain, read current file first with readFromFile and preserve local context.
- Return a short summary of what was written and why.

Skill context:
${skillContext}
    `,
    model,
    tools: [readFromFile, writeToFile, editFile, validateRules, restartTool],
  });

export async function runRuleWriterAgent(
  selectedTool: toolname,
  projectSummary?: string,
): Promise<string> {
  logInfo("agent.rule-writer", "start", { tool: selectedTool });

  const session = new RedisSession(`rule-writer:${selectedTool}`);

  const skillContext = await loadSkillContext(selectedTool);
  const resolvedProjectSummary = await loadProjectSummaryContext(projectSummary);
  const agent = createRuleWriterAgent(skillContext);

  const input = `Task: Create custom detection rules for "${selectedTool}".

Project Summary (authoritative context from backend):
${resolvedProjectSummary}`;

  const result = await run(agent, input, { session });
  logInfo("agent.rule-writer", "completed", { tool: selectedTool });
  return String(result.finalOutput ?? "success");
}
