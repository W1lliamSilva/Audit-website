// Detecta texto digitado em CAIXA ALTA no próprio conteúdo (em vez de texto
// normal estilizado via CSS `text-transform: uppercase`). Isso importa porque:
// - leitores de tela às vezes soletram palavras/frases em caixa alta letra a
//   letra (como se fossem siglas), em vez de ler a palavra normalmente;
// - texto em caixa alta "grudado" no HTML trava o estilo — pra mudar o visual
//   depois é preciso editar o conteúdo, não só o CSS;
// - siglas de verdade (SEO, API, CEO…) são a exceção: são caixa alta por
//   definição e não devem ser sinalizadas.
//
// Reaproveita o mesmo dicionário em inglês do checker de digitação
// (spelling.ts) para diferenciar as duas coisas: se a palavra em caixa alta
// também existe como palavra normal do dicionário (ex.: WELCOME → welcome),
// é sinal de que é texto comum estilizado errado, não uma sigla.

import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { getSpellChecker, locationOf, TEXT_SKIP_SELECTOR, TEXT_LEAF_SELECTOR } from "./spelling";

export interface UppercaseIssue {
  /** Trecho encontrado em CAIXA ALTA, como apareceu no texto (pode ser mais de uma palavra). */
  text: string;
  /** Sugestão simples em sentence case (só a primeira letra maiúscula). */
  suggestion: string;
  /** Trecho da frase ao redor, para dar contexto. */
  context: string;
  /** Landmark/seção legível (ex.: "footer › p"). */
  location: string;
}

// Uma "palavra" para fins desta checagem: letras Unicode (cobre acentos),
// podendo conter apóstrofo/hífen interno (ex.: DON'T, CO-FOUNDER).
const WORD_RE = /\p{L}[\p{L}'-]*/gu;
// Uma sigla real (SEO, API, CEO…) quase sempre tem até 5 letras — acima
// disso, sozinha, é muito mais provável ser uma palavra comum em caixa alta.
const MAX_ACRONYM_LENGTH = 5;
// Só junta palavras em caixa alta num mesmo "trecho" se entre elas houver
// apenas espaço ou vírgula — qualquer outra pontuação quebra a sequência.
const RUN_GAP_RE = /^[\s,]*$/;
const MAX_ISSUES = 30;
const CONTEXT_RADIUS = 30;

function isAllUppercase(word: string): boolean {
  return word.length > 1 && word === word.toUpperCase() && word !== word.toLowerCase();
}

function toSentenceCase(text: string): string {
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

interface RunMatch {
  word: string;
  start: number;
  end: number;
}

export async function findUppercaseIssues(html: string): Promise<UppercaseIssue[]> {
  const spell = await getSpellChecker();
  const $ = cheerio.load(html);
  $(TEXT_SKIP_SELECTOR).remove();

  const issues: UppercaseIssue[] = [];
  const seen = new Set<string>();

  function isRealWord(word: string): boolean {
    return spell.correct(word.toLowerCase());
  }

  /** Decide se um trecho (uma ou mais palavras em caixa alta seguidas) deve ser sinalizado. */
  function shouldFlag(run: RunMatch[]): boolean {
    if (run.length === 1) {
      const word = run[0].word;
      if (word.length <= MAX_ACRONYM_LENGTH) return false; // provável sigla
      return isRealWord(word);
    }
    const recognized = run.filter((r) => isRealWord(r.word)).length;
    return recognized / run.length >= 0.5;
  }

  const elements = $(TEXT_LEAF_SELECTOR).toArray();
  for (const el of elements) {
    if (issues.length >= MAX_ISSUES) break;
    const $el = $(el);
    const text = $el.clone().children().remove().end().text().trim().replace(/\s+/g, " ");
    if (!text) continue;

    WORD_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    let run: RunMatch[] = [];

    const flushRun = () => {
      if (run.length === 0) return;
      if (shouldFlag(run)) {
        const start = run[0].start;
        const end = run[run.length - 1].end;
        const runText = text.slice(start, end);
        const loc = locationOf($, el as Element);
        const key = `${runText}|${loc}`;
        if (!seen.has(key)) {
          seen.add(key);
          const ctxStart = Math.max(0, start - CONTEXT_RADIUS);
          const ctxEnd = Math.min(text.length, end + CONTEXT_RADIUS);
          const context = (ctxStart > 0 ? "…" : "") + text.slice(ctxStart, ctxEnd).trim() + (ctxEnd < text.length ? "…" : "");
          issues.push({ text: runText, suggestion: toSentenceCase(runText), context, location: loc });
        }
      }
      run = [];
    };

    let lastEnd = 0;
    while ((match = WORD_RE.exec(text))) {
      const word = match[0];
      const start = match.index;
      const end = start + word.length;

      if (isAllUppercase(word)) {
        if (run.length > 0 && !RUN_GAP_RE.test(text.slice(lastEnd, start))) {
          flushRun();
        }
        run.push({ word, start, end });
      } else {
        flushRun();
      }
      lastEnd = end;
      if (issues.length >= MAX_ISSUES) break;
    }
    flushRun();
  }

  return issues;
}
