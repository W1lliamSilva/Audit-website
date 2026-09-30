# Performance

Fonte: [`src/lib/performance.ts`](../../src/lib/performance.ts). Rota:
`POST /api/performance`, com `strategy: "desktop" | "mobile"` (padrão:
`desktop` se não informado ou inválido).

## Fonte dos dados

Usa a API pública do Google **PageSpeed Insights** (que roda o Lighthouse "ao
vivo"), categoria `performance` apenas.

- Funciona sem chave, mas com limite de requisições baixo.
- Se `PAGESPEED_API_KEY` estiver configurada no ambiente, é anexada à
  chamada para aumentar o limite.

## Métricas reportadas

| id | Rótulo |
|---|---|
| `first-contentful-paint` | First Contentful Paint |
| `largest-contentful-paint` | Largest Contentful Paint |
| `total-blocking-time` | Total Blocking Time |
| `cumulative-layout-shift` | Cumulative Layout Shift |
| `speed-index` | Speed Index |

Cada métrica recebe uma nota (0–1, vinda do Lighthouse) convertida em
`rating`:
- `score >= 0.9` → **good**
- `score >= 0.5` → **average**
- abaixo disso → **poor**

O `score` geral (0–100) é `lighthouseResult.categories.performance.score * 100`,
arredondado.

## Oportunidades de melhoria

Filtra os audits do Lighthouse onde `details.type === "opportunity"` **e**
`overallSavingsMs > 100`, ordena por economia estimada (decrescente) e
mantém as **top 8**.

## Retentativas e erros

- Até `ATTEMPTS = 2` tentativas, timeout de `PER_ATTEMPT_MS = 28000` ms cada.
  A ideia: a 1ª chamada roda o Lighthouse ao vivo (lento) e pode estourar o
  timeout; a 2ª geralmente pega cache do Google e responde rápido.
- **Exceção**: em `HTTP 429` (rate limit) **não** há retentativa — retorna
  erro direto, para não piorar o limite por minuto.
- Timeout (`AbortError`) tenta de novo, dentro do limite de tentativas.
- Se todas as tentativas falharem, retorna `score: null`, métricas e
  oportunidades vazias, e uma mensagem de erro amigável.

## Tempo real de carregamento (complementar, não substitui a nota acima)

Fonte: [`src/lib/realload.ts`](../../src/lib/realload.ts). Rota:
`POST /api/realload`, mesmo formato de `{ url, strategy }`.

**Por quê existe**: a nota do Lighthouse acima é *lab data* — testada contra
um perfil de dispositivo e rede padronizados, propositalmente mais lentos que
o comum, para representar um "pior caso" consistente entre execuções. Isso
significa que a nota **não é** "quanto tempo essa página demora a abrir
agora" — um site com nota 70 pode carregar em menos de 1s na prática, e o
inverso também acontece. Os dois números são mostrados lado a lado
(nunca combinados numa única métrica), para não sugerir que um substitui o
outro.

Como funciona:
1. Abre a página via Puppeteer, **sem nenhum throttling de rede ou CPU** —
   só a viewport muda entre `desktop` (1366×768) e `mobile` (390×844,
   `deviceScaleFactor: 3`, `isMobile`/`hasTouch: true`). A medição usa a
   conexão de internet real do servidor que roda a auditoria (não a do
   visitante final — ver limitação abaixo).
2. Espera o evento `load` do navegador (`waitUntil: "load"`), depois aguarda
   até 2s pelas entradas de Paint Timing aparecerem (`first-paint`/
   `first-contentful-paint`), sem travar a medição caso elas nunca surjam.
3. Lê os tempos via `PerformanceNavigationTiming` e `PerformancePaintTiming`
   do próprio navegador (não são estimados/simulados):
   - `ttfbMs` — tempo até o primeiro byte da resposta (`responseStart`);
   - `domContentLoadedMs` — DOM pronto e parseado;
   - `loadMs` — todos os recursos da página carregados (métrica principal
     exibida como "Tempo real agora" na Visão geral);
   - `firstPaintMs` / `firstContentfulPaintMs` — quando disponíveis.

**Limitação importante**: como a medição roda a partir do servidor da
auditoria (não do dispositivo/rede do visitante real), ela reflete a conexão
e localização geográfica do servidor, não a de quem acessa o site — é "tempo
real" no sentido de "sem simulação artificial", não "a experiência exata de
qualquer usuário, em qualquer lugar do mundo".

**Acessibilidade do relatório**: o botão que abre o modal de desempenho
("Ver relatório"/"Ver tempo real") fica disponível se **qualquer um dos
dois** — a nota do Lighthouse OU o tempo real — tiver dado disponível. Isso
importa porque a API do PageSpeed falha com frequência (rate limit externo),
e sem essa checagem o usuário ficaria sem acesso ao tempo real justamente
quando o Lighthouse falha.

## Simulação por tipo de conexão (sob demanda, dentro do modal)

Fonte: [`src/lib/simulate.ts`](../../src/lib/simulate.ts). Rota:
`POST /api/simulate`, mesmo formato de `{ url, strategy }`.

**Por quê existe**: outra forma de medir desempenho sem depender do
PageSpeed — mas, ao contrário do "Tempo real" acima (que mede a condição
atual, sem simulação nenhuma), aqui a ideia é o oposto: simular de propósito
várias condições de rede típicas, para ver como a página se comporta em
conexões mais lentas que a do servidor da auditoria.

Como funciona:
1. Usa os mesmos perfis de banda/latência do "Network throttling" do Chrome
   DevTools (`puppeteer-core`'s `PredefinedNetworkConditions`), aplicados via
   `page.emulateNetworkConditions(...)`:

   | Perfil | Download | Upload | Latência |
   |---|---|---|---|
   | Wi-Fi / banda larga | sem limite | sem limite | sem limite |
   | 4G | ~1 MB/s | ~165 KB/s | 165 ms |
   | 3G rápido | ~180 KB/s | ~84 KB/s | 562 ms |
   | 3G lento | ~50 KB/s | ~50 KB/s | 2000 ms |

   (o preset "Slow 4G" do Chrome tem exatamente os mesmos números de "Fast
   3G" — por isso só um dos dois aparece na lista, como "3G rápido", evitando
   mostrar duas linhas idênticas.)
2. Abre uma aba nova por perfil (sequencial, não em paralelo — evita
   sobrecarregar o site auditado com 4 cargas simultâneas, e evita cache/
   cookies vazando de um perfil pro outro), navega com `waitUntil: "load"` e
   timeout de 45s por perfil, e lê `domContentLoadedEventEnd`/`loadEventEnd`
   do `PerformanceNavigationTiming` — mesma técnica do "Tempo real", só que
   com a rede artificialmente limitada.
3. Falha em um perfil (timeout ou erro) não derruba os demais — cada perfil
   tem seu próprio `error` independente.

**Sob demanda, não automático**: diferente do Lighthouse e do "Tempo real"
(que rodam assim que a auditoria termina), a simulação só roda quando o
usuário clica em "Simular carregamento por conexão" dentro do modal — são 4
cargas completas da página em sequência (a "3G lento" sozinha pode levar
vários segundos), então dispará-la em toda auditoria multiplicaria o custo
de Puppeteer por 4 sem necessidade, a maioria das vezes sem o usuário nem
abrir o modal.

`maxDuration = 200` na rota (bem mais que as outras, que usam 60–300s)
porque são 4 medições sequenciais, uma delas propositalmente lenta.
