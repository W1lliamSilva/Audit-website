import { NextRequest, NextResponse } from "next/server";

// Rota de exemplo para geração de alt text usando o modelo de visão da Anthropic.
// Espera a variável de ambiente ANTHROPIC_API_KEY configurada (localmente via
// `vercel env pull .env.local`, e na Vercel via `vercel env add ANTHROPIC_API_KEY`).

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY não configurada no ambiente." },
      { status: 500 }
    );
  }

  let body: { imageUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 });
  }

  const { imageUrl } = body;
  if (!imageUrl) {
    return NextResponse.json(
      { error: "Campo 'imageUrl' é obrigatório." },
      { status: 400 }
    );
  }

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: imageUrl },
            },
            {
              type: "text",
              text: "Gere um texto alternativo (alt text) conciso e descritivo em português para esta imagem, para fins de acessibilidade. Responda apenas com o alt text.",
            },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    return NextResponse.json(
      { error: "Falha na API da Anthropic.", detail },
      { status: 502 }
    );
  }

  const data = await resp.json();
  const altText = data?.content?.[0]?.text ?? "";
  return NextResponse.json({ altText });
}
