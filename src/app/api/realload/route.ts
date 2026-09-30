import { NextRequest, NextResponse } from "next/server";
import { measureRealLoad } from "@/lib/realload";
import type { Strategy } from "@/lib/performance";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { url?: string; strategy?: Strategy };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "Informe uma URL." }, { status: 400 });
  }
  const strategy: Strategy = body.strategy === "mobile" ? "mobile" : "desktop";

  const result = await measureRealLoad(url, strategy);
  return NextResponse.json(result);
}
