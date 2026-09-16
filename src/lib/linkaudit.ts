// Executa o LinkAudit (portado da extensão) via Chromium headless:
// roda `extract` no navegador em 3 larguras (1440/768/390) e `analyse` no Node.
// Detecta links sem destino, botões sem ação, links incoerentes, aninhados,
// externos sem nova aba, texto por dispositivo, área de clique e logo sem link.

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { CORE_B64 } from "./linkaudit-core-b64";

const CORE_SRC = Buffer.from(CORE_B64, "base64").toString("utf8");

/* eslint-disable @typescript-eslint/no-explicit-any */
let nodeCore: any = null;
function getNodeCore(): any {
  if (!nodeCore) {
    new Function(CORE_SRC)();
    nodeCore = (globalThis as any).__LA;
    if (nodeCore?.CFG) nodeCore.CFG.lang = "pt";
  }
  return nodeCore;
}

export interface LinkAuditFinding {
  check: string;
  sev: "error" | "warn";
  typeLabel: string; // "Botão sem link", etc.
  text: string; // texto do elemento
  description: string;
  href: string | null;
  resolved: string | null;
  selector: string;
  region: string;
  kind: string; // "a" | "button" | ""
}

export interface LinkAuditResult {
  findings: LinkAuditFinding[];
  pageUrl: string;
  error?: string;
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

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export async function runLinkAudit(rawUrl: string): Promise<LinkAuditResult> {
  const url = normalizeUrl(rawUrl);
  const core = getNodeCore();
  const widths: number[] = core?.CFG?.widths ?? [1440, 768, 390];

  const opts = await resolveLaunchOptions();
  let browser;
  try {
    browser = await puppeteer.launch({
      args: opts.args,
      executablePath: opts.executablePath,
      headless: opts.headless,
      defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (compatible; SiteAuditTool/1.0; +https://github.com/W1lliamSilva/Audit-website)"
    );

    const snaps: unknown[] = [];
    let finalUrl = url;
    for (const width of widths) {
      await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
      } catch {
        // segue com o que carregou
      }
      finalUrl = page.url() || finalUrl;
      await page.evaluate(CORE_SRC);
      const snap = await page.evaluate(
        (w: number) => (window as any).__LA.extract(window, document, w, true),
        width
      );
      snaps.push(snap);
    }

    const raw: any[] = core.analyse(finalUrl, snaps) ?? [];
    const findings: LinkAuditFinding[] = raw.map((f) => ({
      check: f.check,
      sev: f.sev === "error" ? "error" : "warn",
      typeLabel: core.t("c." + f.check),
      text: f.label || "",
      description: core.t(f.key, core.resolveArgs(f.args)),
      href: f.href ?? null,
      resolved: f.resolved ?? null,
      selector: f.selector || "",
      region: f.region || "",
      kind: f.kind || f.tag || "",
    }));

    return { findings, pageUrl: finalUrl };
  } catch (err) {
    const error = err instanceof Error ? `Falha na análise de links: ${err.message}` : "Falha na análise de links.";
    return { findings: [], pageUrl: url, error };
  } finally {
    if (browser) await browser.close();
  }
}
