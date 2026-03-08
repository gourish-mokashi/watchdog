import { NextRequest, NextResponse } from "next/server";
import { mockEvents } from "../mockData";

const getServerURL = (): string =>
  process.env.SERVER_URL?.trim() || process.env.NEXT_PUBLIC_SERVER_URL?.trim() || "";

const parseDate = (value: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseRows = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return Math.min(parsed, 500);
};

const getMockEvents = (request: NextRequest) => {
  const start = parseDate(request.nextUrl.searchParams.get("start"));
  const end = parseDate(request.nextUrl.searchParams.get("end"));
  const rows = parseRows(request.nextUrl.searchParams.get("rows"));

  // Support both lf=true and of=true sorting flags used by the UI.
  const oldestFirst = request.nextUrl.searchParams.get("of") === "true";
  const latestFirst = request.nextUrl.searchParams.get("lf") !== "false";

  const filtered = mockEvents.filter((event) => {
    const timestamp = new Date(event.timestamp).getTime();
    if (start && timestamp < start.getTime()) return false;
    if (end && timestamp > end.getTime()) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const first = new Date(a.timestamp).getTime();
    const second = new Date(b.timestamp).getTime();

    if (oldestFirst) return first - second;
    if (latestFirst) return second - first;
    return 0;
  });

  return filtered.slice(0, rows ?? 100);
};

export async function GET(request: NextRequest) {
  const queryString = request.nextUrl.search;
  const serverURL = getServerURL();

  if (!serverURL) {
    return NextResponse.json(getMockEvents(request));
  }

  try {
    const res = await fetch(`${serverURL}/events/all${queryString}`);

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: body || "Failed to fetch events" },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(getMockEvents(request));
  }
}
