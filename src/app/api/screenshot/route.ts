import { NextRequest } from "next/server";
import { screenshotElement } from "@/lib/screenshot";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const selector = req.nextUrl.searchParams.get("selector") ?? undefined;
  if (!url) {
    return new Response(JSON.stringify({ error: "Informe a URL." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  try {
    const png = await screenshotElement(url, selector);
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "content-type": "image/png",
        "cache-control": "public, max-age=3600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao capturar screenshot.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
