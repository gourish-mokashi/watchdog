import { prisma } from "../exports/prisma.js";
import {
  PROJECT_SUMMARY_PATH,
  runThreatAnalysisAgent,
} from "../agents/threat-analysis.js";
import { readWithToolApi } from "./daemonToolsClient.js";
import { renderThreatReportPdf } from "./pdfReportRenderer.js";
import { uploadThreatReportPdf } from "./awsReportStorage.js";

const queuedEventIds = new Set<string>();
const activeEventIds = new Set<string>();
const queue: string[] = [];
let workerStarted = false;

const buildFailureReport = (eventId: string, reason: string): string => `# Threat Analysis

## Verdict
Inconclusive

## Status
Analysis failed while processing event \`${eventId}\`.

## Reason
${reason}

## Next Steps
- Re-run analysis after validating daemon access and model availability.
- Confirm \`${PROJECT_SUMMARY_PATH}\` is available.
`;

const readProjectSummarySafe = async (): Promise<string> => {
  try {
    const response = await readWithToolApi(PROJECT_SUMMARY_PATH);
    if (response.contents.trim().length > 0) {
      return response.contents;
    }
    return "Project summary unavailable: file exists but empty.";
  } catch {
    return "Project summary unavailable.";
  }
};

const processEventAnalysis = async (eventId: string): Promise<void> => {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return;

  try {
    const projectSummary = await readProjectSummarySafe();
    const relatedEvents = await prisma.event.findMany({
      where: {
        sourceTool: event.sourceTool,
        description: event.description,
        id: { not: event.id },
      },
      orderBy: { timestamp: "desc" },
      take: 20,
      select: {
        timestamp: true,
        priority: true,
        description: true,
        count: true,
      },
    });

    const report = await runThreatAnalysisAgent({
      eventId: event.id,
      sourceTool: event.sourceTool,
      timestamp: event.timestamp,
      priority: event.priority,
      description: event.description,
      rawPayload: event.rawPayload,
      count: event.count,
      projectSummary,
      relatedEvents,
    });

    if (!report) {
      throw new Error("Threat analysis agent returned an empty report");
    }

    const reportPdf = await renderThreatReportPdf(report, {
      eventId: event.id,
      sourceTool: event.sourceTool,
      priority: event.priority,
      detectedAt: event.timestamp,
      generatedAt: new Date(),
    });
    const storedReportPath = await uploadThreatReportPdf(event.id, reportPdf);

    await prisma.event.update({
      where: { id: event.id },
      data: {
        askedAnalysis: true,
        finished: true,
        reportUrl: storedReportPath,
      },
    });
  } catch (error) {
    const fallbackReport = buildFailureReport(event.id, String(error));
    let storedReportPath = "";

    try {
      const fallbackPdf = await renderThreatReportPdf(fallbackReport, {
        eventId: event.id,
        sourceTool: event.sourceTool,
        priority: event.priority,
        detectedAt: event.timestamp,
        generatedAt: new Date(),
      });
      storedReportPath = await uploadThreatReportPdf(event.id, fallbackPdf);
    } catch {
      storedReportPath = "";
    }

    await prisma.event.update({
      where: { id: event.id },
      data: {
        askedAnalysis: true,
        finished: true,
        reportUrl: storedReportPath,
      },
    });
  }
};

const drainQueue = async (): Promise<void> => {
  if (workerStarted) return;
  workerStarted = true;

  try {
    while (queue.length > 0) {
      const eventId = queue.shift();
      if (!eventId) continue;

      queuedEventIds.delete(eventId);
      activeEventIds.add(eventId);
      try {
        await processEventAnalysis(eventId);
      } finally {
        activeEventIds.delete(eventId);
      }
    }
  } finally {
    workerStarted = false;
    if (queue.length > 0) {
      void drainQueue();
    }
  }
};

export const enqueueThreatAnalysis = (eventId: string): boolean => {
  if (queuedEventIds.has(eventId) || activeEventIds.has(eventId)) {
    return false;
  }

  queuedEventIds.add(eventId);
  queue.push(eventId);
  void drainQueue();
  return true;
};
