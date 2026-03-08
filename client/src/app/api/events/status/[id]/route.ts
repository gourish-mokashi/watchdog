import { NextRequest, NextResponse } from "next/server";
import { mockEvents } from "../../mockData";

const getServerURL = (): string =>
  process.env.SERVER_URL?.trim() || process.env.NEXT_PUBLIC_SERVER_URL?.trim() || "";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const serverURL = getServerURL();

  const mockEvent = mockEvents.find((event) => event.id === id);

  if (!serverURL) {
    if (!mockEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({
      askedAnalysis: mockEvent.askedAnalysis,
      finished: mockEvent.finished,
      reportUrl: mockEvent.finished ? mockEvent.reportUrl : "",
    });
  }

  try {
    const res = await fetch(
      `${serverURL}/events/status/${encodeURIComponent(id)}`,
    );

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: body || "Status check failed" },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    if (!mockEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({
      askedAnalysis: mockEvent.askedAnalysis,
      finished: mockEvent.finished,
      reportUrl: mockEvent.finished ? mockEvent.reportUrl : "",
    });
  }
}
