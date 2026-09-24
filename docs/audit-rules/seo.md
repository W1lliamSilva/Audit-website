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
   - Se for um sitemap-index: no modo normal, segue só para o **primeiro**
     sitemap filho listado; no modo "site inteiro" (`fullSite`, ver abaixo),
     segue para **todos** os filhos, até `MAX_CHILD_SITEMAPS = 50` — sites
     grandes costumam dividir o sitemap em vários arquivos (ex.: um por 5000
     URLs), e ignorar os demais deixaria a maior parte do site de fora.
2. Se não achar nada no sitemap, cai para o fallback: extrai links internos
   (`<a href>` com mesmo host) a partir do HTML da home.
3. A URL auditada é sempre incluída e colocada primeiro; a lista final é
   limitada a `MAX_PAGES = 10` páginas no modo normal, ou
   `MAX_PAGES_FULL_SITE = 500` no modo "site inteiro" (teto de segurança
   contra sitemaps mal configurados, não um limite de produto — a imensa
   maioria dos sites reais tem bem menos que 500 páginas).
4. Cada página é buscada e checada em paralelo, com `CONCURRENCY = 5` e
   timeout de `FETCH_TIMEOUT = 12000` ms por requisição. Falha ao carregar
   uma página não interrompe as demais — ver "Erros de digitalização" abaixo.

## Modo "site inteiro" (toggle na UI)

Por padrão, a auditoria de SEO cobre só as 10 primeiras páginas descobertas
(rápido, seguro). Marcando "Auditar o site inteiro", a rota `/api/seo` passa
`fullSite: true` para `getSeoForPages`, que:

- segue todos os sitemaps filhos (ver acima) e sobe o teto de páginas para
  `MAX_PAGES_FULL_SITE`;
- ainda assim, roda dentro de um **orçamento de tempo interno**
  (`SEO_TIME_BUDGET_MS = 270_000`, 270s), com margem de segurança abaixo do
  `maxDuration = 300` da rota. Ao se aproximar do limite, o rastreamento para
  de auditar novas páginas e devolve o que já foi processado até ali, em vez
  de a função ser encerrada de repente e o usuário não ver nada.
- `SeoResult.truncated` fica `true` quando nem todas as páginas descobertas
  foram auditadas (por causa do teto de páginas OU do orçamento de tempo);
  `SeoResult.discoveredCount` guarda quantas URLs foram descobertas no total.
  A UI mostra um aviso com "X de Y páginas descobertas foram auditadas"
  quando isso acontece.

Importante: em planos de hospedagem sem suporte a execuções longas (ex.:
Vercel Hobby), a plataforma pode encerrar a função antes mesmo dos 300s
configurados — o orçamento de tempo interno reduz o risco, mas não elimina.

## Erros de digitalização (multi-page, aba "Erros de digitalização")

Quando `fetchPage` não consegue obter e ler o HTML de uma página, o motivo
exato fica registrado em `PageSeo.scanError` (`ScanErrorKind`) e a página
aparece agregada na aba "Erros de digitalização" — junto com todas as outras
páginas que falharam, independente de qual página esteja selecionada nas
abas/pills no topo:

| `kind` | Quando acontece |
|---|---|
| `http-error` | O servidor respondeu com status HTTP ≥ 400 (ou outro erro HTTP). Mostra o status exato (ex.: "Erro HTTP 404"). |
| `timeout` | A página não respondeu dentro de `FETCH_TIMEOUT` (12s). |
| `network-error` | Falha de conexão — DNS, TLS ou a conexão foi recusada. |
| `invalid-content-type` | O servidor respondeu OK, mas o `content-type` da resposta não contém `html` (ex.: um link interno que aponta para uma imagem ou um JSON). |

Uma página com `scanError` não tem `checks`/`headings` (ambos ficam vazios) —
as sub-abas "Checagens" e "Estrutura de headings" mostram uma mensagem
apontando para "Erros de digitalização" em vez de uma lista vazia enganosa.
O ponto (dot) da página nas pills do topo fica roxo para diferenciar "não deu
pra ler a página" de "leu, mas achou problemas" (vermelho/amarelo).

## Pontuação

`score = round(((pass + warn * 0.5) / total_checks) * 100)`, calculada sobre
**todas** as categorias (SEO + acessibilidade + imagens + links), não só SEO
— ver [`src/lib/audit.ts`](../../src/lib/audit.ts).
