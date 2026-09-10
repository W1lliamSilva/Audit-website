// Integração com a API do Google PageSpeed Insights (Lighthouse) para medir
// desempenho no desktop e no mobile.
//
// Sem chave a API funciona, porém com limite de requisições baixo. Para uso
// real, configure PAGESPEED_API_KEY (Google Cloud → PageSpeed Insights API).

export type Strategy = "desktop" | "mobile";

export interface PerfMetric {
  id: string;
  label: string;
  display: string;
}

export interface PerfResult {
  strategy: Strategy;
  score: number | null; // 0–100 (null se indisponível)
  metrics: PerfMetric[];
  error?: string;
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);
  try {
    const res = await fetch(api.toString(), { signal: controller.signal });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        strategy,
        score: null,
        metrics: [],
        error: `PageSpeed respondeu HTTP ${res.status}. ${detail.slice(0, 120)}`,
      };
    }
    const data = await res.json();
    const rawScore = data?.lighthouseResult?.categories?.performance?.score;
    const score =
      typeof rawScore === "number" ? Math.round(rawScore * 100) : null;
    const audits = data?.lighthouseResult?.audits ?? {};
    const metrics: PerfMetric[] = METRIC_IDS.map(([id, label]) => ({
      id,
      label,
      display: audits[id]?.displayValue ?? "—",
    }));
    return { strategy, score, metrics };
  } catch (err) {
    const error =
      err instanceof Error && err.name === "AbortError"
        ? "A análise de desempenho demorou demais (timeout)."
        : "Falha ao consultar o PageSpeed.";
    return { strategy, score: null, metrics: [], error };
  } finally {
    clearTimeout(timer);
  }
}
