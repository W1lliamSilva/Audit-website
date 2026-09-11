// Coleta imagens SEM alt text a partir do DOM renderizado (via Chromium
// headless), pegando também src, dimensões, seção e seletor. Usar o DOM
// renderizado é essencial para sites que montam as imagens via JavaScript
// (Framer, React, Next), onde a análise estática do HTML não as enxerga.

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export interface ImageIssue {
  src: string;
  alt: string | null; // null = atributo ausente; "" = vazio
  width: number;
  height: number;
  bytes: number | null; // peso do arquivo (Content-Length), quando disponível
  selector: string;
  location: string;
}

export interface ImagesResult {
  total: number;
  withoutAlt: ImageIssue[];
  pageUrl: string; // página auditada onde as imagens estão
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

export async function getImagesWithoutAlt(rawUrl: string): Promise<ImagesResult> {
  const url = normalizeUrl(rawUrl);
  const opts = await resolveLaunchOptions();
  let browser;
  try {
    browser = await puppeteer.launch({
      args: opts.args,
      executablePath: opts.executablePath,
      headless: opts.headless,
      defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 1 },
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (compatible; SiteAuditTool/1.0; +https://github.com/W1lliamSilva/Audit-website)"
    );
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    // Rola a página para disparar lazy-loading de imagens.
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let y = 0;
        const step = () => {
          window.scrollBy(0, 800);
          y += 800;
          if (y >= document.body.scrollHeight || y > 20000) {
            window.scrollTo(0, 0);
            resolve();
          } else {
            setTimeout(step, 100);
          }
        };
        step();
      });
    });
    await new Promise((r) => setTimeout(r, 400));

    const data = await page.evaluate(() => {
      const LANDMARKS = ["header", "nav", "main", "footer", "aside", "form", "section", "article"];
      function elSelector(el: Element): string {
        const tag = el.tagName.toLowerCase();
        if (el.id) return `${tag}#${el.id}`;
        const cls = (el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean)[0];
        return cls ? `${tag}.${cls}` : tag;
      }
      function locationOf(el: Element): string {
        const land = el.closest(LANDMARKS.join(","));
        const self = elSelector(el);
        if (!land) return self;
        const lt = land.tagName.toLowerCase();
        const lm = land.id ? `${lt}#${land.id}` : lt;
        return lm === self ? self : `${lm} › ${self}`;
      }
      function cssPath(el: Element): string {
        const parts: string[] = [];
        let cur: Element | null = el;
        let depth = 0;
        while (cur && cur.tagName && depth < 8) {
          const tag = cur.tagName.toLowerCase();
          if (tag === "html" || tag === "body") {
            parts.unshift(tag);
            break;
          }
          if (cur.id) {
            parts.unshift(`#${cur.id}`);
            break;
          }
          const framer = cur.getAttribute("data-framer-name");
          if (framer) {
            parts.unshift(`${tag}[data-framer-name="${framer}"]`);
          } else {
            const parent: Element | null = cur.parentElement;
            let nth = 1;
            if (parent) {
              const same = Array.from(parent.children).filter((c) => c.tagName.toLowerCase() === tag);
              const idx = same.indexOf(cur);
              nth = idx >= 0 ? idx + 1 : 1;
            }
            parts.unshift(`${tag}:nth-of-type(${nth})`);
          }
          cur = cur.parentElement;
          depth++;
        }
        return parts.join(" > ");
      }

      const imgs = Array.from(document.querySelectorAll("img"));
      const all = imgs.map((img) => ({
        src: (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || img.getAttribute("data-src") || "",
        alt: img.hasAttribute("alt") ? img.getAttribute("alt") : null,
        width: (img as HTMLImageElement).naturalWidth || 0,
        height: (img as HTMLImageElement).naturalHeight || 0,
        selector: cssPath(img),
        location: locationOf(img),
      }));
      return { total: all.length, all };
    });

    const pageUrl = page.url() || url;
    const withoutAltRaw = data.all.filter(
      (im) => (im.alt === null || im.alt.trim() === "") && im.src && !im.src.startsWith("data:")
    );
    const withoutAlt = await addSizes(withoutAltRaw);
    return { total: data.total, withoutAlt, pageUrl };
  } catch (err) {
    const error =
      err instanceof Error
        ? err.name === "TimeoutError"
          ? "A página demorou demais para carregar (timeout)."
          : `Falha ao analisar as imagens: ${err.message}`
        : "Falha ao analisar as imagens da página.";
    return { total: 0, withoutAlt: [], pageUrl: url, error };
  } finally {
    if (browser) await browser.close();
  }
}

/** Busca o peso (Content-Length) de cada imagem via HEAD, com concorrência limitada. */
async function addSizes(
  imgs: Omit<ImageIssue, "bytes">[]
): Promise<ImageIssue[]> {
  const CONCURRENCY = 6;
  const TIMEOUT_MS = 6000;
  const result: ImageIssue[] = imgs.map((im) => ({ ...im, bytes: null }));
  const queue = result.map((_, i) => i);

  async function worker() {
    while (queue.length) {
      const i = queue.shift();
      if (i === undefined) break;
      const src = result[i].src;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        let res = await fetch(src, { method: "HEAD", signal: controller.signal });
        if (res.status === 405 || res.status === 501 || !res.headers.get("content-length")) {
          res = await fetch(src, { method: "GET", signal: controller.signal });
        }
        clearTimeout(timer);
        const len = res.headers.get("content-length");
        if (len) result[i].bytes = parseInt(len, 10);
      } catch {
        // ignora — bytes fica null
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return result;
}
