import { NextRequest, NextResponse } from "next/server";
import { auditUrl } from "@/lib/audit";

// A verificação de links pode levar alguns segundos.
export const maxDuration = 30;

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

  try {
    const result = await auditUrl(url);
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "A página demorou demais para responder (timeout)."
          : err.message
        : "Falha ao auditar a página.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
