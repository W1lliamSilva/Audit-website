import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  const key = process.env.PAGESPEED_API_KEY;
  const api = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  api.searchParams.set("url", "https://example.com");
  api.searchParams.set("strategy", "desktop");
  api.searchParams.append("category", "performance");
  if (key) api.searchParams.set("key", key);
  let status = 0, body = "", err = "";
  try {
    const res = await fetch(api.toString());
    status = res.status;
    body = (await res.text()).slice(0, 400);
  } catch (e) {
    err = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  }
  return NextResponse.json({
    keyPresent: !!key,
    keyLen: key ? key.length : 0,
    googleStatus: status,
    googleBody: body,
    fetchError: err,
  });
}
