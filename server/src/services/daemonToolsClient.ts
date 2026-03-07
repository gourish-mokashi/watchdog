import { toolname } from "../../generated/prisma/enums.js";
import { logDebug, logError } from "../utils/logger.js";

type ReadToolResponse = {
  filepath: string;
  contents: string;
};

type DirenumToolResponse = {
  contents: string;
};

const daemonBaseUrl = process.env.DAEMON_BASE_URL ?? "http://localhost:4000";

const buildUrl = (pathname: string, query: Record<string, string>): string => {
  const url = new URL(pathname, daemonBaseUrl);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
};

const parseSuccessOrError = async (response: Response): Promise<"success" | "error"> => {
  const raw = (await response.text()).trim().toLowerCase();
  if (raw === "success") return "success";
  return "error";
};

export const readWithToolApi = async (path: string): Promise<ReadToolResponse> => {
  logDebug("daemon.tools", "read request", { path });
  const response = await fetch(buildUrl("/tools/read", { path }), {
    method: "GET",
  });

  if (!response.ok) {
    logError("daemon.tools", "read failed", { path, status: response.status });
    throw new Error(`Daemon read failed with status ${response.status}`);
  }

  const payload = (await response.json()) as Partial<ReadToolResponse>;
  if (typeof payload.filepath !== "string" || typeof payload.contents !== "string") {
    logError("daemon.tools", "read invalid response", { path });
    throw new Error("Daemon read response is invalid");
  }

  logDebug("daemon.tools", "read success", {
    path: payload.filepath,
    bytes: payload.contents.length,
  });
  return {
    filepath: payload.filepath,
    contents: payload.contents,
  };
};

export const writeWithToolApi = async (path: string, contents: string): Promise<"success" | "error"> => {
  logDebug("daemon.tools", "write request", { path, bytes: contents.length });
  const response = await fetch(buildUrl("/tools/write", { path }), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ contents }),
  });

  if (!response.ok) {
    logError("daemon.tools", "write failed", { path, status: response.status });
    return "error";
  }
  const result = await parseSuccessOrError(response);
  logDebug("daemon.tools", "write result", { path, result });
  return result;
};

export const editWithToolApi = async (
  oldContents: string,
  newContents: string,
  path?: string,
): Promise<"success" | "error"> => {
  logDebug("daemon.tools", "edit request", {
    path: path ?? null,
    oldBytes: oldContents.length,
    newBytes: newContents.length,
  });
  const response = await fetch(buildUrl("/tools/edit", path ? { path } : {}), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      oldContents,
      newContents,
      ...(path ? { path } : {}),
    }),
  });

  if (!response.ok) {
    logError("daemon.tools", "edit failed", { status: response.status });
    return "error";
  }
  const result = await parseSuccessOrError(response);
  logDebug("daemon.tools", "edit result", { result });
  return result;
};

export const restartToolWithApi = async (tool: toolname): Promise<"success" | "error"> => {
  logDebug("daemon.tools", "restart request", { tool });
  const response = await fetch(buildUrl("/tools/restart", { toolname: tool }), {
    method: "GET",
  });

  if (!response.ok) {
    logError("daemon.tools", "restart failed", { tool, status: response.status });
    return "error";
  }
  const result = await parseSuccessOrError(response);
  logDebug("daemon.tools", "restart result", { tool, result });
  return result;
};

export const direnumWithToolApi = async (level: number, path: string): Promise<DirenumToolResponse> => {
  logDebug("daemon.tools", "direnum request", { level, path });
  const response = await fetch(buildUrl("/tools/direnum", { level: level.toString(), path }), {
    method: "GET",
  });

  if (!response.ok) {
    logError("daemon.tools", "direnum failed", { level, path, status: response.status });
    throw new Error(`Daemon direnum failed with status ${response.status}`);
  }

  const payload = (await response.json()) as Partial<DirenumToolResponse>;
  if (typeof payload.contents !== "string") {
    logError("daemon.tools", "direnum invalid response", { level, path });
    throw new Error("Daemon direnum response is invalid");
  }

  logDebug("daemon.tools", "direnum success", { level, path, bytes: payload.contents.length });
  return {
    contents: payload.contents,
  };
};

export const validateRulesWithToolApi = async (tool: toolname, rules: string): Promise<string> => {
  logDebug("daemon.tools", "validate rules request", { tool, bytes: rules.length });
  const response = await fetch(buildUrl("/tools/validate", { toolname: tool }), {
    method: "GET",
  });

  const rawResult = (await response.text()).trim();
  const result = rawResult.length > 0 ? rawResult : "validation completed with no output";

  if (!response.ok) {
    logError("daemon.tools", "validate rules failed", {
      tool,
      status: response.status,
      output: result,
    });
    return result;
  }
  logDebug("daemon.tools", "validate rules result", {
    tool,
    status: response.status,
    output: result,
  });
  return result;
};
