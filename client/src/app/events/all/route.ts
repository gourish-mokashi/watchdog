import { NextRequest, NextResponse } from "next/server";
import { mockEvents } from "../mockData";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const rowsParam = searchParams.get("rows");
  const latestFirst = searchParams.has("lf");

  let filtered = [...mockEvents];

  if (startParam) {
    const startDate = new Date(startParam).getTime();
    filtered = filtered.filter(
      (e) => new Date(e.timestamp).getTime() >= startDate,
    );
  }
  if (endParam) {
    const endDate = new Date(endParam).getTime();
    filtered = filtered.filter(
      (e) => new Date(e.timestamp).getTime() <= endDate,
    );
  }

  filtered.sort((a, b) => {
    const diff =
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    return latestFirst ? -diff : diff;
  });

  const rows = rowsParam ? Math.max(1, parseInt(rowsParam, 10)) : 10;
  filtered = filtered.slice(0, rows);

  return NextResponse.json(filtered);
}
