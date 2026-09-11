// Integração com a API do Google PageSpeed Insights (Lighthouse) para medir
// desempenho no desktop e no mobile.
//
// Sem chave a API funciona, porém com limite de requisições baixo. Para uso
// real, configure PAGESPEED_API_KEY (Google Cloud → PageSpeed Insights API).

export type Strategy = "desktop" | "mobile";

export type Rating = "good" | "average" | "poor";

export interface PerfMetric {
  id: string;
  label: string;
  display: string;
  score: number | null; // 0–1
  rating: Rating | null;
}

export interface PerfOpportunity {
  id: string;
  title: string;
  display: string;
  savingsMs: number;
}

export interface PerfResult {
  strategy: Strategy;
  score: number | null; // 0–100 (null se indisponível)
  metrics: PerfMetric[];
  opportunities: PerfOpportunity[];
  error?: string;
}

function ratingFromScore(s: number | null): Rating | null {
  if (s === null) return null;
  if (s >= 0.9) return "good";
  if (s >= 0.5) return "average";
  return "poor";
}

const METRIC_IDS: [string, string][] = [
  ["first-contentful-paint", "First Contentful Paint"],
  ["largest-contentful-paint", "Largest Contentful Paint"],
  ["total-blocking-time", "Total Blocking Time"],
  ["cumulative-layout-shift", "Cumulative Layout Shift"],
  ["speed-index", "Speed Index"],
];

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export async function getPerformance(
  rawUrl: string,
  strategy: Strategy
): Promise<PerfResult> {
  const url = normalizeUrl(rawUrl);
  const api = new URL(
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
  );
  api.searchParams.set("url", url);
  api.searchParams.set("strategy", strategy);
  api.searchParams.append("category", "performance");
  const key = process.env.PAGESPEED_API_KEY;
  if (key) api.searchParams.set("key", key);

  // O PageSpeed roda o Lighthouse ao vivo na 1ª análise de uma URL (lento);
  // a 2ª chamada normalmente pega o resultado em cache do Google e é rápida.
  // Por isso tentamos até 2 vezes, cada uma com timeout curto.
  const ATTEMPTS = 2;
  const PER_ATTEMPT_MS = 28000;
  let lastError = "Falha ao consultar o PageSpeed.";

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PER_ATTEMPT_MS);
    try {
      const res = await fetch(api.toString(), { signal: controller.signal });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        // Em 429 NÃO reintentamos (piora o rate limit por minuto) — retornamos direto.
        return {
          strategy,
          score: null,
          metrics: [],
          opportunities: [],
          error:
            res.status === 429
              ? "PageSpeed atingiu o limite por minuto. Aguarde ~1 min e clique em Auditar de novo."
              : `PageSpeed respondeu HTTP ${res.status}. ${detail.slice(0, 120)}`,
        };
      }
      const data = await res.json();
      const rawScore = data?.lighthouseResult?.categories?.performance?.score;
      const score =
        typeof rawScore === "number" ? Math.round(rawScore * 100) : null;
      const audits: Record<string, {
        id?: string;
        title?: string;
        displayValue?: string;
        score?: number | null;
        details?: { type?: string; overallSavingsMs?: number };
      }> = data?.lighthouseResult?.audits ?? {};
      const metrics: PerfMetric[] = METRIC_IDS.map(([id, label]) => {
        const s = typeof audits[id]?.score === "number" ? audits[id]!.score! : null;
        return { id, label, display: audits[id]?.displayValue ?? "—", score: s, rating: ratingFromScore(s) };
      });
      const opportunities: PerfOpportunity[] = Object.entries(audits)
        .filter(([, a]) => a?.details?.type === "opportunity" && (a.details.overallSavingsMs ?? 0) > 100)
        .map(([id, a]) => ({
          id,
          title: a.title ?? id,
          display: a.displayValue ?? "",
          savingsMs: Math.round(a.details!.overallSavingsMs ?? 0),
        }))
        .sort((x, y) => y.savingsMs - x.savingsMs)
        .slice(0, 8);
      return { strategy, score, metrics, opportunities };
    } catch (err) {
      lastError =
        err instanceof Error && err.name === "AbortError"
          ? "A análise de desempenho demorou demais. Tente novamente."
          : "Falha ao consultar o PageSpeed.";
      // Em timeout, tenta de novo (o Google costuma cachear e responder rápido).
    } finally {
      clearTimeout(timer);
    }
  }
  return { strategy, score: null, metrics: [], opportunities: [], error: lastError };
}
