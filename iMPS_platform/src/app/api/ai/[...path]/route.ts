import { NextRequest, NextResponse } from "next/server";

const AI_BASE = "http://localhost:8001";

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join("/");
  const search = req.nextUrl.search;
  const res = await fetch(`${AI_BASE}/${path}${search}`);
  const data = await res.json();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join("/");
  const body = await req.json();
  const res = await fetch(`${AI_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data);
}
