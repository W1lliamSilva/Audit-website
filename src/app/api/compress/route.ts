import { NextRequest, NextResponse } from "next/server";
import { compressImage } from "@/lib/compress";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: { url?: string; quality?: number; maxWidth?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo JSON inválido." }, { status: 400 });
  }
  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ ok: false, error: "Informe a URL da imagem." }, { status: 400 });
  }
  const result = await compressImage(url, { quality: body.quality, maxWidth: body.maxWidth });
  return NextResponse.json(result);
}
