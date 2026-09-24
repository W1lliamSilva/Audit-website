# LinkAudit avançado (multi-viewport)

Fonte: [`src/lib/linkaudit.ts`](../../src/lib/linkaudit.ts) +
[`src/lib/linkaudit-core-b64.ts`](../../src/lib/linkaudit-core-b64.ts) (script
"core", portado de uma extensão de navegador, embutido em base64 e executado
tanto no browser headless quanto no Node via `new Function`). Rota:
`POST /api/linkaudit`.

Diferente de [links-buttons.md](links-buttons.md), aqui a página é renderizada
de verdade em Chromium headless (Puppeteer), em **3 larguras** —
`1440px` (desktop), `768px` (tablet), `390px` (mobile) — e os resultados das 3
capturas são comparados entre si (`core.analyse`).

## Tipos de achado (`check`)

| `check` | Severidade | O que detecta |
|---|---|---|
| `no-link` | error | Botão/link/elemento clicável sem destino: `<a>` sem `href`, `<button>` sem handler no HTML, ou elemento com cursor de "mão" (`cursor: pointer`) sem link ao redor. |
| `mismatch` | warn/error | O texto do link não bate com o destino: `mailto:`/`tel:` cujo texto mostra outro endereço/telefone; texto sugere uma intenção que não corresponde à URL; texto genérico ("clique aqui", "saiba mais") sem relação com o destino; nenhuma palavra do texto aparece na URL. |
| `nested` | error | HTML inválido por aninhamento: link dentro de link, botão dentro de link, ou link dentro de botão — clique fica imprevisível. |
| `external-target` | warn | Link para outro domínio que abre na mesma aba (sem `target="_blank"`), tirando o usuário do site. |
| `device-label` | warn | O mesmo destino (`resolved` URL) aparece com **texto diferente** dependendo da largura testada — inconsistência entre desktop/tablet/mobile. Também cobre "visível no desktop e ausente no mobile sem menu hambúrguer que explique". |
| `hit-area` | error (<24px) / warn (<44px) | Área de clique menor que o recomendado. |
| `logo-link` | error/warn | Logo do site sem link para a home, ou logo com link apontando para outro lugar que não a home. |
| `home-link` | warn | Link aponta para a home mas o texto sugere outro destino — comum em builders (ex.: Framer) quando o link não foi configurado e cai no padrão (home). |

## Regra de área de clique (`hit-area`)

Baseada em WCAG 2.2, critério 2.5.8 (Target Size, Minimum):
- **< 24×24px** → `error` — abaixo do mínimo obrigatório.
- **24×24px até 44×44px** → `warn` — funciona, mas abaixo dos 44×44px
  recomendados para toque confortável.
- **≥ 44×44px** → sem achado.

Exceções (não é sinalizado mesmo se pequeno):
- links inline dentro de texto corrido (isenção prevista na própria WCAG
  2.5.8);
- elementos cujo ancestral (`<a>` ou `<button>`) já é o alvo real de clique;
- controles nativos, banners de cookie e "badges" (indicadores visuais que
  parecem clicáveis mas não são o foco da checagem), quando o texto do
  elemento não sugere que é um link de conteúdo.

## Regra de link/logo da home

- Um logo (elemento com `alt`, `aria-label` ou `data-framer-name` sugerindo
  "logo") deve estar dentro de um link, e esse link deve apontar para a home
  do site. Se não tiver link nenhum → `logo-link` error. Se tiver link mas
  para outro destino → `logo-link` warn.
- O inverso também é checado: um link que aponta para a home mas cujo texto
  sugere outro destino (`home-link`) é um sinal de link "não configurado"
  (comum em builders visuais, que usam a home como fallback padrão).

## Execução

1. Para cada uma das 3 larguras, define o viewport, navega
   (`waitUntil: "networkidle2"`, timeout 25s — falha de navegação não aborta
   a auditoria, segue com o que carregou) e roda a função `extract()` do core
   dentro da página.
2. Os 3 snapshots (`snaps`) são passados para `core.analyse()`, que roda em
   Node e faz as comparações entre larguras.
3. Mensagens (`typeLabel`, `description`) vêm de um dicionário i18n embutido
   no core (`CFG.lang`, hoje fixado em `"pt"`).
