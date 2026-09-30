// Simula o carregamento da página sob perfis de conexão típicos (Wi-Fi, 4G,
// 3G rápido, 3G lento), rodando o Chromium localmente via Puppeteer — sem
// depender da API do Google PageSpeed (externa, com rate limit). Não busca
// reproduzir a nota 0–100 do Lighthouse; mede o tempo de carregamento real
// sob cada condição de rede, usando os mesmos perfis de banda/latência que o
// Chrome DevTools usa para "Network throttling".

import chromium from "@sparticuz/chromium";
import puppeteer, { PredefinedNetworkConditions, type NetworkConditions } from "puppeteer-core";
import type { Strategy } from "./performance";

const USER_AGENT =
  "Mozilla/5.0 (compatible; SiteAuditTool/1.0; +https://github.com/W1lliamSilva/Audit-website)";

export type ConnectionProfileId = "wifi" | "4g" | "3g-fast" | "3g-slow";

export interface ConnectionProfile {
  id: ConnectionProfileId;
  label: string;
  /** null = sem limitação (Wi-Fi/banda larga). */
  network: NetworkConditions | null;
}

// Mesmos perfis do Chrome DevTools ("Network throttling"), menos duplicatas
// (o preset "Slow 4G" do Chrome tem os mesmos números do "Fast 3G").
export const CONNECTION_PROFILES: ConnectionProfile[] = [
  { id: "wifi", label: "Wi-Fi / banda larga", network: null },
  { id: "4g", label: "4G", network: PredefinedNetworkConditions["Fast 4G"] },
  { id: "3g-fast", label: "3G rápido", network: PredefinedNetworkConditions["Fast 3G"] },
  { id: "3g-slow", label: "3G lento", network: PredefinedNetworkConditions["Slow 3G"] },
];

export interface SimulatedProfileResult {
  id: ConnectionProfileId;
  label: string;
  domContentLoadedMs: number | null;
  loadMs: number | null;
  error?: string;
}

export interface SimulateResult {
  strategy: Strategy;
  profiles: SimulatedProfileResult[];
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

const VIEWPORTS: Record<Strategy, { width: number; height: number; isMobile: boolean; hasTouch: boolean; deviceScaleFactor: number }> = {
  desktop: { width: 1366, height: 768, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
};

const PER_PROFILE_TIMEOUT_MS = 45000;

export async function simulateLoadAcrossProfiles(rawUrl: string, strategy: Strategy): Promise<SimulateResult> {
  const url = normalizeUrl(rawUrl);
  const opts = await resolveLaunchOptions();
  const profiles: SimulatedProfileResult[] = [];
  let browser;
  try {
    browser = await puppeteer.launch({
      args: opts.args,
      executablePath: opts.executablePath,
      headless: opts.headless,
    });

    // Sequencial (não em paralelo): cada perfil abre sua própria aba, sem
    // cache/cookies da anterior, e evita sobrecarregar o site auditado com
    // 4 cargas simultâneas.
    for (const profile of CONNECTION_PROFILES) {
      const page = await browser.newPage();
      try {
        await page.setUserAgent(USER_AGENT);
        await page.setViewport(VIEWPORTS[strategy]);
        await page.emulateNetworkConditions(profile.network);
        await page.goto(url, { waitUntil: "load", timeout: PER_PROFILE_TIMEOUT_MS });

        const timing = await page.evaluate(() => {
          const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
          return {
            domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
            loadMs: nav ? Math.round(nav.loadEventEnd) : null,
          };
        });
        profiles.push({ id: profile.id, label: profile.label, ...timing });
      } catch (err) {
        const error =
          err instanceof Error && err.name === "TimeoutError"
            ? "Demorou demais para carregar nessa conexão (timeout)."
            : "Falha ao simular o carregamento nessa conexão.";
        profiles.push({ id: profile.id, label: profile.label, domContentLoadedMs: null, loadMs: null, error });
      } finally {
        await page.close();
      }
    }

    return { strategy, profiles };
  } catch {
    return {
      strategy,
      profiles: CONNECTION_PROFILES.map((p) => ({
        id: p.id,
        label: p.label,
        domContentLoadedMs: null,
        loadMs: null,
        error: "Falha ao iniciar a simulação.",
      })),
    };
  } finally {
    if (browser) await browser.close();
  }
}
