// Checagem de digitação (typos) no texto visível da página, usando um
// dicionário em inglês — o conteúdo auditado é majoritariamente em inglês,
// então checar contra um dicionário em português geraria falso positivo em
// praticamente toda palavra.

import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import nspell from "nspell";
import dictionaryEn from "dictionary-en";

export interface SpellingIssue {
  /** Palavra sinalizada, como apareceu no texto. */
  word: string;
  /** Sugestões de correção (0 a 3), na ordem de confiança do dicionário. */
  suggestions: string[];
  /** Trecho da frase ao redor, para dar contexto. */
  context: string;
  /** Landmark/seção legível (ex.: "footer › p"). */
  location: string;
}

const LANDMARKS = ["header", "nav", "main", "footer", "aside", "form", "section", "article"];
// Elementos cujo conteúdo não é texto de leitura (código, scripts, estilos…)
// — remover antes de extrair texto, senão viram "palavras" e geram ruído.
const SKIP_SELECTOR = "script, style, noscript, code, pre, template, svg";
// Só checa elementos "folha" de texto — evita duplicar a mesma frase quando
// ela também aparece no texto agregado de um ancestral (ex.: <main> inteiro).
const TEXT_SELECTOR = "h1, h2, h3, h4, h5, h6, p, li, a, button, span, td, th, figcaption, blockquote, label";
const WORD_RE = /[A-Za-z']+/g;
const MAX_ISSUES = 40;
const CONTEXT_RADIUS = 30;

// Termos comuns de tecnologia/marketing/web que dicionários de inglês
// genéricos não conhecem, mas que não são erro de digitação — reduz o ruído
// mais óbvio sem tentar cobrir jargão de nicho.
const KNOWN_WORDS = [
  "saas", "ecommerce", "fintech", "webhook", "webhooks", "backend",
  "frontend", "onboarding", "checkout", "api", "apis", "crypto",
  "blockchain", "devops", "login", "logout", "signup", "opt", "chatbot",
  "chatbots", "marketplace", "marketplaces", "dashboard", "dashboards",
  "analytics", "metadata", "roadmap", "workflow", "workflows", "plugin",
  "plugins", "responsive", "wifi", "ux", "ui",
];

function locationOf($: cheerio.CheerioAPI, el: Element): string {
  const $land = $(el).closest(LANDMARKS.join(","));
  const tag = (el.tagName ?? "elemento").toLowerCase();
  const id = $(el).attr("id");
  const self = id ? `${tag}#${id}` : tag;
  if ($land.length === 0) return self;
  const landEl = $land[0] as Element;
  const lt = (landEl.tagName ?? "").toLowerCase();
  const lid = $land.attr("id");
  const landmark = lid ? `${lt}#${lid}` : lt;
  return landmark === self ? self : `${landmark} › ${self}`;
}

let checkerPromise: Promise<ReturnType<typeof nspell>> | null = null;
function getSpellChecker(): Promise<ReturnType<typeof nspell>> {
  if (!checkerPromise) {
    checkerPromise = Promise.resolve().then(() => {
      const spell = nspell({
        aff: Buffer.from(dictionaryEn.aff),
        dic: Buffer.from(dictionaryEn.dic),
      });
      KNOWN_WORDS.forEach((w) => spell.add(w));
      return spell;
    });
  }
  return checkerPromise;
}

/** Só verifica palavras inteiramente minúsculas — evita sinalizar nomes
 *  próprios, marcas e siglas (tipicamente capitalizados) como erro. */
function isCheckable(word: string): boolean {
  return word.length > 2 && /^[a-z']+$/.test(word);
}

export async function findSpellingIssues(html: string): Promise<SpellingIssue[]> {
  const spell = await getSpellChecker();
  const $ = cheerio.load(html);
  $(SKIP_SELECTOR).remove();

  const issues: SpellingIssue[] = [];
  const seen = new Set<string>();

  const elements = $(TEXT_SELECTOR).toArray();
  for (const el of elements) {
    if (issues.length >= MAX_ISSUES) break;
    const $el = $(el);
    // Só o texto direto do elemento — evita duplicar o texto de filhos que
    // também batem no seletor (ex.: <li><a>texto</a></li>).
    const text = $el.clone().children().remove().end().text().trim().replace(/\s+/g, " ");
    if (!text) continue;

    WORD_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = WORD_RE.exec(text))) {
      const word = match[0];
      if (!isCheckable(word) || spell.correct(word)) continue;

      const loc = locationOf($, el as Element);
      const key = `${word}|${loc}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const start = Math.max(0, match.index - CONTEXT_RADIUS);
      const end = Math.min(text.length, match.index + word.length + CONTEXT_RADIUS);
      const context = (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");

      issues.push({ word, suggestions: spell.suggest(word).slice(0, 3), context, location: loc });
      if (issues.length >= MAX_ISSUES) break;
    }
  }

  return issues;
}
