import { NextRequest, NextResponse } from "next/server";
import { simulateLoadAcrossProfiles } from "@/lib/simulate";
import type { Strategy } from "@/lib/performance";

export const runtime = "nodejs";
// 4 perfis sequenciais, incluindo "3G lento" — pode demorar bem mais que uma
// medição única (ver src/lib/simulate.ts).
export const maxDuration = 200;

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

  const result = await simulateLoadAcrossProfiles(url, strategy);
  return NextResponse.json(result);
}
