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

export interface HeadingItem {
  /** 1–6, correspondendo a h1–h6. */
  level: number;
  text: string;
}

export type HeadingIssueKind = "missing-h1" | "multiple-h1" | "skipped-level" | "empty";

export interface HeadingIssue {
  /** Índice em `headings`; -1 quando o problema é da página como um todo (ex.: falta de h1). */
  index: number;
  kind: HeadingIssueKind;
  message: string;
}

/**
 * Motivo pelo qual uma página não pôde ser digitalizada (lida/analisada):
 * - `http-error`: o servidor respondeu com status >= 400 (ou outro erro HTTP);
 * - `timeout`: não respondeu dentro do limite de tempo;
 * - `network-error`: falha de conexão (DNS, TLS, conexão recusada…);
 * - `invalid-content-type`: respondeu OK, mas o conteúdo não é HTML.
 */
export type ScanErrorKind = "http-error" | "timeout" | "network-error" | "invalid-content-type";

export interface ScanError {
  kind: ScanErrorKind;
  /** Status HTTP, quando aplicável (kind === "http-error"). */
  status?: number;
  message: string;
}

export interface PageSeo {
  url: string;
  checks: CheckResult[];
  totals: { pass: number; warn: number; fail: number };
  /** Todos os h1–h6 da página, em ordem de documento. */
  headings: HeadingItem[];
  /** Problemas de hierarquia (níveis pulados, h1 duplicado/ausente, heading vazio). */
  headingIssues: HeadingIssue[];
  /** Detalhe estruturado de por que a página não pôde ser digitalizada (quando houve falha). */
  scanError?: ScanError;
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

/** Busca uma página e, em caso de falha, descreve exatamente por quê (ver `ScanErrorKind`). */
async function fetchPage(url: string, accept = "text/html"): Promise<{ html: string | null; scanError?: ScanError }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": USER_AGENT, accept },
      signal: controller.signal,
    });
    if (!res.ok) {
      return {
        html: null,
        scanError: { kind: "http-error", status: res.status, message: `O servidor respondeu com HTTP ${res.status}.` },
      };
    }
    if (accept === "text/html") {
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("html")) {
        return {
          html: null,
          scanError: {
            kind: "invalid-content-type",
            message: `A resposta não é HTML (content-type: ${contentType || "desconhecido"}).`,
          },
        };
      }
    }
    return { html: await res.text() };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return {
      html: null,
      scanError: isTimeout
        ? { kind: "timeout", message: `A página não respondeu em ${FETCH_TIMEOUT / 1000}s (timeout).` }
        : { kind: "network-error", message: "Falha de conexão ao tentar acessar a página (DNS, TLS ou rede recusou a conexão)." },
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, accept = "text/html"): Promise<string | null> {
  return (await fetchPage(url, accept)).html;
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

/** Extrai todos os h1–h6 da página, na ordem em que aparecem no documento. */
function extractHeadings($: cheerio.CheerioAPI): HeadingItem[] {
  const headings: HeadingItem[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tag = (el.tagName ?? "").toLowerCase();
    const level = Number(tag.slice(1));
    if (!level) return;
    const text = $(el).text().trim().replace(/\s+/g, " ");
    headings.push({ level, text });
  });
  return headings;
}

/**
 * Regras de hierarquia de headings:
 * - deve haver exatamente um <h1> (nem zero, nem mais de um);
 * - a hierarquia não pode "pular" nível ao aprofundar (ex.: h2 → h4 sem h3
 *   antes) — subir de volta (h3 → h2) é normal e não é problema;
 * - nenhum heading deve ficar sem texto.
 */
function analyseHeadings(headings: HeadingItem[]): HeadingIssue[] {
  const issues: HeadingIssue[] = [];
  let seenH1 = false;
  let lastLevel = 0;

  headings.forEach((h, index) => {
    if (h.level === 1) {
      if (seenH1) {
        issues.push({ index, kind: "multiple-h1", message: "Mais de um <h1> na página — o ideal é ter só um por página." });
      }
      seenH1 = true;
    }
    if (lastLevel > 0 && h.level > lastLevel + 1) {
      issues.push({
        index,
        kind: "skipped-level",
        message: `Pulou de <h${lastLevel}> para <h${h.level}> sem passar por <h${lastLevel + 1}> — prejudica leitores de tela e a leitura da estrutura pelo Google.`,
      });
    }
    if (!h.text) {
      issues.push({ index, kind: "empty", message: `<h${h.level}> sem nenhum texto.` });
    }
    lastLevel = h.level;
  });

  if (!seenH1) {
    issues.unshift({ index: -1, kind: "missing-h1", message: "A página não tem nenhum <h1>." });
  }

  return issues;
}

function seoChecksFromHtml(html: string): {
  checks: CheckResult[];
  totals: PageSeo["totals"];
  headings: HeadingItem[];
  headingIssues: HeadingIssue[];
} {
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
  const headings = extractHeadings($);
  const headingIssues = analyseHeadings(headings);
  return { checks, totals, headings, headingIssues };
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
      const { html, scanError } = await fetchPage(pageUrl);
      if (!html) {
        pages[i] = {
          url: pageUrl,
          checks: [],
          totals: { pass: 0, warn: 0, fail: 0 },
          headings: [],
          headingIssues: [],
          scanError: scanError ?? { kind: "network-error", message: "Não foi possível carregar a página." },
          error: scanError?.message ?? "Não foi possível carregar a página.",
        };
        continue;
      }
      const { checks, totals, headings, headingIssues } = seoChecksFromHtml(html);
      pages[i] = { url: pageUrl, checks, totals, headings, headingIssues };
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  return { pages, source };
}
