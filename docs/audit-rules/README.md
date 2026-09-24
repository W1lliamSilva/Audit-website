# Regras de auditoria

Esta pasta documenta, em Markdown, os critérios que cada checagem do Audit Tool
aplica — o que é `pass`, `warn` e `fail`, e por quê. É a referência para manter
consistência ao adicionar/alterar checagens e para revisar se uma auditoria
está completa.

Cada arquivo corresponde a uma categoria/feature do produto:

| Arquivo | Categoria | Código-fonte |
|---|---|---|
| [seo.md](seo.md) | SEO (single-page e multi-page) | [`src/lib/audit.ts`](../../src/lib/audit.ts), [`src/lib/seo.ts`](../../src/lib/seo.ts) |
| [accessibility.md](accessibility.md) | Acessibilidade | [`src/lib/audit.ts`](../../src/lib/audit.ts) |
| [images.md](images.md) | Imagens / alt text | [`src/lib/audit.ts`](../../src/lib/audit.ts), [`src/lib/images.ts`](../../src/lib/images.ts) |
| [links-buttons.md](links-buttons.md) | Links e botões (auditoria básica) | [`src/lib/audit.ts`](../../src/lib/audit.ts) |
| [linkaudit.md](linkaudit.md) | LinkAudit avançado (multi-viewport) | [`src/lib/linkaudit.ts`](../../src/lib/linkaudit.ts), [`src/lib/linkaudit-core-b64.ts`](../../src/lib/linkaudit-core-b64.ts) |
| [performance.md](performance.md) | Performance (PageSpeed/Lighthouse) | [`src/lib/performance.ts`](../../src/lib/performance.ts) |
| [spelling.md](spelling.md) | Erros de digitação (typos, dicionário em inglês) | [`src/lib/spelling.ts`](../../src/lib/spelling.ts) |

## Convenções gerais

- **Status**: `pass` (ok), `warn` (atenção, não bloqueante), `fail` (problema
  claro). Em `audit.ts` a pontuação (`score`) pondera `pass = 1`,
  `warn = 0.5`, `fail = 0` sobre o total de checagens.
- **Normalização de URL**: se o usuário não informar `http://`/`https://`, o
  sistema assume `https://` (`normalizeUrl`, repetido em cada `lib/*.ts`).
- **User-Agent**: todas as requisições HTTP feitas pelo servidor se
  identificam como `SiteAuditTool/1.0` (não simulam navegador de usuário
  final).
- **Amostragem**: para evitar respostas gigantes, listas de detalhes são
  truncadas (ex.: 10 itens) com um resumo do que foi omitido.
- Ao adicionar uma nova checagem, documente aqui: **o que verifica**,
  **quando é pass/warn/fail**, **limites numéricos** e **por que** (fonte da
  recomendação — WCAG, boas práticas de SEO, etc.), para a regra não ficar
  só implícita no código.
