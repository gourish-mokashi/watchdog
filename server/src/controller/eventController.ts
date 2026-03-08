import type { Request, Response } from "express";
import { prisma } from "../exports/prisma.js";
import { toolname } from "../../generated/prisma/enums.js";
import { enqueueThreatAnalysis } from "../services/threatAnalysisQueue.js";
import { getSignedThreatReportUrl } from "../services/awsReportStorage.js";
import { logDebug, logError, logInfo } from "../utils/logger.js";

const isValidToolName = (value: unknown): value is toolname =>
  typeof value === "string" &&
  Object.values(toolname).includes(value as toolname);

const parseDate = (value: unknown): Date | null => {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getSingleValue = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
};

const parseBool = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return null;
};

const parseRows = (value: unknown): number | null => {
  if (value === undefined) return null;
  if (typeof value !== "string") return null;
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || n <= 0) return null;
  return Math.min(n, 500);
};

export const createEvent = async (req: Request, res: Response) => {
  try {
    const { sourceTool, timestamp, priority, description, rawPayload } = req.body;
    logDebug("event.create", "request", {
      sourceTool: typeof sourceTool === "string" ? sourceTool : null,
      hasTimestamp: Boolean(timestamp),
      hasPayload: rawPayload !== undefined,
    });

    if (!isValidToolName(sourceTool)) {
      return res.status(400).json({ error: "Invalid sourceTool" });
    }

    if (typeof description !== "string" || description.trim().length === 0) {
      return res.status(400).json({ error: "description is required" });
    }

    const parsedTimestamp = timestamp ? parseDate(timestamp) : new Date();
    if (!parsedTimestamp) {
      return res.status(400).json({ error: "Invalid timestamp" });
    }

    // A "same threat type" is treated as same source tool + same description.
    const existing = await prisma.event.findFirst({
      where: {
        sourceTool,
        description: description.trim(),
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    if (existing) {
      const updated = await prisma.event.update({
        where: { id: existing.id },
        data: {
          timestamp: parsedTimestamp,
          priority: existing.priority,
          rawPayload,
          count: { increment: 1 },
        },
      });

      logInfo("event.create", "updated existing", { eventId: updated.id });

      return res.status(200).json({
        success: true,
        id: updated.id,
        updatedExisting: true,
      });
    }

    const created = await prisma.event.create({
      data: {
        sourceTool,
        timestamp: parsedTimestamp,
        priority,
        description: description.trim(),
        rawPayload,
        reportUrl: "",
      },
    });

    logInfo("event.create", "created", { eventId: created.id });

    return res.status(201).json({
      success: true,
      id: created.id,
      updatedExisting: false,
    });
  } catch (error) {
    logError("event.create", "failed", { error: String(error) });
    return res.status(500).json({ error: "Failed to create event", details: String(error) });
  }
};

export const getAllEvents = async (req: Request, res: Response) => {
  try {
    const start = getSingleValue(req.query.start);
    const end = getSingleValue(req.query.end);
    const rows = getSingleValue(req.query.rows);
    const lf = getSingleValue(req.query.lf);
    const of = getSingleValue(req.query.of);

    const parsedStart = start ? parseDate(start) : null;
    const parsedEnd = end ? parseDate(end) : null;
    const parsedRows = parseRows(rows);
    const oldestFirst = parseBool(of) ?? false;
    const latestFirst = oldestFirst ? false : (parseBool(lf) ?? true);
    logDebug("event.all", "request", {
      start: start ?? null,
      end: end ?? null,
      rows: parsedRows ?? 100,
      oldestFirst,
      latestFirst,
    });

    if (start && !parsedStart) return res.status(400).json({ error: "Invalid start date" });
    if (end && !parsedEnd) return res.status(400).json({ error: "Invalid end date" });
    if (rows !== undefined && parsedRows === null) {
      return res.status(400).json({ error: "rows must be a positive integer" });
    }

    const timestampFilter: { gte?: Date; lte?: Date } = {};
    if (parsedStart) timestampFilter.gte = parsedStart;
    if (parsedEnd) timestampFilter.lte = parsedEnd;
    const whereClause =
      Object.keys(timestampFilter).length > 0 ? { timestamp: timestampFilter } : undefined;

    const events = await prisma.event.findMany({
      ...(whereClause ? { where: whereClause } : {}),
      orderBy: { timestamp: latestFirst ? "desc" : "asc" },
      take: parsedRows ?? 100,
      select: {
        id: true,
        sourceTool: true,
        timestamp: true,
        priority: true,
        description: true,
        reportUrl: true,
        count: true,
        askedAnalysis: true,
        finished: true,
      },
    });

    const signedEvents = await Promise.all(
      events.map(async (event) => ({
        ...event,
        reportUrl: event.reportUrl ? await getSignedThreatReportUrl(event.reportUrl) : "",
      })),
    );

    logDebug("event.all", "response", { count: signedEvents.length });

    return res.status(200).json(signedEvents);
  } catch (error) {
    logError("event.all", "failed", { error: String(error) });
    return res.status(500).json({ error: "Failed to fetch events", details: String(error) });
  }
};

export const getEventById = async (req: Request, res: Response) => {
  try {
    const uuid = getSingleValue(req.params.uuid);
    logDebug("event.byId", "request", { eventId: uuid ?? null });
    if (!uuid) return res.status(400).json({ error: "Invalid event id" });
    const event = await prisma.event.findUnique({ where: { id: uuid } });

    if (!event) {
      logDebug("event.byId", "not found", { eventId: uuid });
      return res.status(404).json({ error: "Event not found" });
    }

    const signedReportUrl = event.reportUrl
      ? await getSignedThreatReportUrl(event.reportUrl)
      : "";
    logDebug("event.byId", "response", { eventId: uuid, hasReport: Boolean(signedReportUrl) });
    return res.status(200).json({ ...event, reportUrl: signedReportUrl });
  } catch (error) {
    logError("event.byId", "failed", {
      eventId: req.params.uuid,
      error: String(error),
    });
    return res.status(500).json({ error: "Failed to fetch event", details: String(error) });
  }
};

export const analyseEvent = async (req: Request, res: Response) => {
  try {
    const uuid = getSingleValue(req.params.uuid);
    logDebug("event.analyse", "request", { eventId: uuid ?? null });
    if (!uuid) return res.status(400).json({ error: "Invalid event id" });
    const event = await prisma.event.findUnique({ where: { id: uuid } });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    await prisma.event.update({
      where: { id: uuid },
      data: {
        askedAnalysis: true,
        finished: false,
        reportUrl: "",
      },
    });

    const queued = enqueueThreatAnalysis(uuid);
    logDebug("event.analyse", "analysis requested", { eventId: uuid, queued });

    return res.status(200).json({ success: true, queued });
  } catch (error) {
    logError("event.analyse", "failed to enqueue", {
      eventId: req.params.uuid,
      error: String(error),
    });
    return res.status(500).json({ error: "Failed to start analysis", details: String(error) });
  }
};

export const getEventStatus = async (req: Request, res: Response) => {
  try {
    const uuid = getSingleValue(req.params.uuid);
    logDebug("event.status", "request", { eventId: uuid ?? null });
    if (!uuid) return res.status(400).json({ error: "Invalid event id" });
    const event = await prisma.event.findUnique({
      where: { id: uuid },
      select: {
        askedAnalysis: true,
        finished: true,
        reportUrl: true,
      },
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const signedReportUrl =
      event.finished && event.reportUrl
        ? await getSignedThreatReportUrl(event.reportUrl)
        : "";

    logDebug("event.status", "response", {
      eventId: uuid,
      askedAnalysis: event.askedAnalysis,
      finished: event.finished,
      hasReport: Boolean(signedReportUrl),
    });

    return res.status(200).json({
      askedAnalysis: event.askedAnalysis,
      finished: event.finished,
      reportUrl: signedReportUrl,
    });
  } catch (error) {
    logError("event.status", "failed", {
      eventId: req.params.uuid,
      error: String(error),
    });
    return res.status(500).json({ error: "Failed to fetch status", details: String(error) });
  }
};
