# CAIXA ALTA (texto em maiúsculas no conteúdo)

Fonte: [`src/lib/uppercase.ts`](../../src/lib/uppercase.ts), chamada por
[`src/lib/seo.ts`](../../src/lib/seo.ts) (`getSeoForPages`) para cada página
com HTML válido. Aparece como sub-aba "CAIXA ALTA" dentro de SEO, específica
da página selecionada (mesmo padrão de "Erros de digitação" — ver
[spelling.md](spelling.md)).

## Por que importa

Texto digitado em CAIXA ALTA diretamente no conteúdo (em vez de texto normal
estilizado via CSS `text-transform: uppercase`) tem dois problemas:

- **Acessibilidade**: leitores de tela às vezes soletram texto em caixa alta
  letra por letra, como se fosse uma sigla, em vez de ler a palavra/frase
  normalmente — piora a experiência de quem depende de leitor de tela.
- **Manutenção**: o estilo visual fica "grudado" no conteúdo. Pra mudar
  (ex.: voltar a caixa normal, ou aplicar uppercase só em telas grandes) é
  preciso editar o texto, não só o CSS.

A exceção pedida é justamente **siglas** (SEO, API, CEO, HTML…), que são
caixa alta por definição e não devem ser sinalizadas.

## Como diferencia sigla de texto mal estilizado

Reaproveita o **mesmo dicionário em inglês** (`nspell` + `dictionary-en`) já
usado em "Erros de digitação" (ver [spelling.md](spelling.md)) — a mesma
lógica de "o conteúdo é majoritariamente em inglês" se aplica aqui.

1. Remove `<script>`, `<style>`, `<noscript>`, `<code>`, `<pre>`,
   `<template>`, `<svg>` e varre os mesmos elementos de texto usados na
   checagem de digitação (`h1`–`h6`, `p`, `li`, `a`, `button`, `span`, `td`,
   `th`, `figcaption`, `blockquote`, `label`), só o texto **direto** de cada
   um.
2. Tokeniza em palavras (letras Unicode, cobrindo acentos) e identifica as
   que estão **inteiramente em maiúsculas**.
3. Agrupa palavras maiúsculas consecutivas (separadas só por espaço ou
   vírgula) num único "trecho" — assim "WELCOME TO OUR STORE" vira **um**
   achado, não quatro.
4. Decide se sinaliza cada trecho:
   - **Trecho de 1 palavra**: se tiver **5 letras ou menos**, é tratada como
     sigla e **nunca** é sinalizada, independente do dicionário (regra
     direta pedida: siglas são a exceção). Acima de 5 letras, só é
     sinalizada se a versão minúscula **existir no dicionário** (ex.:
     "WELCOME" → sinaliza; um nome de marca desconhecido não sinaliza, por
     segurança).
   - **Trecho de 2+ palavras**: sinalizado se pelo menos **metade** das
     palavras do trecho existirem no dicionário em minúsculo — captura
     frases comuns em caixa alta (ex.: "WELCOME TO OUR STORE") mesmo que
     algumas palavras individualmente sejam curtas.
5. Cada achado tem uma sugestão em **sentence case** simples (só a primeira
   letra maiúscula) — ex.: "WELCOME TO OUR STORE" → "Welcome to our store".
6. Deduplicado por `trecho + localização`, limitado a `MAX_ISSUES = 30` por
   página.

## Limitações conhecidas

- **Nomes próprios em caixa alta** (ex.: "NEW YORK", "USA TODAY") podem ser
  sinalizados como texto mal estilizado, mesmo sendo um nome próprio
  intencionalmente em destaque — a checagem não distingue "nome próprio em
  caixa alta" de "frase comum em caixa alta", só usa a heurística do
  dicionário. Revise antes de aplicar a sugestão.
- Só siglas de **até 5 letras** ficam isentas automaticamente quando sozinhas
  numa palavra; uma sigla real de 6+ letras (rara, mas existe) que também
  não seja palavra de dicionário passa sem ser sinalizada; se também for uma
  palavra comum do dicionário (raro para siglas), pode ser sinalizada por
  engano.
