# Erros de digitação (typos)

Fonte: [`src/lib/spelling.ts`](../../src/lib/spelling.ts), chamada por
[`src/lib/seo.ts`](../../src/lib/seo.ts) (`getSeoForPages`) para cada página
com HTML válido. Aparece como sub-aba "Erros de digitação" dentro de SEO,
específica da página selecionada (diferente de "Erros de digitalização", que
é agregada entre todas as páginas — ver [seo.md](seo.md)).

## Por que dicionário em inglês

O conteúdo auditado (sites de clientes) é majoritariamente em inglês. Checar
contra um dicionário em português sinalizaria como erro praticamente toda
palavra da página — por isso a checagem usa sempre `dictionary-en` (via
`nspell`), independente do atributo `lang` da página.

## Como funciona

1. Remove `<script>`, `<style>`, `<noscript>`, `<code>`, `<pre>`, `<template>`
   e `<svg>` antes de extrair texto — não são conteúdo de leitura.
2. Varre apenas elementos de texto (`h1`–`h6`, `p`, `li`, `a`, `button`,
   `span`, `td`, `th`, `figcaption`, `blockquote`, `label`), pegando só o
   texto **direto** de cada um (não o de filhos, para não duplicar a mesma
   palavra quando um filho bate no mesmo seletor).
3. Tokeniza em palavras (`[A-Za-z']+`) e só verifica palavras com:
   - mais de 2 caracteres, **e**
   - inteiramente minúsculas (`^[a-z']+$`).

   **Por quê**: nomes próprios, marcas e siglas (ex.: "Stripe", "PayPal",
   "SEO") normalmente começam com maiúscula — pular essas reduz muito o
   falso positivo, ao custo de não pegar erros de digitação em palavras
   capitalizadas (incluindo a primeira palavra de uma frase). É uma troca
   deliberada: menos ruído, ao custo de alguns falsos negativos.
4. Uma lista curada de jargão comum de tecnologia/marketing (`saas`, `api`,
   `webhook`, `onboarding`, `ux`, `ui` etc. — ver `KNOWN_WORDS` em
   `spelling.ts`) é adicionada ao dicionário antes da checagem, para não
   sinalizar esses termos como erro.
5. Cada palavra não reconhecida vira um `SpellingIssue` com:
   - `suggestions`: até 3 sugestões de correção do próprio dicionário;
   - `context`: ~30 caracteres antes/depois da palavra, para dar contexto;
   - `location`: landmark/seção onde apareceu (ex.: `footer › p`).
6. Deduplicado por `palavra + location` (a mesma palavra repetida na mesma
   seção não gera vários achados) e limitado a `MAX_ISSUES = 40` por página.

## Limitações conhecidas

- **Não pega erros em palavras capitalizadas** (incluindo início de frase) —
  ver ponto 3 acima. Trade-off deliberado contra falso positivo em nomes
  próprios/marcas.
- **Não é 100% preciso para jargão de nicho**: termos técnicos ou de marca
  não cobertos pela lista curada podem aparecer como "erro" mesmo estando
  corretos — por isso a UI pede para revisar as sugestões antes de aplicar.
- Verifica ortografia, não gramática/uso — uma palavra real usada errada
  (ex.: "there" no lugar de "their") não é pega, porque a palavra em si
  existe no dicionário.
