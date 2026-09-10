// Captura de screenshot da página com o elemento problemático destacado,
// usando Chromium headless. Em produção (Vercel) usa @sparticuz/chromium;
// localmente usa o Chrome instalado no sistema.

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// Caminhos comuns do Chrome por sistema, para desenvolvimento local.
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
    return {
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true as const,
    };
  }
  const fs = await import("node:fs");
  const local = LOCAL_CHROME_PATHS.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
  return {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: local ?? undefined,
    headless: true as const,
  };
}

export async function screenshotElement(
  rawUrl: string,
  selector?: string
): Promise<Buffer> {
  const url = normalizeUrl(rawUrl);
  const opts = await resolveLaunchOptions();

  const browser = await puppeteer.launch({
    args: opts.args,
    executablePath: opts.executablePath,
    headless: opts.headless,
    defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (compatible; SiteAuditTool/1.0; +https://github.com/W1lliamSilva/Audit-website)"
    );
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    let highlighted = false;
    if (selector) {
      highlighted = await page.evaluate((sel) => {
        let node: Element | null = null;
        try {
          node = document.querySelector(sel);
        } catch {
          node = null;
        }
        if (!node) return false;
        node.scrollIntoView({ block: "center", inline: "center" });
        const el = node as HTMLElement;
        el.style.setProperty("outline", "3px solid #e32d14", "important");
        el.style.setProperty("outline-offset", "2px", "important");
        el.style.setProperty("box-shadow", "0 0 0 6px rgba(227,45,20,0.25)", "important");
        return true;
      }, selector);
      if (highlighted) {
        await new Promise((r) => setTimeout(r, 350)); // aguarda o scroll assentar
      }
    }

    const buffer = (await page.screenshot({
      type: "png",
      fullPage: false,
    })) as Buffer;
    return buffer;
  } finally {
    await browser.close();
  }
}
