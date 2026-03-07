import type { Request, Response } from "express";
import { prisma } from "../exports/prisma.js";
import { toolname } from "../../generated/prisma/enums.js";

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

    return res.status(201).json({
      success: true,
      id: created.id,
      updatedExisting: false,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to create event", details: String(error) });
  }
};

export const getAllEvents = async (req: Request, res: Response) => {
  try {
    const start = getSingleValue(req.query.start);
    const end = getSingleValue(req.query.end);
    const rows = getSingleValue(req.query.rows);
    const lf = getSingleValue(req.query.lf);

    const parsedStart = start ? parseDate(start) : null;
    const parsedEnd = end ? parseDate(end) : null;
    const parsedRows = parseRows(rows);
    const latestFirst = parseBool(lf) ?? true;

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
      },
    });

    return res.status(200).json(events);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch events", details: String(error) });
  }
};

export const getEventById = async (req: Request, res: Response) => {
  try {
    const uuid = getSingleValue(req.params.uuid);
    if (!uuid) return res.status(400).json({ error: "Invalid event id" });
    const event = await prisma.event.findUnique({ where: { id: uuid } });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    return res.status(200).json(event);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch event", details: String(error) });
  }
};

export const analyseEvent = async (req: Request, res: Response) => {
  try {
    const uuid = getSingleValue(req.params.uuid);
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
      },
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to start analysis", details: String(error) });
  }
};

export const getEventStatus = async (req: Request, res: Response) => {
  try {
    const uuid = getSingleValue(req.params.uuid);
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

    return res.status(200).json({
      askedAnalysis: event.askedAnalysis,
      finished: event.finished,
      reportUrl: event.finished ? event.reportUrl : "",
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch status", details: String(error) });
  }
};
