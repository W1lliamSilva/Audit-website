import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() {
  const k = process.env.PAGESPEED_API_KEY;
  return NextResponse.json({
    keyPresent: !!k,
    keyLen: k ? k.length : 0,
    keyPrefix: k ? k.slice(0, 4) : null,
    anthropicPresent: !!process.env.ANTHROPIC_API_KEY,
    vercel: !!process.env.VERCEL,
  });
}
