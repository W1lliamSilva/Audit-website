// Coleta imagens SEM alt text a partir do DOM renderizado (via Chromium
// headless), pegando também src, dimensões, seção e seletor. Usar o DOM
// renderizado é essencial para sites que montam as imagens via JavaScript
// (Framer, React, Next), onde a análise estática do HTML não as enxerga.

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const USER_AGENT =
  "Mozilla/5.0 (compatible; SiteAuditTool/1.0; +https://github.com/W1lliamSilva/Audit-website)";

export interface ImageIssue {
  src: string;
  alt: string | null; // null = atributo ausente; "" = vazio
  width: number;
  height: number;
  bytes: number | null; // peso do arquivo (Content-Length), quando disponível
  /** Por que `bytes` ficou null (ex.: "HTTP 403", "timeout", "erro de rede"). */
  weightError?: string;
  selector: string;
  location: string;
  page: string; // URL da página onde a imagem foi encontrada
}

export interface ImagesResult {
  total: number;
  withoutAlt: ImageIssue[];
  pageUrl: string; // primeira página (auditada)
  pages: string[]; // páginas efetivamente varridas
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

const MAX_PAGES = 6;
const OVERALL_BUDGET_MS = 150000;
const MAX_IMAGES = 120;

/** Descobre páginas do site via sitemap.xml (com índice) e, em fallback, pelos
 *  links internos da home. Leve (fetch, sem navegador). */
async function discoverPages(base: URL): Promise<string[]> {
  const headers = { "user-agent": USER_AGENT, accept: "application/xml,text/xml,text/html" };
  async function fetchText(u: string): Promise<string | null> {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 10000);
      const r = await fetch(u, { headers, signal: c.signal, redirect: "follow" });
      clearTimeout(t);
      return r.ok ? await r.text() : null;
    } catch {
      return null;
    }
  }
  const home = base.toString();
  for (const sm of [new URL("/sitemap.xml", base).toString(), new URL("/sitemap_index.xml", base).toString()]) {
    const xml = await fetchText(sm);
    if (!xml) continue;
    const childs = [...xml.matchAll(/<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>[\s\S]*?<\/sitemap>/g)].map((m) => m[1].trim());
    let locs: string[] = [];
    if (childs.length) {
      const cx = await fetchText(childs[0]);
      if (cx) locs = [...cx.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    }
    if (!locs.length) locs = [...xml.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    if (locs.length) return locs.filter((u) => { try { return new URL(u).host === base.host; } catch { return false; } });
  }
  const html = await fetchText(home);
  if (html) {
    const set = new Set<string>([home]);
    for (const m of html.matchAll(/href=["']([^"'#]+)["']/g)) {
      try {
        const u = new URL(m[1], base);
        if (u.host === base.host && /^https?:/.test(u.protocol)) {
          u.hash = "";
          set.add(u.toString());
        }
      } catch {}
    }
    return [...set];
  }
  return [home];
}

type PuppeteerPage = Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>["newPage"]>>;

/** Rola a página (lazy-load) e coleta todas as <img> do DOM renderizado. */
async function scanImagesOnPage(page: PuppeteerPage) {
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

  return page.evaluate(() => {
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

      // `currentSrc`/`src` (propriedades do DOM) já vêm absolutos do browser.
      // `data-src` (atributo cru, usado por libs de lazy-load quando a imagem
      // ainda não carregou) pode vir relativo — precisa resolver manualmente,
      // senão o fetch de peso no servidor falha por não ser uma URL válida.
      function resolveSrc(raw: string): string {
        if (!raw) return "";
        try {
          return new URL(raw, document.baseURI).href;
        } catch {
          return raw;
        }
      }

      const imgs = Array.from(document.querySelectorAll("img"));
      const all = imgs.map((img) => ({
        src:
          (img as HTMLImageElement).currentSrc ||
          (img as HTMLImageElement).src ||
          resolveSrc(img.getAttribute("data-src") ?? ""),
        alt: img.hasAttribute("alt") ? img.getAttribute("alt") : null,
        width: (img as HTMLImageElement).naturalWidth || 0,
        height: (img as HTMLImageElement).naturalHeight || 0,
        selector: cssPath(img),
        location: locationOf(img),
      }));
      return { total: all.length, all };
    });
}

export async function getImagesWithoutAlt(rawUrl: string): Promise<ImagesResult> {
  const url = normalizeUrl(rawUrl);
  let base: URL;
  try {
    base = new URL(url);
  } catch {
    return { total: 0, withoutAlt: [], pageUrl: url, pages: [], error: "URL inválida." };
  }
  const started = Date.now();
  const opts = await resolveLaunchOptions();
  let browser;
  try {
    // Descobre páginas do site (a auditada vem primeiro), limitado a MAX_PAGES.
    const discovered = await discoverPages(base);
    const ordered = [url, ...discovered.filter((u) => u !== url)].slice(0, MAX_PAGES);

    browser = await puppeteer.launch({
      args: opts.args,
      executablePath: opts.executablePath,
      headless: opts.headless,
      defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 1 },
    });
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    let total = 0;
    const scannedPages: string[] = [];
    const rawAll: Omit<ImageIssue, "bytes">[] = [];
    const seen = new Set<string>(); // dedupe por src (fica na 1ª página em que aparece)

    for (const pUrl of ordered) {
      if (Date.now() - started > OVERALL_BUDGET_MS || rawAll.length >= MAX_IMAGES) break;
      try {
        await page.goto(pUrl, { waitUntil: "networkidle2", timeout: 30000 });
      } catch {
        continue; // página que não carregou: pula
      }
      const finalP = page.url() || pUrl;
      let scan;
      try {
        scan = await scanImagesOnPage(page);
      } catch {
        continue;
      }
      scannedPages.push(finalP);
      total += scan.total;
      for (const im of scan.all) {
        if ((im.alt === null || im.alt.trim() === "") && im.src && !im.src.startsWith("data:")) {
          if (seen.has(im.src)) continue;
          seen.add(im.src);
          rawAll.push({
            src: im.src,
            alt: im.alt,
            width: im.width,
            height: im.height,
            selector: im.selector,
            location: im.location,
            page: finalP,
          });
          if (rawAll.length >= MAX_IMAGES) break;
        }
      }
    }

    const withoutAlt = await addSizes(rawAll);
    return { total, withoutAlt, pageUrl: scannedPages[0] || url, pages: scannedPages };
  } catch (err) {
    const error =
      err instanceof Error
        ? err.name === "TimeoutError"
          ? "A página demorou demais para carregar (timeout)."
          : `Falha ao analisar as imagens: ${err.message}`
        : "Falha ao analisar as imagens da página.";
    return { total: 0, withoutAlt: [], pageUrl: url, pages: [], error };
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Busca o peso e, quando necessário, a resolução de cada imagem, com
 * concorrência limitada. Tenta primeiro um HEAD (peso via Content-Length,
 * sem baixar o arquivo); se o peso ainda faltar (chunked, sem header) OU a
 * resolução ainda faltar (o navegador não conseguiu — comum em SVG sem
 * width/height explícitos, ou imagens que só carregaram via lazy-load depois
 * da varredura do DOM), baixa o arquivo inteiro uma única vez e usa isso para
 * preencher os dois: o tamanho real do corpo baixado vira o peso, e o
 * `sharp` lê as dimensões reais dos bytes. Funciona igual para qualquer
 * formato (png, jpg/jpeg, gif, svg, webp, avif…), já que a medição é sobre
 * os bytes crus da resposta, não sobre o tipo de imagem.
 *
 * Envia User-Agent + Referer (a própria página auditada), pois muitos CDNs
 * com proteção anti-hotlink (Cloudflare Images, Shopify, imgix, WixStatic…)
 * bloqueiam requisições sem esses headers.
 */
async function addSizes(
  imgs: Omit<ImageIssue, "bytes">[]
): Promise<ImageIssue[]> {
  const CONCURRENCY = 6;
  const TIMEOUT_MS = 12000;
  // Referer = a página onde a imagem apareceu (anti-hotlink de CDNs). Definido
  // por imagem no worker; este é só o fallback de accept/user-agent.
  const baseHeaders = { "user-agent": USER_AGENT, accept: "image/*,*/*;q=0.8" };
  const result: ImageIssue[] = imgs.map((im) => ({ ...im, bytes: null }));
  const queue = result.map((_, i) => i);

  async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fn(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  function reasonFromError(err: unknown): string {
    return err instanceof Error && err.name === "AbortError" ? "timeout" : "erro de rede";
  }

  // Alguns servidores/CDNs respondem HEAD com "Content-Length: 0" (corpo
  // vazio de propósito, sem calcular o tamanho real) — um `parseInt` ingênuo
  // aceitaria isso como "peso = 0 bytes", que a UI então trata como "sem
  // peso" (ver formatBytes) mas SEM motivo nenhum, um "—" mudo enganoso.
  // Só aceita um Content-Length estritamente positivo como peso válido.
  function parsePositiveLength(len: string | null): number | null {
    if (!len) return null;
    const n = parseInt(len, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  async function worker() {
    while (queue.length) {
      const i = queue.shift();
      if (i === undefined) break;
      const src = result[i].src;
      const headers = { ...baseHeaders, referer: result[i].page || src };
      // Motivo de por que o peso não foi obtido — só vira `weightError` no
      // final se `bytes` continuar null (uma tentativa seguinte que dá certo
      // sempre limpa o motivo de uma tentativa anterior que falhou).
      let reason: string | null = null;
      try {
        try {
          await withTimeout(async (signal) => {
            const head = await fetch(src, { method: "HEAD", headers, signal });
            const len = parsePositiveLength(head.headers.get("content-length"));
            if (head.ok && len !== null) {
              result[i].bytes = len;
            } else if (!head.ok) {
              // Muitos servidores rejeitam HEAD (405) mesmo aceitando GET —
              // não é definitivo ainda, só um candidato a motivo.
              reason = `HTTP ${head.status}`;
            }
          });
        } catch (err) {
          reason = reasonFromError(err);
        }

        const missingWeight = result[i].bytes === null;
        const missingDims = !result[i].width || !result[i].height;
        if (missingWeight || missingDims) {
          try {
            await withTimeout(async (signal) => {
              const res = await fetch(src, { method: "GET", headers, signal });
              if (!res.ok) {
                reason = `HTTP ${res.status}`;
                return;
              }
              reason = null; // GET respondeu OK — descarta qualquer motivo do HEAD.
              const len = parsePositiveLength(res.headers.get("content-length"));
              if (missingWeight && len !== null) {
                result[i].bytes = len;
              }
              // Precisa dos bytes crus tanto para medir o peso sem
              // Content-Length (ou com um valor inválido, tipo 0) quanto
              // para ler a resolução via sharp.
              if ((missingWeight && len === null) || missingDims) {
                const ab = await res.arrayBuffer();
                if (result[i].bytes === null && ab.byteLength > 0) result[i].bytes = ab.byteLength;
                if (missingDims) {
                  try {
                    const meta = await sharp(Buffer.from(ab)).metadata();
                    if (meta.width && meta.height) {
                      result[i].width = meta.width;
                      result[i].height = meta.height;
                    }
                  } catch {
                    // formato não suportado pelo sharp (ex.: SVG malformado) — ignora
                  }
                }
              }
            });
          } catch (err) {
            reason = reasonFromError(err);
          }
        }
      } catch {
        // ignora — bytes/width/height ficam como estavam
      }
      if (result[i].bytes === null) {
        result[i].weightError = reason ?? "peso indisponível";
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  return result;
}
