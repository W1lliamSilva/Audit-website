# Imagens / alt text

Duas implementações com o mesmo objetivo (imagens sem alt text) e granularidades
diferentes:

## `img-alt` — versão rápida, HTML estático

Fonte: [`src/lib/audit.ts`](../../src/lib/audit.ts).

- Roda sobre o HTML cru retornado pelo `fetch` (não executa JavaScript — não
  enxerga imagens montadas dinamicamente por frameworks como Framer/React).
- Considera "sem alt" apenas quando o atributo `alt` está **totalmente
  ausente** (`alt === undefined`). Uma imagem com `alt=""` é aceita como
  válida (convenção para imagens puramente decorativas).
- `pass` se não houver `<img>` na página, ou se todas tiverem o atributo.
  `fail` se alguma não tiver, listando até 10 exemplos (`src` + localização).

## Auditoria dedicada — DOM renderizado

Fonte: [`src/lib/images.ts`](../../src/lib/images.ts), rota `POST /api/images`.

Usa Chromium headless (Puppeteer) porque sites que montam imagens via
JavaScript não aparecem na análise estática do HTML.

1. Navega até a URL (`waitUntil: "networkidle2"`, timeout 30s).
2. Rola a página em passos de 800px (até 20000px ou o fim do `scrollHeight`)
   para disparar `lazy-loading`, depois volta ao topo e aguarda 400ms.
3. Coleta todas as `<img>` do DOM renderizado: `src` (via `currentSrc` com
   fallback para `src`/`data-src`), `alt`, dimensões naturais, seletor CSS e
   localização (landmark mais próximo).
4. Filtra como **problema** as imagens onde:
   - `alt` está ausente **ou** é string vazia/só espaços, **e**
   - existe `src` **e** o `src` não é uma data URI (`data:...`).
5. Para cada imagem problemática, tenta obter o peso do arquivo
   (`Content-Length`) via `HEAD` (fallback para `GET` se `HEAD` falhar ou não
   retornar o header), com `CONCURRENCY = 6` e timeout de 6s por imagem —
   falha ao obter o tamanho não é erro fatal, o campo `bytes` fica `null`.

Diferença chave em relação a `img-alt`: aqui `alt=""` **conta como
problema** (é tratado como "sem alt"), diferente da checagem estática que
aceita `alt=""` como decorativa intencional. Ao comparar os dois resultados,
não espere que batam exatamente por esse motivo.
