/* LinkAudit core (portado da extensão v1.0.3) — detecção de links/botões.
   Gerado a partir de linkaudit.js: CFG/dicionário/CHECKS + I18N + utils +
   extract/makeRecord/analyse/checks. extract roda no navegador (Puppeteer);
   analyse é puro (Node). Não editar à mão. */
/* eslint-disable */
// @ts-nocheck
(function () {
  var navigator = (typeof globalThis !== 'undefined' && globalThis.navigator) ? globalThis.navigator : { language: 'pt' };
  var CFG = {
    widths: [1440, 768, 390],
    hitError: 24,
    hitWarn: 44,
    maxPages: 25,
    ignoreControls: true,
    lang: (navigator.language || 'en').toLowerCase().indexOf('pt') === 0 ? 'pt' : 'en'
  };

  var DEFAULT_DICT = [
    'home, homepage, home page, index, main page, top',
    'about, about us, our story, who we are, why us, company, our company, the company, overview, mission, our mission, vision, our vision, purpose, values, our values, philosophy, our philosophy, principles, our principles, ethos, what we believe, manifesto, history, background',
    'contact, contact us, get in touch, reach us, reach out, talk to us, say hello, contact form, enquiries, inquiries, request info, request information, start a conversation, start the conversation, start a project, lets talk, let us talk, speak with us, speak to us, drop us a line, send a message, message us, write to us, how can we help',
    'blog, news, articles, insights, stories, press, press room, newsroom, updates, journal, magazine, latest, thinking',
    'careers, career, jobs, job openings, open roles, open positions, vacancies, work with us, join us, join our team, join the team, hiring, we are hiring, opportunities, culture, our culture, life at, working here',
    'pricing, plans, pricing plans, packages, rates, tiers, cost, costs, quote, get a quote, request a quote, estimate, fees',
    'services, service, solutions, what we do, how we help, offerings, capabilities, our capabilities, core capabilities, what we offer, expertise, our expertise, specialties, practice areas, disciplines',
    'products, product, shop, store, catalog, catalogue, collection, collections, browse, merch',
    'portfolio, our work, projects, our projects, case studies, case study, featured case study, selected case, cases, showcase, selected work, recent work, featured work',
    'team, our team, meet the team, meet our team, people, our people, leadership, leadership team, management, founders, staff, crew, advisors, board, partners team',
    'faq, faqs, frequently asked questions, help, help center, help centre, support, customer support, questions, knowledge base, docs, documentation',
    'privacy, privacy policy, privacy notice, data policy, data protection, gdpr',
    'terms, terms of service, terms and conditions, terms of use, legal, legal notice, disclaimer, imprint',
    'login, log in, sign in, signin, member login, client login, customer login, account, my account, portal, client portal, dashboard',
    'signup, sign up, register, registration, create account, create an account, get started, start now, free trial, start free trial, try it free',
    'demo, book a demo, request a demo, schedule a demo, get a demo, see it in action, watch demo',
    'booking, book, book now, book a call, schedule, schedule a call, appointment, book an appointment, reserve, reservation, consultation, free consultation, enquire now',
    'testimonials, reviews, client reviews, what clients say, client stories, success stories, in their words',
    'partners, partnerships, clients, our clients, customers, brands, who we work with, affiliations',
    'events, event, webinars, webinar, workshops, conference, calendar, upcoming events',
    'resources, downloads, download, guides, ebooks, whitepapers, white papers, reports, templates, toolkit, library, learning',
    'newsletter, subscribe, join newsletter, mailing list, sign up for updates, stay in touch',
    'locations, location, find us, where to find us, offices, our offices, stores, branches, directions, visit us, showroom, neighborhood, neighbourhood, the neighborhood, surroundings, area guide',
    'gallery, photos, photo gallery, images, media, videos, video, tour, virtual tour',
    'cart, basket, shopping cart, shopping bag, checkout, my bag',
    'search, search site, find a page',
    'donate, donation, donations, support us, give back, contribute, fundraising',
    'apply, apply now, application, applications, enroll, enrolment, enrollment, admissions, register interest',
    'investors, investor relations, shareholders, financials, annual report',
    'sustainability, esg, impact, our impact, social impact, csr, responsibility, environment, stewardship',
    'accessibility, accessibility statement, a11y',
    'cookies, cookie policy, cookie settings, cookie preferences',
    'sitemap, site map',
    'security, trust, trust center, compliance, certifications',
    'process, our process, how it works, how we work, methodology, approach, our approach, the process, ways of working',
    'industries, sectors, who we serve, markets we serve, verticals',
    'value creation, creating value, our value, value proposition, value add, value drivers, how we create value, the value',
    'competitive edge, our edge, the edge, differentiators, what sets us apart, why choose us, competitive advantage, advantages, why we win, our advantage',
    'strategy, our strategy, strategic focus, our focus, focus areas, strategic priorities, investment strategy, investment approach, investment thesis, investment criteria, mandate, investment mandate, our thesis',
    'track record, our track record, milestones, timeline, our journey, by the numbers, key figures, metrics, statistics, stats, performance, proven results, results, achievements, experience',
    'properties, our properties, featured properties, property highlights, listings, available properties, holdings, portfolio properties, availability, asset list, current offerings',
    'amenities, features, specifications, floor plans, floorplans, unit types, residences, spaces, the building, interiors',
    'market, markets, market opportunity, the opportunity, opportunity, market overview, market insight, why this market',
    'transactions, recent transactions, deal flow, deals, our deals, acquisitions, exits, closed deals',
    'funds, fund, our funds, investment vehicles, vehicles, strategies offered',
    'awards, recognition, accolades, honours, honors, press mentions, as seen in',
    'press kit, media kit, brand assets, brand guidelines',
    'governance, corporate governance, ethics, code of conduct',
    'technology, our technology, platform, the platform, tech stack, innovation, research',
    'roadmap, what is next, coming soon, upcoming, the future'
  ].join('\n');

  /* Rótulos que não prometem destino nenhum. Não são erro: são uso normal de
     CTA. Servem para isentar da comparação texto x endereço. */
  var GENERIC = [
    'click here', 'learn more', 'learn', 'read more', 'read on', 'continue reading',
    'see more', 'view more', 'show more', 'find out more', 'discover more',
    'more', 'more info', 'more information', 'details', 'view details', 'see details',
    'explore', 'explore more', 'discover', 'view', 'see', 'see all', 'view all',
    'browse all', 'here', 'this link', 'link', 'continue', 'go',
    'clique aqui', 'clique', 'saiba mais', 'leia mais', 'ver mais', 'veja mais',
    'confira', 'acesse', 'aqui', 'este link', 'esse link', 'continuar', 'detalhes'
  ];

  var PREVIEW = true;

  var CHECKS = ['no-link', 'mismatch', 'home-link', 'nested', 'external-target', 'device-label', 'hit-area', 'logo-link'];
  var I18N = {
    pt: {
      'app.title': 'LinkAudit',
      'app.sub': 'Auditoria de links',
      'ui.close': 'Fechar',
      'ui.found': 'páginas encontradas no sitemap.xml',
      'ui.foundNone': 'páginas vistas a partir desta — sem sitemap.xml, o site pode ter mais',
      'ui.limit': 'Limitar a quantas páginas (opcional)',
      'ui.limitAll': 'todas as {0}',
      'ui.estimate': 'Estimativa: {0}',
      'ui.remaining': 'Restam cerca de {0}',
      'ui.restore': 'Reabrir o LinkAudit',
      'ui.homepage': 'Homepage',
      'ui.auditing': 'Auditando',
      'ui.pagesToAudit': 'Páginas a auditar',
      'ui.selected': '{0} de {1} páginas',
      'ui.selectedShort': 'selecionadas',
      'ui.estimateShort': 'estimativa',
      'ui.selAll': 'Tudo',
      'ui.selNone': 'Nada',
      'ui.grpAll': 'Todas',
      'ui.grpIndex': 'Só a index',
      'ui.grpSample': 'Index + 1',
      'ui.rootGroup': 'Páginas soltas',
      'ui.options': 'Opções',
      'ui.dictSummary': '{0} grupos · {1} termos',
      'ui.dictTip': 'Grupos de sinônimos que apontam para o mesmo destino. O relatório usa isso para comparar o texto do botão com o endereço: se o texto cair num grupo e o endereço cair em outro, vira erro de link incoerente. Adicione aqui os termos dos seus clientes.',
      'ui.addTerm': 'novo termo',
      'ui.newGroup': 'Novo grupo',
      'ui.removeGroup': 'remover grupo',
      'ui.resetDict': 'Restaurar padrão',
      'ui.refresh': 'Atualizar',
      'ui.refreshing': 'Atualizando o relatório…',
      'ui.noneSelected': 'Selecione ao menos uma página',
      'ui.pagesUnit': 'páginas',
      'ui.show': 'Ver na página',
      'ui.ignoreControls': 'Ignorar controles de componente',
      'ui.controlsHint': 'Setas de carrossel, abas, indicadores, toggles, componentes de copiar (Clipboard) e gatilhos de banner de cookie não são links. Reconhecidos pela semântica ARIA, pelo nome da camada ou pelo conteúdo, ficam fora do relatório.',
      'ui.dismiss': 'Descartar',
      'ui.undismiss': 'Restaurar',
      'ui.dismissed': 'Descartados na revisão',
      'ui.clearDismissed': 'Limpar descartados',
      'ui.dismissedNote': '{0} descartados na revisão',
      'ui.dismissHint': 'Descartes ficam salvos neste navegador, por site, e continuam valendo nas próximas auditorias.',
      'ui.shared': 'Compartilhados — o mesmo elemento em várias páginas',
      'ui.onPages': 'em {0} páginas',
      'ui.occurrencesHere': '{0} ocorrências nesta página',
      'ui.occurrences': '{0} ocorrências agrupadas em {1} problemas únicos',
      'ui.backResults': 'Voltar aos resultados',
      'ui.pvLoading': 'Carregando a página…',
      'ui.pvHint': 'A página está ao vivo aqui dentro — pode rolar e clicar nela.',
      'ui.pvByText': 'Localizado pelo texto do link — o seletor não bateu, a página pode ter mudado.',
      'ui.pvHidden': 'O elemento existe, mas está escondido nesta largura. Troque a largura acima.',
      'ui.pvNotFound': 'Não encontrei este elemento na página agora. Ele pode ter mudado desde a auditoria, ou só aparecer depois de uma interação — menu aberto, aba, carrossel.',
      'ui.cancelKeeps': 'Cancelar mantém o relatório do que já rodou',
      'ui.pages': 'Máximo de páginas',
      'ui.widths': 'Larguras testadas',
      'ui.dict': 'Dicionário de intenção',
      'ui.dictHelp': 'Uma linha por grupo de sinônimos. Se o texto do botão cair num grupo e o endereço cair em outro, vira erro. Adicione os termos dos seus clientes.',
      'ui.run': 'Auditar site',
      'ui.rerun': 'Auditar de novo',
      'ui.cancel': 'Cancelar',
      'ui.export': 'Exportar HTML',
      'ui.discovering': 'Descobrindo páginas…',
      'ui.progress': 'Página {0} de {1}',
      'ui.viaSitemap': '{0} páginas encontradas no sitemap.xml',
      'ui.viaLinks': 'Sem sitemap.xml — {0} páginas descobertas pelos links desta página',
      'ui.errors': 'Erros',
      'ui.warnings': 'Avisos',
      'ui.pagesScanned': 'Páginas',
      'ui.elements': 'Elementos analisados',
      'ui.clean': 'Nenhum problema encontrado. O site passou nos sete checks.',
      'ui.noMatch': 'Nenhum resultado com os filtros atuais.',
      'ui.all': 'Todos',
      'ui.search': 'Buscar por texto, endereço ou seletor…',
      'ui.copy': 'Copiar seletor',
      'ui.copied': 'Copiado',
      'ui.open': 'Abrir página',
      'ui.noText': '(sem texto)',
      'ui.failed': 'Falhou ao carregar',
      'ui.at': 'em',
      'ui.severity': 'Severidade',
      'ui.type': 'Tipo de problema',
      'ui.error': 'Erro',
      'ui.warn': 'Aviso',
      'ui.done': 'Auditoria concluída em {0}s',
      'ui.setupTitle': 'Configuração',
      'ui.reportFor': 'Relatório de',
      'ui.generated': 'Gerado em',
      'ui.minimize': 'Minimizar',

      'c.no-link': 'Botão sem link',
      'c.mismatch': 'Link incoerente com o texto',
      'c.nested': 'Links aninhados',
      'c.external-target': 'Link externo sem nova aba',
      'c.device-label': 'Texto diferente por dispositivo',
      'c.hit-area': 'Área de clique',
      'c.logo-link': 'Logo sem link para a home',
      'c.home-link': 'Link caindo na home',

      'd.anchorNoHref': 'Link sem destino ({0}). O usuário clica e nada acontece.',
      'd.buttonNoHandler': 'Botão sem destino visível no HTML. Pode ter um listener em JavaScript — vale confirmar clicando.',
      'd.pointerNoLink': 'Elemento com cursor de mão mas sem link em volta. Parece clicável e provavelmente não é.',
      'd.mailtoMismatch': 'O texto mostra "{0}" mas o link envia para "{1}".',
      'd.telMismatch': 'O texto mostra "{0}" mas o link disca "{1}".',
      'd.intentMismatch': 'O texto sugere "{0}" mas o endereço aponta para "{1}".',
      'd.genericLabel': 'Texto genérico não diz para onde leva — ruim para leitor de tela e para SEO.',
      'd.noOverlap': 'Nenhuma palavra do texto aparece no endereço. Pode ser link trocado.',
      'd.nestedAA': 'Link dentro de outro link. HTML inválido, o clique é imprevisível.',
      'd.nestedBA': 'Botão dentro de um link. HTML inválido, o clique é imprevisível.',
      'd.nestedAB': 'Link dentro de um botão. HTML inválido, o clique é imprevisível.',
      'd.externalNoBlank': 'Aponta para {0} e abre na mesma aba, tirando o usuário do site.',
      'd.deviceLabelDiff': 'O mesmo link aparece como {0}.',
      'd.missingOnMobile': 'Visível no desktop e ausente no mobile, e não há menu hamburguer que explique o sumiço.',
      'd.hitError': 'Área de {0}×{1}px em {2}. Abaixo do mínimo obrigatório de 24×24px (WCAG 2.2, critério 2.5.8).',
      'd.hitWarn': 'Área de {0}×{1}px em {2}. Abaixo dos 44×44px recomendados para toque.',
      'd.homeLink': 'Aponta para a home, mas o texto diz "{0}". No Framer isso quase sempre é link não configurado, que cai na home por padrão.',
      'd.logoNoLink': 'Logo do {0} não tem link nenhum em volta. O usuário espera voltar para a home clicando nele.',
      'd.logoNotHome': 'Logo do {0} tem link, mas aponta para {1} em vez da home.',
      'r.header': 'header',
      'r.footer': 'footer',
      'r.main': 'corpo',
      'd.noHrefAttr': 'sem href'
    },
    en: {
      'app.title': 'LinkAudit',
      'app.sub': 'Link audit',
      'ui.close': 'Close',
      'ui.found': 'pages found in sitemap.xml',
      'ui.foundNone': 'pages seen from this one — no sitemap.xml, the site may have more',
      'ui.limit': 'Limit how many pages (optional)',
      'ui.limitAll': 'all {0}',
      'ui.estimate': 'Estimated: {0}',
      'ui.remaining': 'About {0} left',
      'ui.restore': 'Reopen LinkAudit',
      'ui.homepage': 'Homepage',
      'ui.auditing': 'Auditing',
      'ui.pagesToAudit': 'Pages to audit',
      'ui.selected': '{0} of {1} pages',
      'ui.selectedShort': 'selected',
      'ui.estimateShort': 'estimated',
      'ui.selAll': 'All',
      'ui.selNone': 'None',
      'ui.grpAll': 'All',
      'ui.grpIndex': 'Index only',
      'ui.grpSample': 'Index + 1',
      'ui.rootGroup': 'Standalone pages',
      'ui.options': 'Options',
      'ui.dictSummary': '{0} groups · {1} terms',
      'ui.dictTip': 'Groups of synonyms that point to the same destination. The report uses them to compare a button\'s text with its URL: if the text lands in one group and the URL in another, it is flagged as a mismatched link. Add your own client terms here.',
      'ui.addTerm': 'new term',
      'ui.newGroup': 'New group',
      'ui.removeGroup': 'remove group',
      'ui.resetDict': 'Reset to default',
      'ui.refresh': 'Refresh',
      'ui.refreshing': 'Refreshing the report…',
      'ui.noneSelected': 'Select at least one page',
      'ui.pagesUnit': 'pages',
      'ui.show': 'Show on page',
      'ui.ignoreControls': 'Ignore component controls',
      'ui.controlsHint': 'Carousel arrows, tabs, indicators, toggles, copy-to-clipboard components and cookie banner triggers are not links. Recognised by ARIA semantics, layer name or content, they stay out of the report.',
      'ui.dismiss': 'Dismiss',
      'ui.undismiss': 'Restore',
      'ui.dismissed': 'Dismissed in review',
      'ui.clearDismissed': 'Clear dismissed',
      'ui.dismissedNote': '{0} dismissed in review',
      'ui.dismissHint': 'Dismissals are saved in this browser, per site, and carry over to future audits.',
      'ui.shared': 'Shared — the same element across several pages',
      'ui.onPages': 'on {0} pages',
      'ui.occurrencesHere': '{0} occurrences on this page',
      'ui.occurrences': '{0} occurrences grouped into {1} unique issues',
      'ui.backResults': 'Back to results',
      'ui.pvLoading': 'Loading the page…',
      'ui.pvHint': 'The page is live in here — you can scroll and click it.',
      'ui.pvByText': 'Located by link text — the selector did not match, the page may have changed.',
      'ui.pvHidden': 'The element exists but is hidden at this width. Switch width above.',
      'ui.pvNotFound': 'Could not find this element on the page now. It may have changed since the audit, or it only appears after an interaction — open menu, tab, carousel.',
      'ui.cancelKeeps': 'Cancelling keeps the report for what already ran',
      'ui.pages': 'Max pages',
      'ui.widths': 'Widths tested',
      'ui.dict': 'Intent dictionary',
      'ui.dictHelp': 'One line per group of synonyms. If the button text lands in one group and the URL in another, it is flagged as an error. Add your own client terms.',
      'ui.run': 'Audit site',
      'ui.rerun': 'Audit again',
      'ui.cancel': 'Cancel',
      'ui.export': 'Export HTML',
      'ui.discovering': 'Discovering pages…',
      'ui.progress': 'Page {0} of {1}',
      'ui.viaSitemap': '{0} pages found in sitemap.xml',
      'ui.viaLinks': 'No sitemap.xml — {0} pages discovered from links on this page',
      'ui.errors': 'Errors',
      'ui.warnings': 'Warnings',
      'ui.pagesScanned': 'Pages',
      'ui.elements': 'Elements analysed',
      'ui.clean': 'No issues found. The site passed all seven checks.',
      'ui.noMatch': 'Nothing matches the current filters.',
      'ui.all': 'All',
      'ui.search': 'Search text, URL or selector…',
      'ui.copy': 'Copy selector',
      'ui.copied': 'Copied',
      'ui.open': 'Open page',
      'ui.noText': '(no text)',
      'ui.failed': 'Failed to load',
      'ui.at': 'at',
      'ui.severity': 'Severity',
      'ui.type': 'Issue type',
      'ui.error': 'Error',
      'ui.warn': 'Warning',
      'ui.done': 'Audit finished in {0}s',
      'ui.setupTitle': 'Setup',
      'ui.reportFor': 'Report for',
      'ui.generated': 'Generated',
      'ui.minimize': 'Minimise',

      'c.no-link': 'Button with no link',
      'c.mismatch': 'Link does not match its text',
      'c.nested': 'Nested links',
      'c.external-target': 'External link without new tab',
      'c.device-label': 'Text differs by device',
      'c.hit-area': 'Tap target size',
      'c.logo-link': 'Logo not linked to home',
      'c.home-link': 'Link falls back to home',

      'd.anchorNoHref': 'Link with no destination ({0}). Clicking does nothing.',
      'd.buttonNoHandler': 'Button with no destination in the HTML. It may have a JavaScript listener — worth clicking to confirm.',
      'd.pointerNoLink': 'Element shows a pointer cursor but has no link around it. Looks clickable, probably is not.',
      'd.mailtoMismatch': 'The text reads "{0}" but the link sends to "{1}".',
      'd.telMismatch': 'The text reads "{0}" but the link dials "{1}".',
      'd.intentMismatch': 'The text suggests "{0}" but the URL points to "{1}".',
      'd.genericLabel': 'Generic text gives no idea of the destination — bad for screen readers and SEO.',
      'd.noOverlap': 'No word from the text appears in the URL. May be the wrong link.',
      'd.nestedAA': 'Link inside another link. Invalid HTML, unpredictable click behaviour.',
      'd.nestedBA': 'Button inside a link. Invalid HTML, unpredictable click behaviour.',
      'd.nestedAB': 'Link inside a button. Invalid HTML, unpredictable click behaviour.',
      'd.externalNoBlank': 'Points to {0} and opens in the same tab, taking the user off the site.',
      'd.deviceLabelDiff': 'The same link reads as {0}.',
      'd.missingOnMobile': 'Visible on desktop and absent on mobile, with no hamburger menu to explain it.',
      'd.hitError': 'Area of {0}×{1}px at {2}. Below the required 24×24px minimum (WCAG 2.2, criterion 2.5.8).',
      'd.hitWarn': 'Area of {0}×{1}px at {2}. Below the recommended 44×44px for touch.',
      'd.homeLink': 'Points to the home page, but the text says "{0}". In Framer this is almost always an unset link, which falls back to home.',
      'd.logoNoLink': 'The {0} logo has no link around it. Users expect it to take them home.',
      'd.logoNotHome': 'The {0} logo is linked, but points to {1} instead of the home page.',
      'r.header': 'header',
      'r.footer': 'footer',
      'r.main': 'body',
      'd.noHrefAttr': 'no href attribute'
    }
  };
  function resolveArgs(args) {
    return (args || []).map(function (a) {
      return (typeof a === 'string' && a.charAt(0) === '@') ? t(a.slice(1)) : a;
    });
  }

  function t(key, args) {
    var table = I18N[CFG.lang] || I18N.en;
    var s = table[key];
    if (s == null) s = I18N.en[key];
    if (s == null) s = key;
    if (args && args.length) {
      for (var i = 0; i < args.length; i++) {
        s = s.split('{' + i + '}').join(String(args[i]));
      }
    }
    return s;
  }

  /* ========================================================================
     3. UTILITÁRIOS
     ==================================================================== */

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  function deaccent(s) {
    try { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
    catch (e) { return String(s); }
  }

  function lower(s) {
    return deaccent(norm(s)).toLowerCase().replace(/[\u2018\u2019\u02bc]/g, "'");
  }

  function slugify(s) {
    return lower(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function words(s) {
    return lower(s).split(/[^a-z0-9]+/).filter(function (w) { return w.length > 2; });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function shortUrl(u) {
    try {
      var x = new URL(u, location.href);
      var p = x.pathname === '/' ? '/' : x.pathname.replace(/\/$/, '');
      return (x.origin === location.origin ? '' : x.host) + p + (x.search || '');
    } catch (e) { return String(u); }
  }

  function cssPath(el) {
    if (!el || el.nodeType !== 1) return '';
    var parts = [], node = el, depth = 0;
    while (node && node.nodeType === 1 && depth < 6 && node.tagName !== 'BODY') {
      if (node.id) {
        parts.unshift('#' + cssEscape(node.id));
        break;
      }
      var part = node.tagName.toLowerCase();
      var fn = node.getAttribute && node.getAttribute('data-framer-name');
      if (fn) {
        part += '[data-framer-name="' + String(fn).replace(/"/g, '\\"') + '"]';
      } else {
        var parent = node.parentElement;
        if (parent) {
          var same = [];
          for (var i = 0; i < parent.children.length; i++) {
            if (parent.children[i].tagName === node.tagName) same.push(parent.children[i]);
          }
          if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
        }
      }
      parts.unshift(part);
      node = node.parentElement;
      depth++;
    }
    return parts.join(' > ');
  }

  function cssEscape(s) {
    if (window.CSS && CSS.escape) { try { return CSS.escape(s); } catch (e) {} }
    return String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  /* ========================================================================
     4. DICIONÁRIO DE INTENÇÃO
     ==================================================================== */

  var dictGroups = [];
  var homeGroupId = -1;

  function buildDict(text) {
    dictGroups = String(text || '').split('\n')
      .map(function (line) {
        return line.split(',').map(function (x) { return norm(x); }).filter(Boolean);
      })
      .filter(function (g) { return g.length > 0; })
      .map(function (terms, i) {
        return {
          id: i,
          name: terms[0],
          labels: terms.map(lower),
          slugs: terms.map(slugify).filter(Boolean)
        };
      });
    homeGroupId = -1;
    dictGroups.forEach(function (g) {
      if (homeGroupId < 0 && (g.slugs.indexOf('home') !== -1 || g.slugs.indexOf('homepage') !== -1)) {
        homeGroupId = g.id;
      }
    });
  }

  function groupOfLabel(label) {
    var l = lower(label);
    if (!l) return null;
    for (var i = 0; i < dictGroups.length; i++) {
      if (dictGroups[i].labels.indexOf(l) !== -1) return dictGroups[i];
    }
    if (l.length <= 32) {
      for (var j = 0; j < dictGroups.length; j++) {
        var g = dictGroups[j];
        for (var k = 0; k < g.labels.length; k++) {
          var term = g.labels[k];
          if (term.length < 4) continue;
          var re = new RegExp('(^|[^a-z0-9])' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)');
          if (re.test(l)) return g;
        }
      }
    }
    return null;
  }

  /* Link de menu para seção interna vem como "/#about". O fragmento é o destino
     real — mais específico que o caminho. Quando existe fragmento, ele decide
     sozinho: se não for reconhecido, devolvemos null em vez de cair no caminho,
     porque "/" ali significa só "a página que contém a seção", não a intenção. */
  function groupOfPath(pathname, hash) {
    if (hash) {
      var hs = slugify(hash);
      if (!hs) return null;
      for (var hi = 0; hi < dictGroups.length; hi++) {
        if (dictGroups[hi].slugs.indexOf(hs) !== -1) return dictGroups[hi];
      }
      return null;
    }
    if (pathname == null) return null;
    var segs = String(pathname).split('/').filter(Boolean).map(function (s) {
      var v = s;
      try { v = decodeURIComponent(s); } catch (e) {}
      v = v.replace(/\.(html?|php|aspx?)$/i, '');
      return slugify(v);
    });
    if (!segs.length) {
      for (var h = 0; h < dictGroups.length; h++) {
        if (dictGroups[h].slugs.indexOf('home') !== -1 || dictGroups[h].slugs.indexOf('inicio') !== -1) return dictGroups[h];
      }
      return null;
    }
    /* O ÚLTIMO segmento é a página; o primeiro é só a pasta que a contém.
       "/legal/privacy-policy" é privacidade, não "termos" por causa de /legal. */
    var probe = [segs[segs.length - 1], segs[0]];
    for (var pi = 0; pi < probe.length; pi++) {
      if (!probe[pi]) continue;
      for (var i = 0; i < dictGroups.length; i++) {
        if (dictGroups[i].slugs.indexOf(probe[pi]) !== -1) return dictGroups[i];
      }
    }
    return null;
  }

  /* Rótulos que legitimamente levam para a home. Ficam aqui, e não no
     dicionário, de propósito: 'start' dentro do dicionário fazia "Start a
     conversation" ser classificado como home por conter-palavra, e brigar com
     /contact. Aqui a comparação é exata, então não vaza para frase nenhuma. */
  var HOME_LABELS = ['home', 'homepage', 'home page', 'start', 'start here', 'top',
    'back', 'go back', 'back to top', 'back home', 'main', 'index',
    'inicio', 'pagina inicial', 'voltar', 'ir para o inicio'];

  function isHomePath(p) {
    if (p == null) return false;
    return p === '' || p === '/' || /^\/(index|home|default)(\.html?|\.php)?\/?$/i.test(p);
  }

  /* Nome da marca costuma ser o texto de um logo escrito, que legitimamente
     leva para a home. Tiramos do <title>, do og:site_name e do domínio. */
  function brandTerms(doc) {
    var out = [];
    var ttl = norm(doc.title);
    if (ttl) {
      var parts = ttl.split(/[|\u2013\u2014\u00b7\u00bb:]|\s-\s/).map(norm).filter(Boolean);
      var last = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      if (last && last.length <= 40) out.push(lower(last));
    }
    var og = doc.querySelector('meta[property="og:site_name"], meta[name="application-name"]');
    if (og) { var v = lower(og.getAttribute('content')); if (v) out.push(v); }
    var h = lower(String(location.hostname).replace(/^www\./, '').split('.')[0]);
    if (h) out.push(h);
    return out.filter(function (x) { return x && x.length >= 2; });
  }

  function isBrandLabel(label, brands) {
    var l = lower(label);
    if (!l || !brands) return false;
    for (var i = 0; i < brands.length; i++) {
      if (l === brands[i]) return true;
      if (l.length >= 3 && l.length <= 30 &&
          (l.indexOf(brands[i]) !== -1 || brands[i].indexOf(l) !== -1)) return true;
    }
    return false;
  }

  function isGeneric(label) {
    var l = lower(label).replace(/[^a-z0-9 ]/g, '').trim();
    if (!l) return false;
    return GENERIC.indexOf(l) !== -1;
  }

  /* ========================================================================
     5. EXTRAÇÃO — roda dentro do iframe
     ==================================================================== */

  function effectiveBox(el) {
    var r = el.getBoundingClientRect();
    var x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
    var kids = el.querySelectorAll ? el.querySelectorAll('*') : [];
    var n = Math.min(kids.length, 60);
    for (var i = 0; i < n; i++) {
      var k = kids[i].getBoundingClientRect();
      if (k.width <= 0 || k.height <= 0) continue;
      if (k.left < x1) x1 = k.left;
      if (k.top < y1) y1 = k.top;
      if (k.right > x2) x2 = k.right;
      if (k.bottom > y2) y2 = k.bottom;
    }
    return { left: x1, top: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
  }

  function isVisible(win, el, box) {
    var cs;
    try { cs = win.getComputedStyle(el); } catch (e) { return false; }
    if (!cs) return false;
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
    if (!box) box = effectiveBox(el);
    // opacity é ignorada de propósito: animações de aparição do Framer usam opacity 0
    return box.w >= 1 && box.h >= 1;
  }

  /* Framer duplica o DOM por breakpoint e mantém cópias escondidas. Quando o
     elemento não está sendo renderizado, `innerText` degrada para `textContent`
     e devolve as cópias concatenadas: "Leadership Leadership". Colapsamos a
     repetição literal. */
  function dedupeLabel(v) {
    v = norm(v);
    if (v.length < 4) return v;
    var m = v.match(/^(.{2,}?)(?:[\s\u00a0]*\1)+$/);
    return m ? norm(m[1]) : v;
  }

  function labelOf(el) {
    var txt = dedupeLabel(el.innerText || el.textContent);
    if (txt) return { text: txt, iconOnly: false };
    var alt = '';
    var img = el.querySelector && el.querySelector('img[alt]');
    if (img) alt = norm(img.getAttribute('alt'));
    var acc = norm(el.getAttribute('aria-label')) || alt || norm(el.getAttribute('title'));
    return { text: '', accessible: acc, iconOnly: true };
  }

  function regionOf(el, doc, docH) {
    // footer primeiro: um <nav> dentro do <footer> é footer, não header
    if (el.closest('footer, [role="contentinfo"]')) return 'footer';
    if (el.closest('header, [role="banner"], nav')) return 'header';
    var fn = el.closest('[data-framer-name]');
    if (fn) {
      var name = String(fn.getAttribute('data-framer-name') || '').toLowerCase();
      if (/header|navbar|nav\b|menu/.test(name)) return 'header';
      if (/footer|rodape|rodapé/.test(name)) return 'footer';
    }
    // o fallback geométrico só vale quando a página não marca header/footer
    if (doc.__laLandmarks === undefined) {
      doc.__laLandmarks = !!doc.querySelector('header, [role="banner"], footer, [role="contentinfo"]');
    }
    if (doc.__laLandmarks) return 'main';
    var win = doc.defaultView;
    var top = el.getBoundingClientRect().top + (win ? win.scrollY || 0 : 0);
    if (top > 0 && top < 160) return 'header';
    if (docH && top > docH - 700) return 'footer';
    return 'main';
  }

  var CONTROL_ROLES = ['tab', 'switch', 'checkbox', 'radio', 'slider', 'option', 'combobox',
    'listbox', 'spinbutton', 'scrollbar', 'separator', 'presentation', 'none'];

  var CONTROL_RX = new RegExp('\\b(' + [
    'arrow', 'arrows', 'next', 'prev', 'previous', 'forward', 'chevron', 'caret',
    'dot', 'dots', 'bullet', 'indicator', 'indicators', 'pagination', 'pager',
    'slider', 'carousel', 'swiper', 'tab', 'tabs', 'toggle', 'switch', 'accordion',
    'close', 'dismiss', 'expand', 'collapse', 'hamburger', 'burger',
    'play', 'pause', 'mute', 'volume', 'thumbnail', 'thumb', 'control', 'controls',
    'stepper', 'scroll.?to.?top', 'back.?to.?top', 'filter.?button', 'sort.?button',
    'slide', 'slides', 'go.?to.?slide', 'previous.?slide', 'next.?slide', 'page.?\\d+',
    'clipboard', 'copy', 'copied', 'copy.?to.?clipboard', 'copy.?email', 'copy.?link',
    'copy.?address', 'share', 'tooltip'
  ].join('|') + ')\\b', 'i');

  var CONTAINER_RX = /slider|carousel|swiper|gallery|lightbox|accordion|pagination|marquee|ticker|\btabs?\b/i;

  /* Setas, abas e indicadores não são links — são controles do componente.
     Só marcamos com sinal forte: semântica ARIA, nome da própria camada, ou
     elemento sem texto dentro de um container de carrossel/abas. */
  function isUiControl(win, el) {
    var role = lower(el.getAttribute('role') || '');
    if (role && CONTROL_ROLES.indexOf(role) !== -1) return true;
    if (el.hasAttribute('aria-controls') || el.hasAttribute('aria-selected') ||
        el.hasAttribute('aria-expanded') || el.hasAttribute('aria-haspopup')) return true;
    if (el.closest('[role="tablist"], [role="radiogroup"]')) return true;

    var own = [el.getAttribute('data-framer-name'), el.getAttribute('aria-label'),
               el.getAttribute('title'), el.getAttribute('name')].join(' ');
    if (CONTROL_RX.test(own)) return true;

    // sem texto próprio e dentro de um carrossel/abas: é controle
    var txt = norm(el.textContent);
    if (txt.length <= 2) {
      var holder = el.closest('[data-framer-name]'), hops = 0;
      while (holder && hops < 3) {
        if (CONTAINER_RX.test(holder.getAttribute('data-framer-name') || '')) return true;
        holder = holder.parentElement ? holder.parentElement.closest('[data-framer-name]') : null;
        hops++;
      }
    }
    return false;
  }

  var COOKIE_RX = new RegExp('\\b(' + [
    'cookie', 'cookies', 'cookie.?trigger', 'cookie.?banner', 'cookie.?settings',
    'cookie.?preferences', 'cookie.?consent', 'manage.?cookies', 'consent',
    'gdpr', 'ccpa', 'lgpd', 'privacy.?settings', 'privacy.?preferences', 'cmp'
  ].join('|') + ')\\b', 'i');

  // link para a política é link de verdade; só o gatilho do banner é dispensado
  var POLICY_RX = /\b(policy|policies|notice|statement|politica|política)\b/i;

  var COOKIE_SEL = '#onetrust-consent-sdk,.ot-sdk-show-settings,.optanon-show-settings,' +
    '[class*="cookie" i],[id*="cookie" i],[class*="cky-" i],[class*="termly" i],' +
    '[class*="iubenda" i],[class*="cmplz" i],[id*="usercentrics" i],' +
    '[class*="cookiefirst" i],[class*="consent" i],[id*="consent" i]';

  /* Gatilho de cookie é o ícone flutuante que reabre o banner de consentimento.
     Não é um botão quebrado: ele nunca teve link e nunca deveria ter. */
  /* O selo "Made in Framer" do plano gratuito e o link de política dele não são
     conteúdo do cliente — não há o que consertar, e apareceriam em toda página. */
  function isFramerBadge(el) {
    try { if (el.closest('#__framer-badge-container, .__framer-badge')) return true; } catch (e) {}
    var h = el.getAttribute && el.getAttribute('href');
    if (h && /^https?:\/\/(www\.)?framer\.com(\/|$)/i.test(norm(h))
        && !/(^|\.)framer\.com$/i.test(location.hostname)) return true;
    return false;
  }

  function isCookieTrigger(el) {
    var own = [el.getAttribute('data-framer-name'), el.getAttribute('aria-label'),
               el.getAttribute('title'), el.getAttribute('id'), el.getAttribute('class'),
               norm(el.textContent).slice(0, 40)].join(' ');
    if (POLICY_RX.test(own)) return false;
    if (COOKIE_RX.test(own)) return true;
    var holder = el.closest('[data-framer-name]'), hops = 0;
    while (holder && hops < 3) {
      var nm = holder.getAttribute('data-framer-name') || '';
      if (POLICY_RX.test(nm)) return false;
      if (COOKIE_RX.test(nm)) return true;
      holder = holder.parentElement ? holder.parentElement.closest('[data-framer-name]') : null;
      hops++;
    }
    try { if (el.closest(COOKIE_SEL)) return true; } catch (e) {}
    return false;
  }

  /* Componente de copiar (o Clipboard do Framer) mostra um e-mail, telefone ou
     endereço e copia no clique. Não tem link nem deveria ter. O nome da camada
     pega a maioria, mas o conteúdo é o sinal que não depende de convenção de
     nomenclatura nenhuma. */
  function looksLikeCopyTarget(txt) {
    var v = norm(txt);
    if (!v || v.length > 80) return false;
    if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(v)) return true;
    if (/^(https?:\/\/|www\.)\S+$/i.test(v)) return true;
    var digits = v.replace(/\D/g, '');
    if (digits.length >= 8 && /^[\s()+\-.\u2013\u2014\d]+$/.test(v)) return true;
    return false;
  }

  function isInlineInText(win, el) {
    var cs;
    try { cs = win.getComputedStyle(el); } catch (e) { return false; }
    if (!cs || cs.display.indexOf('inline') !== 0) return false;
    var p = el.parentElement;
    if (!p) return false;
    var own = norm(el.textContent).length;
    var all = norm(p.textContent).length;
    return all > own + 15;
  }

  function makeRecord(win, doc, el, kind, width, docH) {
    var rawHref = el.getAttribute ? el.getAttribute('href') : null;
    var lab = labelOf(el);
    var box = effectiveBox(el);
    var resolved = null, path = null, origin = null, sameOrigin = null, scheme = null, hash = '';

    if (rawHref != null) {
      var h = norm(rawHref);
      if (/^(mailto|tel|sms):/i.test(h)) {
        scheme = h.split(':')[0].toLowerCase();
      } else if (h && h !== '#' && !/^javascript:/i.test(h)) {
        // '#secao' também resolve: uma âncora de rolagem É um destino
        try {
          var u = new URL(h, doc.baseURI);
          resolved = u.href;
          path = u.pathname;
          origin = u.origin;
          hash = u.hash ? u.hash.replace(/^#/, '') : '';
          sameOrigin = (u.origin === location.origin);
        } catch (e) {}
      }
    }

    var parent = el.parentElement;
    return {
      kind: kind,
      tag: el.tagName.toLowerCase(),
      rawHref: rawHref,
      resolved: resolved,
      path: path,
      hash: hash,
      origin: origin,
      sameOrigin: sameOrigin,
      scheme: scheme,
      label: lab.text,
      accessible: lab.accessible || lab.text || '',
      iconOnly: !!lab.iconOnly,
      w: Math.round(box.w),
      h: Math.round(box.h),
      visible: isVisible(win, el, box),
      inlineInText: kind === 'a' ? isInlineInText(win, el) : false,
      target: norm(el.getAttribute('target')),
      rel: norm(el.getAttribute('rel')),
      type: norm(el.getAttribute('type')),
      selector: cssPath(el),
      region: regionOf(el, doc, docH),
      hasAnchorAncestor: !!(parent && parent.closest('a')),
      hasButtonAncestor: !!(parent && parent.closest('button')),
      hasImage: !!(el.querySelector && el.querySelector('img, svg, picture, video')),
      isControl: isUiControl(win, el),
      isCookie: isCookieTrigger(el),
      isBadge: isFramerBadge(el),
      onclick: !!(el.getAttribute && el.getAttribute('onclick')),
      inForm: !!el.closest('form')
    };
  }

  function boxOverlap(a, b) {
    if (b.w < 1 || b.h < 1) return 0;
    var x = Math.max(0, Math.min(a.left + a.w, b.left + b.w) - Math.max(a.left, b.left));
    var y = Math.max(0, Math.min(a.top + a.h, b.top + b.h) - Math.max(a.top, b.top));
    return (x * y) / (b.w * b.h);
  }

  /* No Framer o link quase nunca fica na camada do logo: fica numa camada que
     envolve. `closest` já cobre isso. O que `closest` não cobre é o link numa
     camada IRMÃ sobreposta ao logo, que também acontece. Então: procura o
     ancestral, e na falta dele um <a> por perto que cubra a área do logo. */
  function linkAround(el) {
    var a = el.closest('a');
    if (a) return a;
    var box = effectiveBox(el);
    if (box.w < 1 || box.h < 1) return null;
    var node = el.parentElement, hops = 0;
    while (node && hops < 4) {
      var as = node.querySelectorAll('a[href]');
      for (var i = 0; i < as.length; i++) {
        if (as[i].contains(el)) return as[i];
        if (boxOverlap(effectiveBox(as[i]), box) >= 0.6) return as[i];
      }
      node = node.parentElement;
      hops++;
    }
    return null;
  }

  function logoInfo(win, doc, region, el) {
    var a = linkAround(el);
    var info = { region: region, selector: cssPath(el), hasAnchor: !!a, href: null, isHome: false };
    if (!a) return info;
    var h = norm(a.getAttribute('href'));
    if (!h || h.charAt(0) === '#' || /^javascript:/i.test(h)) { info.hasAnchor = false; return info; }
    try {
      var u = new URL(h, doc.baseURI);
      info.href = u.href;
      info.isHome = (u.origin === location.origin) && isHomePath(u.pathname);
    } catch (e) {}
    return info;
  }

  function findLogo(win, doc, region, brands) {
    var scope = null;
    if (region === 'header') {
      scope = doc.querySelector('header, [role="banner"]')
        || doc.querySelector('[data-framer-name*="header" i], [data-framer-name*="navbar" i], [data-framer-name*="nav" i]')
        || doc.querySelector('nav');
    } else {
      scope = doc.querySelector('footer, [role="contentinfo"]')
        || doc.querySelector('[data-framer-name*="footer" i], [data-framer-name*="rodape" i]');
    }
    if (!scope) return null;

    var cands = Array.prototype.slice.call(scope.querySelectorAll('img, svg'));
    if (!cands.length) return null;

    var rx = /logo|brand|marca|wordmark|símbolo|simbolo/i;
    var named = [], i, c;
    for (i = 0; i < cands.length; i++) {
      c = cands[i];
      var holder = c.closest('[data-framer-name]');
      var nm = holder ? String(holder.getAttribute('data-framer-name') || '') : '';
      var alt = c.getAttribute('alt') || '';
      var aria = c.getAttribute('aria-label') || '';
      var own = c.getAttribute('data-framer-name') || '';
      if (rx.test(alt) || rx.test(aria) || rx.test(own) || rx.test(nm)) { named.push(c); continue; }
      // o nome da marca no alt identifica um logo sem precisar inventar nada
      if (isBrandLabel(alt, brands) || isBrandLabel(aria, brands) || isBrandLabel(own, brands)) {
        named.push(c);
      }
    }

    /* Sem candidato NOMEADO, silêncio. A primeira imagem visível da região não
       é logo: num footer com ícones sociais isso inventava "logo sem link". */
    var pool = named;
    if (!pool.length) return null;

    /* Se QUALQUER candidato a logo da região já está linkado, esse é o link do
       logo — nada a reportar sobre ausência. Só acusamos falta de link quando
       nenhum deles tem. Isso evita falso positivo quando escolhemos o ícone
       errado como logo. */
    var infos = pool.map(function (x) { return logoInfo(win, doc, region, x); });
    for (i = 0; i < infos.length; i++) if (infos[i].hasAnchor && infos[i].isHome) return infos[i];
    for (i = 0; i < infos.length; i++) if (infos[i].hasAnchor) return infos[i];
    for (i = 0; i < infos.length; i++) if (isVisible(win, pool[i])) return infos[i];
    return infos[0];
  }

  function hasMenuToggle(doc) {
    if (doc.querySelector('[aria-expanded]')) return true;
    if (doc.querySelector('[aria-label*="menu" i], [aria-label*="navegação" i], [aria-label*="navigation" i]')) return true;
    var named = doc.querySelectorAll('[data-framer-name]');
    var limit = Math.min(named.length, 3000);
    for (var i = 0; i < limit; i++) {
      var n = String(named[i].getAttribute('data-framer-name') || '').toLowerCase();
      if (/hamburger|burger|menu.?toggle|toggle.?menu|mobile.?menu|menu.?mobile|menu.?icon/.test(n)) return true;
    }
    return false;
  }

  function extract(win, doc, width, includePointer) {
    var docH = doc.documentElement ? doc.documentElement.scrollHeight : 0;
    var records = [];
    var i, list;

    list = doc.querySelectorAll('a');
    for (i = 0; i < list.length; i++) records.push(makeRecord(win, doc, list[i], 'a', width, docH));

    list = doc.querySelectorAll('button');
    for (i = 0; i < list.length; i++) records.push(makeRecord(win, doc, list[i], 'button', width, docH));


    return {
      width: width,
      records: records,
      brands: brandTerms(doc),
      logo: {
        header: findLogo(win, doc, 'header', brandTerms(doc)),
        footer: findLogo(win, doc, 'footer', brandTerms(doc))
      },
      menuToggle: hasMenuToggle(doc)
    };
  }

  /* ========================================================================
     6. ANÁLISE
     ==================================================================== */

  function analyse(pageUrl, snaps) {
    var findings = [];
    var seen = {};

    function push(check, sev, rec, key, args) {
      var f = {
        check: check,
        sev: sev,
        page: pageUrl,
        label: rec.label || rec.accessible || '',
        iconOnly: !!rec.iconOnly && !rec.label,
        href: rec.rawHref == null ? null : norm(rec.rawHref),
        resolved: rec.resolved || null,
        selector: rec.selector,
        tag: rec.tag || rec.kind || "",
        kind: rec.kind || rec.tag || "",
        region: rec.region,
        widths: rec.widthsSeen || [],
        visible: !!rec.visible,
        key: key,
        args: args || []
      };
      var k = [check, sev, pageUrl, f.selector, f.href || '', key].join('||');
      if (seen[k]) return;
      seen[k] = 1;
      findings.push(f);
    }

    var base = snaps[0];
    if (!base) return findings;

    /* Um mesmo link externo costuma existir em mais de uma cópia no DOM — o
       Framer duplica por breakpoint, e o atributo `target` nem sempre está em
       todas elas. Se QUALQUER cópia do mesmo destino, na mesma região, abre em
       nova aba, o link está configurado: as outras cópias não são um problema
       separado. Sem isso, a cópia sem o atributo virava aviso falso. */
    var blankByHref = {};
    base.records.forEach(function (r0) {
      if (r0.kind !== 'a' || !r0.resolved || r0.sameOrigin !== false || r0.isBadge) return;
      var bk = r0.resolved + '||' + r0.region;
      if (r0.target === '_blank') blankByHref[bk] = true;
      else if (!(bk in blankByHref)) blankByHref[bk] = false;
    });

    /* ---- 1, 2, 3, 4 : estruturais, sobre o DOM completo ---- */
    for (var i = 0; i < base.records.length; i++) {
      var r = base.records[i];
      if (r.isBadge) continue;

      /* 1. botão sem link — controles de componente ficam de fora */
      if (CFG.ignoreControls && (r.isControl || r.isCookie || looksLikeCopyTarget(r.label))) {
        /* nada: seta, aba, indicador, botão de copiar ou gatilho de cookie
           não deveria ter link mesmo */
      } else if (r.kind === 'a') {
        var h = r.rawHref == null ? null : norm(r.rawHref);
        if (h === null || h === '' || h === '#' || /^javascript:\s*void/i.test(h)) {
          push('no-link', 'error', r, 'd.anchorNoHref', [h === null ? '@d.noHrefAttr' : (h || 'href=""')]);
        }
      } else if (r.kind === 'button') {
        if (!r.hasAnchorAncestor && !r.inForm && !r.onclick && r.type !== 'submit' && r.type !== 'reset') {
          push('no-link', 'warn', r, 'd.buttonNoHandler', []);
        }
      }

      /* 3. aninhados */
      if (r.kind === 'a' && r.hasAnchorAncestor) push('nested', 'error', r, 'd.nestedAA', []);
      if (r.kind === 'button' && r.hasAnchorAncestor) push('nested', 'error', r, 'd.nestedBA', []);
      if (r.kind === 'a' && r.hasButtonAncestor) push('nested', 'error', r, 'd.nestedAB', []);

      /* 4. externo sem nova aba */
      if (r.kind === 'a' && r.resolved && r.sameOrigin === false) {
        var ek = r.resolved + '||' + r.region;
        if (!blankByHref[ek]) {
          var host = '';
          try { host = new URL(r.resolved).host; } catch (e) { host = r.origin || ''; }
          push('external-target', 'warn', r, 'd.externalNoBlank', [host]);
        }
      }

      /* 2 e 2b. incoerência — o caso "vai para a home" tem mensagem própria e
         exclui a genérica, para o mesmo elemento não ser reportado duas vezes */
      if (r.kind === 'a') {
        if (checkHomeLink(r, base.brands)) {
          push('home-link', 'error', r, 'd.homeLink', [r.label]);
        } else {
          var mm = checkMismatch(r);
          if (mm) push('mismatch', mm.sev, r, mm.key, mm.args);
        }
      }
    }

    /* ---- 5. texto diferente por dispositivo ---- */
    var byHref = {};
    var visibleAt = {};
    for (var s = 0; s < snaps.length; s++) {
      var snap = snaps[s];
      for (var j = 0; j < snap.records.length; j++) {
        var rec = snap.records[j];
        if (rec.kind !== 'a' || !rec.resolved || !rec.visible || !rec.label || rec.isBadge) continue;
        if (!byHref[rec.resolved]) byHref[rec.resolved] = {};
        if (!byHref[rec.resolved][snap.width]) byHref[rec.resolved][snap.width] = {};
        byHref[rec.resolved][snap.width][rec.label] = (byHref[rec.resolved][snap.width][rec.label] || { rec: rec });
        if (!visibleAt[rec.resolved]) visibleAt[rec.resolved] = {};
        visibleAt[rec.resolved][snap.width] = true;
      }
    }

    Object.keys(byHref).forEach(function (href) {
      var perWidth = byHref[href];
      var widths = CFG.widths.filter(function (w) { return perWidth[w]; });
      if (widths.length < 2) return;

      var sets = widths.map(function (w) { return Object.keys(perWidth[w]); });
      // ambíguo quando o mesmo href tem vários textos na mesma largura (nav + footer)
      if (sets.some(function (arr) { return arr.length !== 1; })) return;

      var labels = sets.map(function (arr) { return arr[0]; });
      var uniq = labels.filter(function (v, ix) { return labels.indexOf(v) === ix; });
      if (uniq.length < 2) return;

      var desc = widths.map(function (w, ix) { return '"' + labels[ix] + '" @ ' + w + 'px'; }).join(', ');
      var sample = perWidth[widths[0]][labels[0]].rec;
      push('device-label', 'error', sample, 'd.deviceLabelDiff', [desc]);
    });

    /* A sub-regra "visível no desktop e ausente no mobile" foi removida: menu
       hamburguer feito à mão não tem marcação que dê para reconhecer, então ela
       acusava toda navegação mobile. Este check agora é só sobre TEXTO que muda
       entre larguras, que é o que dá para afirmar com certeza. */

    /* ---- 6. área de clique ---- */
    var hits = {};
    for (var s2 = 0; s2 < snaps.length; s2++) {
      var sn = snaps[s2];
      for (var j2 = 0; j2 < sn.records.length; j2++) {
        var rc = sn.records[j2];
        if (!rc.visible) continue;
        if (rc.kind === 'a' && rc.inlineInText) continue;      // isenção WCAG 2.5.8
        if (rc.hasAnchorAncestor || rc.hasButtonAncestor) continue;  // o ancestral é o alvo real
        if (CFG.ignoreControls &&
            (rc.isControl || rc.isCookie || rc.isBadge || looksLikeCopyTarget(rc.label))) continue;
        if (rc.w <= 0 || rc.h <= 0) continue;
        var key = rc.selector + '||' + rc.label;
        var min = Math.min(rc.w, rc.h);
        if (!hits[key] || min < hits[key].min) {
          hits[key] = { min: min, rec: rc, w: rc.w, h: rc.h, width: sn.width };
        }
      }
    }
    Object.keys(hits).forEach(function (k) {
      var e = hits[k];
      /* Sempre aviso. Duas condições, ambas sobre a forma do alvo e nenhuma
         dependente do comprimento do texto: uma dimensão abaixo do mínimo, ou
         um alvo pequeno nas DUAS dimensões. Assim um link de rodapé 53x30 fica
         quieto (é largo) e um ponto de carrossel 9x9 é apontado. */
      if (e.min < CFG.hitError) {
        push('hit-area', 'warn', e.rec, 'd.hitError', [e.w, e.h, e.width + 'px']);
      } else if (e.w < CFG.hitWarn && e.h < CFG.hitWarn) {
        push('hit-area', 'warn', e.rec, 'd.hitWarn', [e.w, e.h, e.width + 'px']);
      }
    });

    /* ---- 7. logo sem link para home ---- */
    var logoSeen = {};
    for (var s3 = 0; s3 < snaps.length; s3++) {
      ['header', 'footer'].forEach(function (region) {
        var lg = snaps[s3].logo[region];
        if (!lg) return;                                    // não achou logo: silêncio
        if (logoSeen[region]) return;      // um logo por região por página, ponto
        logoSeen[region] = 1;
        var fake = {
          label: '', accessible: region + ' logo', iconOnly: true,
          rawHref: lg.href, resolved: lg.href, selector: lg.selector, region: region
        };
        if (!lg.hasAnchor) {
          push('logo-link', 'error', fake, 'd.logoNoLink', ['@r.' + region]);
        } else if (lg.href && !lg.isHome) {
          push('logo-link', 'warn', fake, 'd.logoNotHome', ['@r.' + region, shortUrl(lg.href)]);
        }
      });
    }

    return findings;
  }

  /* Botão que aponta para a home sem ter texto de home e sem ser logo. No
     Framer é a assinatura de link não configurado: o padrão cai na home. */
  function checkHomeLink(r, brands) {
    if (!r.resolved || r.sameOrigin === false) return false;
    if (r.hash) return false;                // "/#about" vai para uma seção, não para a home
    if (!isHomePath(r.path)) return false;
    if (!r.label) return false;              // sem texto: é logo ou ícone, outro check cuida
    if (r.hasImage) return false;            // texto junto de imagem: provável logo escrito
    if (isBrandLabel(r.label, brands)) return false;
    if (HOME_LABELS.indexOf(lower(r.label)) !== -1) return false;
    var g = groupOfLabel(r.label);
    if (g && g.id === homeGroupId) return false;
    if (g === null && lower(r.label).length <= 2) return false;
    return true;
  }

  function checkMismatch(r) {
    var h = r.rawHref == null ? '' : norm(r.rawHref);
    if (!h) return null;

    if (r.scheme === 'mailto') {
      var val = h.replace(/^mailto:/i, '').split('?')[0].trim().toLowerCase();
      var m = (r.label || '').match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      if (m && val && m[0].toLowerCase() !== val) {
        return { sev: 'error', key: 'd.mailtoMismatch', args: [m[0], val] };
      }
      return null;
    }

    if (r.scheme === 'tel') {
      var digits = h.replace(/^tel:/i, '').replace(/\D/g, '');
      var shown = (r.label || '').replace(/\D/g, '');
      if (shown.length >= 8 && digits.length >= 8 && digits.slice(-8) !== shown.slice(-8)) {
        return { sev: 'error', key: 'd.telMismatch', args: [norm(r.label), h.replace(/^tel:/i, '')] };
      }
      return null;
    }

    if (!r.resolved || !r.label) return null;      // só ícone, ou destino não resolvível
    if (r.sameOrigin === false) return null;       // domínio externo: slug não é comparável

    var lg = groupOfLabel(r.label);
    var sg = groupOfPath(r.path, r.hash);

    if (lg && sg && lg.id !== sg.id) {
      return { sev: 'error', key: 'd.intentMismatch', args: [lg.name, sg.name] };
    }
    /* Rótulo genérico com destino que funciona é uso normal: "Learn more" leva
       para onde o contexto manda, inclusive /contact. Sai aqui, antes da regra
       de zero-interseção — senão ela acusaria a mesma coisa por outro caminho.
       Sem link nenhum continua sendo erro, mas isso é o check 1. */
    if (isGeneric(r.label)) return null;
    if (lg) return null;                            // texto reconhecido, endereço não classificado

    // ID de rolagem é identificador técnico ("#section-2", "#hero"), não slug
    // legível: comparar palavras contra ele não significa nada
    if (r.hash) return null;
    if (r.region !== 'header' && r.region !== 'footer') return null;
    if (norm(r.label).split(/\s+/).length > 4) return null;
    var lw = words(r.label);
    var target = r.hash ? r.hash : String(r.path || '').replace(/\.(html?|php|aspx?)$/i, '');
    var pw = words(String(target).replace(/[-_/]+/g, ' '));
    if (!lw.length || !pw.length) return null;
    var overlap = lw.some(function (a) {
      return pw.some(function (b) { return a === b || a.indexOf(b) === 0 || b.indexOf(a) === 0; });
    });
    if (!overlap) return { sev: 'warn', key: 'd.noOverlap', args: [] };
    return null;
  }

  /* ========================================================================
     7. CRAWL
     ==================================================================== */

  var __LA = { CFG: CFG, CHECKS: CHECKS, I18N: I18N, extract: extract, analyse: analyse, t: t, resolveArgs: resolveArgs, norm: norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = __LA;
  if (typeof window !== 'undefined') window.__LA = __LA;
  if (typeof globalThis !== 'undefined') globalThis.__LA = __LA;
})();
