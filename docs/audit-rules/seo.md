# SEO

Fonte: [`src/lib/audit.ts`](../../src/lib/audit.ts) (checagem da página única)
e [`src/lib/seo.ts`](../../src/lib/seo.ts) (mesmas regras, aplicadas a várias
páginas do site). A lógica de checagem é idêntica nos dois arquivos.

## Checagens (single-page, `auditUrl`)

| id | Regra | `pass` | `warn` | `fail` |
|---|---|---|---|---|
| `title` | `<title>` no `<head>` | 10–60 caracteres | <10 ou >60 caracteres | ausente |
| `description` | `<meta name="description">` | 50–160 caracteres | <50 ou >160 caracteres | ausente |
| `h1` | Quantidade de `<h1>` | exatamente 1 | mais de 1 | nenhum |
| `lang` | Atributo `lang` no `<html>` | presente | — | ausente |
| `viewport` | `<meta name="viewport">` | presente | ausente | — |
| `canonical` | `<link rel="canonical">` | presente | ausente | — |
| `og` | Open Graph (`og:title` **e** `og:image`) | ambos presentes | qualquer um ausente | — |

Notas:
- Os limites de tamanho (10–60 / 50–160 caracteres) são as faixas usuais
  recomendadas para não truncar em resultados de busca.
- `og` só passa se **ambos** `og:title` e `og:image` existirem — só um dos
  dois conta como `warn`.

## Estrutura de headings (multi-page, aba "Estrutura de headings")

Além das checagens da tabela acima (que só contam **quantos** `<h1>` existem),
`getSeoForPages` também extrai **todos** os `h1`–`h6` de cada página, na ordem
em que aparecem no documento (`extractHeadings`), e analisa a hierarquia
(`analyseHeadings`), gerando uma lista de problemas (`headingIssues`) exibida
como árvore na UI:

| `kind` | Regra |
|---|---|
| `missing-h1` | A página não tem nenhum `<h1>`. |
| `multiple-h1` | Mais de um `<h1>` — cada `<h1>` além do primeiro é sinalizado. |
| `skipped-level` | A hierarquia "pulou" um nível ao **aprofundar** (ex.: `<h2>` seguido direto de `<h4>`, sem `<h3>` no meio). Subir de volta (ex.: `<h3>` → `<h2>`) é normal e **não** é sinalizado — só o aprofundamento sem passar pelo nível intermediário conta como problema. |
| `empty` | Um heading (`h1`–`h6`) sem nenhum texto. |

Por quê: WCAG (2.4.6, 1.3.1) e as diretrizes de SEO do Google recomendam uma
única hierarquia lógica de headings, sem saltos, para leitores de tela
navegarem por seção e para os motores de busca entenderem a estrutura do
conteúdo. Isso é independente do check `h1` da tabela acima (que só cobre a
contagem de `<h1>` da página atual) — a árvore de headings dá visibilidade
sobre `h2`–`h6` também, e sobre a página inteira, não só o título.

## Descoberta de páginas (multi-page, `getSeoForPages`)

1. Tenta `/sitemap.xml`, depois `/sitemap_index.xml`.
   - Se for um sitemap-index, segue para o **primeiro** sitemap filho listado
     (`<sitemap><loc>`) e lê as URLs dele.
2. Se não achar nada no sitemap, cai para o fallback: extrai links internos
   (`<a href>` com mesmo host) a partir do HTML da home.
3. A URL auditada é sempre incluída e colocada primeiro; a lista final é
   limitada a `MAX_PAGES = 10` páginas.
4. Cada página é buscada e checada em paralelo, com `CONCURRENCY = 5` e
   timeout de `FETCH_TIMEOUT = 12000` ms por requisição. Falha ao carregar
   uma página não interrompe as demais — ela aparece com
   `error: "Não foi possível carregar a página."` e checks vazios.

## Pontuação

`score = round(((pass + warn * 0.5) / total_checks) * 100)`, calculada sobre
**todas** as categorias (SEO + acessibilidade + imagens + links), não só SEO
— ver [`src/lib/audit.ts`](../../src/lib/audit.ts).
