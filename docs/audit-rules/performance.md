# Performance

Fonte: [`src/lib/performance.ts`](../../src/lib/performance.ts). Rota:
`POST /api/performance`, com `strategy: "desktop" | "mobile"` (padrão:
`desktop` se não informado ou inválido).

## Fonte dos dados

Usa a API pública do Google **PageSpeed Insights** (que roda o Lighthouse "ao
vivo"), categoria `performance` apenas.

- Funciona sem chave, mas com limite de requisições baixo.
- Se `PAGESPEED_API_KEY` estiver configurada no ambiente, é anexada à
  chamada para aumentar o limite.

## Métricas reportadas

| id | Rótulo |
|---|---|
| `first-contentful-paint` | First Contentful Paint |
| `largest-contentful-paint` | Largest Contentful Paint |
| `total-blocking-time` | Total Blocking Time |
| `cumulative-layout-shift` | Cumulative Layout Shift |
| `speed-index` | Speed Index |

Cada métrica recebe uma nota (0–1, vinda do Lighthouse) convertida em
`rating`:
- `score >= 0.9` → **good**
- `score >= 0.5` → **average**
- abaixo disso → **poor**

O `score` geral (0–100) é `lighthouseResult.categories.performance.score * 100`,
arredondado.

## Oportunidades de melhoria

Filtra os audits do Lighthouse onde `details.type === "opportunity"` **e**
`overallSavingsMs > 100`, ordena por economia estimada (decrescente) e
mantém as **top 8**.

## Retentativas e erros

- Até `ATTEMPTS = 2` tentativas, timeout de `PER_ATTEMPT_MS = 28000` ms cada.
  A ideia: a 1ª chamada roda o Lighthouse ao vivo (lento) e pode estourar o
  timeout; a 2ª geralmente pega cache do Google e responde rápido.
- **Exceção**: em `HTTP 429` (rate limit) **não** há retentativa — retorna
  erro direto, para não piorar o limite por minuto.
- Timeout (`AbortError`) tenta de novo, dentro do limite de tentativas.
- Se todas as tentativas falharem, retorna `score: null`, métricas e
  oportunidades vazias, e uma mensagem de erro amigável.
