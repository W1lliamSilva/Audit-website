import { NextRequest, NextResponse } from "next/server";
import { compressImage, compressBuffer } from "@/lib/compress";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: { url?: string; data?: string; quality?: number; maxWidth?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corpo JSON inválido." }, { status: 400 });
  }
  const opts = { quality: body.quality, maxWidth: body.maxWidth };

  // Upload local (base64, com ou sem prefixo data:).
  if (body.data) {
    const base64 = body.data.includes(",") ? body.data.split(",")[1] : body.data;
    const buf = Buffer.from(base64, "base64");
    const result = await compressBuffer(buf, opts);
    return NextResponse.json(result);
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ ok: false, error: "Informe a URL da imagem ou envie um arquivo." }, { status: 400 });
  }
  const result = await compressImage(url, opts);
  return NextResponse.json(result);
}
