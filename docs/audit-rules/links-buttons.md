# Links e botões (auditoria básica)

Fonte: [`src/lib/audit.ts`](../../src/lib/audit.ts). Roda sobre o HTML
estático (sem JavaScript). Para a versão avançada, multi-viewport, com mais
tipos de achado, ver [linkaudit.md](linkaudit.md).

## `href-valid` — Links com destino válido

Um `<a>` é considerado **sem destino válido** (`fail`, um item em
`linkIssues` do tipo `no-link`) quando:
- não tem atributo `href`, **ou**
- `href` é vazio ou só `"#"`, **ou**
- `href` começa com `javascript:` (case-insensitive).

Links com `href` começando em `mailto:`, `tel:` ou `data:` são ignorados
nas checagens seguintes (não entram na verificação de link quebrado).

Um `href` que não forma uma `URL` válida quando resolvido contra a URL base
(`new URL(href, base)`) também vira achado de tipo `no-link`, com a
descrição "não é uma URL válida".

`pass` só quando **nenhum** link cair em qualquer um dos casos acima.

## `broken` — Links quebrados

1. Todos os `href` válidos e absolutos (após resolver contra a base) formam
   um conjunto (deduplicado); os `mailto:`/`tel:`/`data:` já foram
   descartados antes.
2. Verifica apenas uma **amostra**: os primeiros `MAX_LINKS_TO_CHECK = 25`
   links únicos.
3. Para cada link: `HEAD` com `redirect: "follow"`; se responder `405` ou
   `501` (método não suportado), tenta `GET`. Timeout de
   `LINK_TIMEOUT_MS = 7000` ms por tentativa. Concorrência:
   `LINK_CHECK_CONCURRENCY = 6`.
4. Considerado quebrado se `status >= 400`, ou se a requisição falhar
   (`reason: "timeout"` em caso de abort, `"inacessível"` para outros erros).
5. `pass` se não houver links a checar, ou se nenhum da amostra estiver
   quebrado. `fail` se algum estiver.

⚠️ Isso é uma **amostra**, não uma checagem exaustiva — sites com mais de 25
links únicos não têm todos os links verificados.

## Botões sem ação detectável (`buttonIssues`)

Aplica-se a `<button>` e `[role="button"]` (exclui `<a>`, que já é coberto
por `href-valid`). Um elemento é sinalizado como **sem ação** quando **todas**
as condições abaixo são verdadeiras:
- não está `disabled` nem `aria-disabled="true"`;
- não tem atributo `onclick`;
- não é um botão de `submit`/`reset` dentro de um `<form>` (nem um botão sem
  `type` explícito dentro de um form, que por padrão submete);
- não tem `formaction`;
- não tem `href`.

Limite de até 40 achados por auditoria. Como o HTML estático não revela
listeners JavaScript adicionados via `addEventListener`, isso é sinalizado
como "pode ter ação em JS — confirme visualmente", não como erro definitivo.
