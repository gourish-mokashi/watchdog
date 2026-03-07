import { NextRequest, NextResponse } from "next/server";
import { mockEvents } from "../mockData";

const SERVER_URL = process.env.SERVER_URL;
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const mockEvent = mockEvents.find((event) => event.id === id);

  if (!SERVER_URL) {
    if (!mockEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json(mockEvent);
  }

  try {
    const res = await fetch(`${SERVER_URL}/events/${encodeURIComponent(id)}`);

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: body || "Event not found" },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    if (!mockEvent) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json(mockEvent);
  }
}
