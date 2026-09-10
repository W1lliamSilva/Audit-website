import * as cheerio from "cheerio";

export type CheckStatus = "pass" | "warn" | "fail";

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  message: string;
  /** Exemplos/detalhes (ex.: lista de imagens sem alt). */
  details?: string[];
}

export type CategoryId = "seo" | "accessibility" | "images" | "links";

export interface Category {
  id: CategoryId;
  label: string;
  checks: CheckResult[];
}

export interface AuditResult {
  url: string;
  finalUrl: string;
  fetchedAt: string;
  score: number;
  totals: { pass: number; warn: number; fail: number };
  categories: Category[];
  stats: {
    htmlBytes: number;
    images: number;
    links: number;
    internalLinks: number;
    externalLinks: number;
  };
}

const MAX_DETAILS = 10;
const MAX_LINKS_TO_CHECK = 25;
const LINK_CHECK_CONCURRENCY = 6;
const LINK_TIMEOUT_MS = 7000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; SiteAuditTool/1.0; +https://github.com/W1lliamSilva/Audit-website)";

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function truncateList(items: string[]): string[] {
  if (items.length <= MAX_DETAILS) return items;
  return [...items.slice(0, MAX_DETAILS), `… e mais ${items.length - MAX_DETAILS}`];
}

async function fetchWithTimeout(
  url: string,
  opts: RequestInit & { timeoutMs: number }
): Promise<Response> {
  const { timeoutMs, ...rest } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Checa uma lista de URLs (HEAD, com fallback GET) e retorna as quebradas. */
async function findBrokenLinks(
  urls: string[]
): Promise<{ url: string; reason: string }[]> {
  const broken: { url: string; reason: string }[] = [];
  const queue = [...urls];

  async function worker() {
    while (queue.length > 0) {
      const link = queue.shift();
      if (!link) break;
      try {
        let res = await fetchWithTimeout(link, {
          method: "HEAD",
          redirect: "follow",
          headers: { "user-agent": USER_AGENT },
          timeoutMs: LINK_TIMEOUT_MS,
        });
        // Alguns servidores não suportam HEAD; tenta GET.
        if (res.status === 405 || res.status === 501) {
          res = await fetchWithTimeout(link, {
            method: "GET",
            redirect: "follow",
            headers: { "user-agent": USER_AGENT },
            timeoutMs: LINK_TIMEOUT_MS,
          });
        }
        if (res.status >= 400) {
          broken.push({ url: link, reason: `HTTP ${res.status}` });
        }
      } catch (err) {
        const reason =
          err instanceof Error && err.name === "AbortError"
            ? "timeout"
            : "inacessível";
        broken.push({ url: link, reason });
      }
    }
  }

  await Promise.all(
    Array.from({ length: LINK_CHECK_CONCURRENCY }, () => worker())
  );
  return broken;
}

export async function auditUrl(rawUrl: string): Promise<AuditResult> {
  const url = normalizeUrl(rawUrl);

  const res = await fetchWithTimeout(url, {
    method: "GET",
    redirect: "follow",
    headers: { "user-agent": USER_AGENT, accept: "text/html" },
    timeoutMs: 15000,
  });

  if (!res.ok) {
    throw new Error(`A página respondeu com HTTP ${res.status}.`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) {
    throw new Error(
      `O conteúdo não é HTML (content-type: ${contentType || "desconhecido"}).`
    );
  }

  const html = await res.text();
  const finalUrl = res.url || url;
  const $ = cheerio.load(html);
  const base = new URL(finalUrl);

  // ---------- SEO ----------
  const seo: CheckResult[] = [];

  const title = $("head > title").first().text().trim();
  if (!title) {
    seo.push({ id: "title", label: "Título (<title>)", status: "fail", message: "A página não tem <title>." });
  } else if (title.length < 10 || title.length > 60) {
    seo.push({ id: "title", label: "Título (<title>)", status: "warn", message: `Título com ${title.length} caracteres (ideal: 10–60).`, details: [title] });
  } else {
    seo.push({ id: "title", label: "Título (<title>)", status: "pass", message: `OK (${title.length} caracteres).`, details: [title] });
  }

  const desc = $('meta[name="description"]').attr("content")?.trim() ?? "";
  if (!desc) {
    seo.push({ id: "description", label: "Meta description", status: "fail", message: "Sem meta description." });
  } else if (desc.length < 50 || desc.length > 160) {
    seo.push({ id: "description", label: "Meta description", status: "warn", message: `Description com ${desc.length} caracteres (ideal: 50–160).` });
  } else {
    seo.push({ id: "description", label: "Meta description", status: "pass", message: `OK (${desc.length} caracteres).` });
  }

  const h1s = $("h1");
  if (h1s.length === 0) {
    seo.push({ id: "h1", label: "Cabeçalho H1", status: "fail", message: "Nenhum <h1> encontrado." });
  } else if (h1s.length > 1) {
    seo.push({ id: "h1", label: "Cabeçalho H1", status: "warn", message: `Foram encontrados ${h1s.length} <h1> (o ideal é um único).` });
  } else {
    seo.push({ id: "h1", label: "Cabeçalho H1", status: "pass", message: "Um único <h1>, como recomendado." });
  }

  const lang = $("html").attr("lang")?.trim();
  seo.push(
    lang
      ? { id: "lang", label: "Idioma (lang)", status: "pass", message: `Definido como "${lang}".` }
      : { id: "lang", label: "Idioma (lang)", status: "fail", message: 'O <html> não tem atributo "lang".' }
  );

  const viewport = $('meta[name="viewport"]').attr("content")?.trim();
  seo.push(
    viewport
      ? { id: "viewport", label: "Meta viewport", status: "pass", message: "Configurado (responsivo)." }
      : { id: "viewport", label: "Meta viewport", status: "warn", message: "Sem meta viewport (pode não ser responsivo)." }
  );

  const canonical = $('link[rel="canonical"]').attr("href")?.trim();
  seo.push(
    canonical
      ? { id: "canonical", label: "URL canônica", status: "pass", message: "Definida." }
      : { id: "canonical", label: "URL canônica", status: "warn", message: "Sem link canonical." }
  );

  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const ogImage = $('meta[property="og:image"]').attr("content")?.trim();
  if (ogTitle && ogImage) {
    seo.push({ id: "og", label: "Open Graph", status: "pass", message: "og:title e og:image presentes." });
  } else {
    seo.push({ id: "og", label: "Open Graph", status: "warn", message: "Open Graph incompleto (compartilhamento em redes sociais)." });
  }

  // ---------- Imagens / alt text ----------
  const images: CheckResult[] = [];
  const imgEls = $("img").toArray();
  const missingAlt: string[] = [];
  for (const el of imgEls) {
    const $el = $(el);
    const alt = $el.attr("alt");
    const src = $el.attr("src") ?? $el.attr("data-src") ?? "(sem src)";
    if (alt === undefined || alt.trim() === "") {
      // alt="" é válido para imagens decorativas, mas sinalizamos ausência total.
      if (alt === undefined) missingAlt.push(src);
    }
  }
  if (imgEls.length === 0) {
    images.push({ id: "img-alt", label: "Alt text em imagens", status: "pass", message: "Nenhuma imagem <img> na página." });
  } else if (missingAlt.length === 0) {
    images.push({ id: "img-alt", label: "Alt text em imagens", status: "pass", message: `Todas as ${imgEls.length} imagens têm atributo alt.` });
  } else {
    images.push({
      id: "img-alt",
      label: "Alt text em imagens",
      status: "fail",
      message: `${missingAlt.length} de ${imgEls.length} imagens sem atributo alt.`,
      details: truncateList(missingAlt),
    });
  }

  // ---------- Acessibilidade ----------
  const accessibility: CheckResult[] = [];

  // Links sem texto discernível
  const emptyTextLinks: string[] = [];
  $("a").each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    const ariaLabel = $el.attr("aria-label")?.trim();
    const title = $el.attr("title")?.trim();
    const hasImgAlt = $el.find("img[alt]").filter((_, im) => ($(im).attr("alt") ?? "").trim() !== "").length > 0;
    if (!text && !ariaLabel && !title && !hasImgAlt) {
      emptyTextLinks.push($el.attr("href") ?? "(sem href)");
    }
  });
  accessibility.push(
    emptyTextLinks.length === 0
      ? { id: "link-text", label: "Links com texto", status: "pass", message: "Todos os links têm texto ou rótulo acessível." }
      : { id: "link-text", label: "Links com texto", status: "fail", message: `${emptyTextLinks.length} link(s) sem texto/rótulo acessível.`, details: truncateList(emptyTextLinks) }
  );

  // Botões sem rótulo
  const emptyButtons: number = $("button").toArray().filter((el) => {
    const $el = $(el);
    return !$el.text().trim() && !$el.attr("aria-label")?.trim() && !$el.attr("title")?.trim();
  }).length;
  accessibility.push(
    emptyButtons === 0
      ? { id: "btn-label", label: "Botões com rótulo", status: "pass", message: "Todos os botões têm rótulo acessível." }
      : { id: "btn-label", label: "Botões com rótulo", status: "fail", message: `${emptyButtons} botão(ões) sem texto/aria-label.` }
  );

  // Inputs sem label associado
  const inputsNoLabel: number = $("input:not([type=hidden]), select, textarea").toArray().filter((el) => {
    const $el = $(el);
    const id = $el.attr("id");
    const hasLabelFor = id ? $(`label[for="${id}"]`).length > 0 : false;
    const wrapped = $el.closest("label").length > 0;
    const aria = $el.attr("aria-label")?.trim() || $el.attr("aria-labelledby")?.trim();
    return !hasLabelFor && !wrapped && !aria;
  }).length;
  accessibility.push(
    inputsNoLabel === 0
      ? { id: "input-label", label: "Campos com label", status: "pass", message: "Todos os campos de formulário têm label." }
      : { id: "input-label", label: "Campos com label", status: "warn", message: `${inputsNoLabel} campo(s) sem label associado.` }
  );

  // ---------- Links / botões problemáticos ----------
  const linkChecks: CheckResult[] = [];
  const anchors = $("a").toArray();
  const badHrefs: string[] = [];
  const validLinks = new Set<string>();
  let internalLinks = 0;
  let externalLinks = 0;

  for (const el of anchors) {
    const href = $(el).attr("href");
    if (href === undefined || href.trim() === "" || href.trim() === "#") {
      badHrefs.push($(el).text().trim() || "(link sem texto)");
      continue;
    }
    const h = href.trim();
    if (/^(javascript:|#|mailto:|tel:|data:)/i.test(h)) {
      if (/^javascript:/i.test(h)) badHrefs.push(`${$(el).text().trim() || "link"} → ${h}`);
      continue;
    }
    try {
      const abs = new URL(h, base).toString();
      validLinks.add(abs);
      if (new URL(abs).host === base.host) internalLinks++;
      else externalLinks++;
    } catch {
      badHrefs.push(`${$(el).text().trim() || "link"} → ${h}`);
    }
  }

  linkChecks.push(
    badHrefs.length === 0
      ? { id: "href-valid", label: "Links com destino válido", status: "pass", message: "Nenhum link com href vazio, '#' ou inválido." }
      : { id: "href-valid", label: "Links com destino válido", status: "fail", message: `${badHrefs.length} link(s) sem destino válido (href vazio, '#' ou 'javascript:').`, details: truncateList(badHrefs) }
  );

  // Links quebrados (amostra)
  const linksToCheck = Array.from(validLinks).slice(0, MAX_LINKS_TO_CHECK);
  const broken = await findBrokenLinks(linksToCheck);
  if (validLinks.size === 0) {
    linkChecks.push({ id: "broken", label: "Links quebrados", status: "pass", message: "Nenhum link externo/interno para verificar." });
  } else if (broken.length === 0) {
    linkChecks.push({ id: "broken", label: "Links quebrados", status: "pass", message: `Verifiquei ${linksToCheck.length} link(s): nenhum quebrado.` });
  } else {
    linkChecks.push({
      id: "broken",
      label: "Links quebrados",
      status: "fail",
      message: `${broken.length} de ${linksToCheck.length} link(s) verificados estão quebrados.`,
      details: truncateList(broken.map((b) => `${b.url} (${b.reason})`)),
    });
  }

  // ---------- Montagem ----------
  const categories: Category[] = [
    { id: "seo", label: "SEO", checks: seo },
    { id: "accessibility", label: "Acessibilidade", checks: accessibility },
    { id: "images", label: "Imagens / Alt text", checks: images },
    { id: "links", label: "Links e botões", checks: linkChecks },
  ];

  const allChecks = categories.flatMap((c) => c.checks);
  const totals = {
    pass: allChecks.filter((c) => c.status === "pass").length,
    warn: allChecks.filter((c) => c.status === "warn").length,
    fail: allChecks.filter((c) => c.status === "fail").length,
  };
  // Nota: pass=1, warn=0.5, fail=0.
  const score = allChecks.length
    ? Math.round(((totals.pass + totals.warn * 0.5) / allChecks.length) * 100)
    : 0;

  return {
    url,
    finalUrl,
    fetchedAt: new Date().toISOString(),
    score,
    totals,
    categories,
    stats: {
      htmlBytes: Buffer.byteLength(html, "utf8"),
      images: imgEls.length,
      links: anchors.length,
      internalLinks,
      externalLinks,
    },
  };
}
