// Auditoria de SEO em várias páginas do site. Descobre as páginas via
// sitemap.xml (com fallback nos links internos da home) e roda as checagens
// de SEO em cada uma.

import * as cheerio from "cheerio";
import type { CheckResult } from "./audit";

const USER_AGENT =
  "Mozilla/5.0 (compatible; SiteAuditTool/1.0; +https://github.com/W1lliamSilva/Audit-website)";
const MAX_PAGES = 10;
const FETCH_TIMEOUT = 12000;
const CONCURRENCY = 5;

export interface PageSeo {
  url: string;
  checks: CheckResult[];
  totals: { pass: number; warn: number; fail: number };
  error?: string;
}

export interface SeoResult {
  pages: PageSeo[];
  source: "sitemap" | "links";
  error?: string;
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function fetchText(url: string, accept = "text/html"): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": USER_AGENT, accept },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Lê URLs de um sitemap (suporta sitemap index apontando para outros sitemaps). */
async function fromSitemap(base: URL): Promise<string[]> {
  const candidates = [
    new URL("/sitemap.xml", base).toString(),
    new URL("/sitemap_index.xml", base).toString(),
  ];
  for (const sm of candidates) {
    const xml = await fetchText(sm, "application/xml,text/xml");
    if (!xml) continue;
    const $ = cheerio.load(xml, { xmlMode: true });
    // Sitemap index → pega o primeiro sitemap filho.
    const childSitemaps = $("sitemap > loc").map((_, el) => $(el).text().trim()).get();
    if (childSitemaps.length > 0) {
      const childXml = await fetchText(childSitemaps[0], "application/xml,text/xml");
      if (childXml) {
        const $c = cheerio.load(childXml, { xmlMode: true });
        const urls = $c("url > loc").map((_, el) => $c(el).text().trim()).get();
        if (urls.length) return urls;
      }
    }
    const urls = $("url > loc").map((_, el) => $(el).text().trim()).get();
    if (urls.length) return urls;
  }
  return [];
}

/** Fallback: links internos da home. */
async function fromInternalLinks(base: URL, homeHtml: string): Promise<string[]> {
  const $ = cheerio.load(homeHtml);
  const set = new Set<string>([base.toString()]);
  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href || /^(#|mailto:|tel:|javascript:|data:)/i.test(href)) return;
    try {
      const abs = new URL(href, base);
      if (abs.host === base.host) {
        abs.hash = "";
        set.add(abs.toString());
      }
    } catch {}
  });
  return Array.from(set);
}

function seoChecksFromHtml(html: string): { checks: CheckResult[]; totals: PageSeo["totals"] } {
  const $ = cheerio.load(html);
  const checks: CheckResult[] = [];

  const title = $("head > title").first().text().trim();
  if (!title) checks.push({ id: "title", label: "Título (<title>)", status: "fail", message: "A página não tem <title>." });
  else if (title.length < 10 || title.length > 60) checks.push({ id: "title", label: "Título (<title>)", status: "warn", message: `Título com ${title.length} caracteres (ideal: 10–60).`, details: [title] });
  else checks.push({ id: "title", label: "Título (<title>)", status: "pass", message: `OK (${title.length} caracteres).`, details: [title] });

  const desc = $('meta[name="description"]').attr("content")?.trim() ?? "";
  if (!desc) checks.push({ id: "description", label: "Meta description", status: "fail", message: "Sem meta description." });
  else if (desc.length < 50 || desc.length > 160) checks.push({ id: "description", label: "Meta description", status: "warn", message: `Description com ${desc.length} caracteres (ideal: 50–160).` });
  else checks.push({ id: "description", label: "Meta description", status: "pass", message: `OK (${desc.length} caracteres).` });

  const h1s = $("h1");
  if (h1s.length === 0) checks.push({ id: "h1", label: "Cabeçalho H1", status: "fail", message: "Nenhum <h1> encontrado." });
  else if (h1s.length > 1) checks.push({ id: "h1", label: "Cabeçalho H1", status: "warn", message: `${h1s.length} <h1> (o ideal é um único).` });
  else checks.push({ id: "h1", label: "Cabeçalho H1", status: "pass", message: "Um único <h1>, como recomendado." });

  const lang = $("html").attr("lang")?.trim();
  checks.push(lang ? { id: "lang", label: "Idioma (lang)", status: "pass", message: `Definido como "${lang}".` } : { id: "lang", label: "Idioma (lang)", status: "fail", message: 'O <html> não tem atributo "lang".' });

  const viewport = $('meta[name="viewport"]').attr("content")?.trim();
  checks.push(viewport ? { id: "viewport", label: "Meta viewport", status: "pass", message: "Configurado (responsivo)." } : { id: "viewport", label: "Meta viewport", status: "warn", message: "Sem meta viewport." });

  const canonical = $('link[rel="canonical"]').attr("href")?.trim();
  checks.push(canonical ? { id: "canonical", label: "URL canônica", status: "pass", message: "Definida." } : { id: "canonical", label: "URL canônica", status: "warn", message: "Sem link canonical." });

  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim();
  checks.push(ogTitle && ogImage ? { id: "og", label: "Open Graph", status: "pass", message: "og:title e og:image presentes." } : { id: "og", label: "Open Graph", status: "warn", message: "Open Graph incompleto." });

  const totals = {
    pass: checks.filter((c) => c.status === "pass").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
  };
  return { checks, totals };
}

export async function getSeoForPages(rawUrl: string): Promise<SeoResult> {
  const url = normalizeUrl(rawUrl);
  let base: URL;
  try {
    base = new URL(url);
  } catch {
    return { pages: [], source: "links", error: "URL inválida." };
  }

  // 1. Descobrir páginas
  let urls: string[] = [];
  let source: "sitemap" | "links" = "sitemap";
  urls = await fromSitemap(base);
  if (urls.length === 0) {
    source = "links";
    const home = await fetchText(url);
    if (home) urls = await fromInternalLinks(base, home);
    else urls = [url];
  }

  // Garante a URL auditada como primeira e limita a quantidade.
  const ordered = [url, ...urls.filter((u) => u !== url)].slice(0, MAX_PAGES);

  // 2. Auditar SEO de cada página (concorrência limitada)
  const pages: PageSeo[] = new Array(ordered.length);
  const queue = ordered.map((_, i) => i);
  async function worker() {
    while (queue.length) {
      const i = queue.shift();
      if (i === undefined) break;
      const pageUrl = ordered[i];
      const html = await fetchText(pageUrl);
      if (!html) {
        pages[i] = { url: pageUrl, checks: [], totals: { pass: 0, warn: 0, fail: 0 }, error: "Não foi possível carregar a página." };
        continue;
      }
      const { checks, totals } = seoChecksFromHtml(html);
      pages[i] = { url: pageUrl, checks, totals };
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  return { pages, source };
}
