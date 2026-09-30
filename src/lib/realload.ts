// Mede o tempo REAL de carregamento da página agora, sem nenhuma simulação
// de rede/dispositivo lento — complementa a nota do Lighthouse/PageSpeed
// (que testa em condições padronizadas mais lentas de propósito, para
// representar um "pior caso" comum, não a experiência real de agora). Um
// site com nota baixa no Lighthouse pode carregar rapidíssimo na prática, e
// vice-versa — por isso os dois números são mostrados lado a lado, nunca
// misturados num só.

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import type { Strategy } from "./performance";

const USER_AGENT =
  "Mozilla/5.0 (compatible; SiteAuditTool/1.0; +https://github.com/W1lliamSilva/Audit-website)";

export interface RealLoadResult {
  strategy: Strategy;
  /** Tempo até o primeiro byte da resposta (ms). */
  ttfbMs: number | null;
  /** Tempo até o DOM estar pronto/parseado (ms). */
  domContentLoadedMs: number | null;
  /** Tempo até o evento `load` — todos os recursos da página carregados (ms). */
  loadMs: number | null;
  /** Primeira pintura de qualquer pixel na tela (ms), quando disponível. */
  firstPaintMs: number | null;
  /** Primeira pintura de conteúdo (texto/imagem) (ms), quando disponível. */
  firstContentfulPaintMs: number | null;
  error?: string;
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const LOCAL_CHROME_PATHS = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
].filter(Boolean) as string[];

async function resolveLaunchOptions() {
  const onVercel = !!process.env.VERCEL || !!process.env.AWS_REGION;
  if (onVercel) {
    return { args: chromium.args, executablePath: await chromium.executablePath(), headless: true as const };
  }
  const fs = await import("node:fs");
  const local = LOCAL_CHROME_PATHS.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
  return { args: ["--no-sandbox", "--disable-setuid-sandbox"], executablePath: local ?? undefined, headless: true as const };
}

// Só o tamanho de tela/UA muda entre desktop e mobile — nenhum throttling de
// rede ou CPU é aplicado (essa é justamente a diferença para o Lighthouse).
const VIEWPORTS: Record<Strategy, { width: number; height: number; isMobile: boolean; hasTouch: boolean; deviceScaleFactor: number }> = {
  desktop: { width: 1366, height: 768, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
};

export async function measureRealLoad(rawUrl: string, strategy: Strategy): Promise<RealLoadResult> {
  const url = normalizeUrl(rawUrl);
  const empty: Omit<RealLoadResult, "error"> = {
    strategy,
    ttfbMs: null,
    domContentLoadedMs: null,
    loadMs: null,
    firstPaintMs: null,
    firstContentfulPaintMs: null,
  };
  const opts = await resolveLaunchOptions();
  let browser;
  try {
    browser = await puppeteer.launch({
      args: opts.args,
      executablePath: opts.executablePath,
      headless: opts.headless,
    });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport(VIEWPORTS[strategy]);
    // waitUntil "load" garante que o evento `load` do navegador já disparou
    // quando chegamos aqui, então `loadEventEnd` abaixo já está preenchido.
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    // O Paint Timing (first-paint/first-contentful-paint) às vezes só é
    // registrado alguns instantes depois do `load` — espera até 2s por ele
    // antes de ler os tempos, sem travar a medição caso ele nunca apareça.
    await page
      .waitForFunction(() => performance.getEntriesByType("paint").length > 0, { timeout: 2000 })
      .catch(() => {});

    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const paints = performance.getEntriesByType("paint");
      const firstPaint = paints.find((p) => p.name === "first-paint")?.startTime ?? null;
      const firstContentfulPaint = paints.find((p) => p.name === "first-contentful-paint")?.startTime ?? null;
      return {
        ttfbMs: nav ? Math.round(nav.responseStart) : null,
        domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
        loadMs: nav ? Math.round(nav.loadEventEnd) : null,
        firstPaintMs: firstPaint !== null ? Math.round(firstPaint) : null,
        firstContentfulPaintMs: firstContentfulPaint !== null ? Math.round(firstContentfulPaint) : null,
      };
    });

    return { strategy, ...timing };
  } catch (err) {
    const error =
      err instanceof Error
        ? err.name === "TimeoutError"
          ? "A página demorou demais para carregar (timeout)."
          : `Falha ao medir o carregamento: ${err.message}`
        : "Falha ao medir o carregamento da página.";
    return { ...empty, error };
  } finally {
    if (browser) await browser.close();
  }
}
