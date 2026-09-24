import { NextRequest, NextResponse } from "next/server";
import { getSeoForPages } from "@/lib/seo";

// O modo "site inteiro" pode levar bem mais tempo que a auditoria padrão
// (até 10 páginas); 300s é o teto prático em planos com Fluid Compute — em
// planos sem isso, a plataforma aplica seu próprio limite mais baixo, e
// getSeoForPages já devolve resultado parcial antes de estourar esse tempo.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: { url?: string; fullSite?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }
  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "Informe uma URL." }, { status: 400 });
  }
  const result = await getSeoForPages(url, { fullSite: !!body.fullSite });
  return NextResponse.json(result);
}
