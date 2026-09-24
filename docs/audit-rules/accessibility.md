# Acessibilidade

Fonte: [`src/lib/audit.ts`](../../src/lib/audit.ts). Roda sobre o HTML estático
retornado pelo `fetch` (não renderiza JavaScript — para checagens que
dependem do DOM renderizado, ver [images.md](images.md) e [linkaudit.md](linkaudit.md)).

## Checagens

### `link-text` — Links com texto acessível
Todo `<a>` precisa de pelo menos **um** rótulo perceptível:
- texto visível, **ou**
- `aria-label`, **ou**
- `title`, **ou**
- uma `<img>` filha com `alt` não vazio.

`fail` se algum link não tiver nenhum desses (lista até 10 exemplos com
`href="..."` e localização). `pass` se todos tiverem.

### `btn-label` — Botões com rótulo
Todo `<button>` precisa de texto visível, `aria-label` ou `title`. `fail` se
algum não tiver; `pass` caso contrário.

### `input-label` — Campos de formulário com label
Verifica `input:not([type=hidden])`, `select` e `textarea`. Considerado
**sem label** se **todas** as condições abaixo forem verdadeiras:
- não existe `<label for="ID">` apontando para o campo, **e**
- o campo não está envolto por um `<label>` (`.closest('label')`), **e**
- não tem `aria-label` nem `aria-labelledby`.

`warn` (não `fail`) se houver algum campo sem label — é tratado como
recomendação, não bloqueio.

## O que NÃO é coberto aqui

- Contraste de cores, ordem de foco/tabulação, ARIA roles incorretos,
  navegação por teclado — não implementado.
- Tamanho mínimo de área de clique (touch target) — implementado só no
  LinkAudit avançado, ver [linkaudit.md](linkaudit.md) (`hit-area`, WCAG 2.2
  critério 2.5.8).
