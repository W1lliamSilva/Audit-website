import { NextRequest, NextResponse } from "next/server";
import { getImagesWithoutAlt } from "@/lib/images";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }
  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "Informe uma URL." }, { status: 400 });
  }
  const result = await getImagesWithoutAlt(url);
  return NextResponse.json(result);
}
