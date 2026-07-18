import type { TranslationCatalog } from './es';

/** Catálogo em português. Dados (nomes comerciais, ruas, bairros) nunca são traduzidos. */
export const pt: TranslationCatalog = {
  'common.back': 'Voltar',
  'common.retry': 'Tentar de novo',
  'common.backToApp': 'Voltar ao Locavo',
  'common.goHome': 'Ir para o início',
  'common.change': 'Alterar',
  'common.loading': 'Carregando',

  'tabs.home': 'Início',
  'tabs.explore': 'Explorar',
  'tabs.settings': 'Ajustes',

  'home.heroTitle': 'Do que você precisa agora?',
  'home.tagline': 'Não busque. Decida.',
  'home.searchPlaceholder': 'Buscar tacos, café, farmácia...',
  'home.useMyLocation': 'Usar minha localização atual',
  'home.gettingLocation': 'Obtendo localização…',
  'home.useMyLocationHint': 'Pede permissão de localização e lê sua posição uma única vez',
  'home.recommendedNearYou': 'Recomendado perto de você',
  'home.explorePlaces': 'Explorar lugares',
  'home.explorePlacesHint': 'Abre a lista completa de lugares',
  'home.demoNotice': 'Fase de demonstração: os lugares mostrados são dados simulados.',
  'home.locationLine': 'Culiacán · {label} · Alterar',
  'home.locationA11y': 'Localização: Culiacán, {label}. Alterar localização',
  'home.themeToggleA11y': 'Alterar tema. Atual: {mode}',

  'location.current': 'Sua localização atual',
  'location.failure.denied':
    'Permissão de localização negada. Continuamos usando {label} como referência; você pode mudar a área em Ajustes.',
  'location.failure.servicesOff':
    'A localização do aparelho está desativada. Ative-a no sistema ou continue usando {label}.',
  'location.failure.timeout':
    'Sua localização demorou demais para responder. Continuamos usando {label}; você pode tentar de novo.',
  'location.failure.error':
    'Sua localização não está disponível agora. Usamos {label} como referência.',

  'category.food': 'Comida',
  'category.beer': 'Cerveja',
  'category.coffee': 'Café',
  'category.lodging': 'Hospedagem',
  'category.pharmacy': 'Farmácias',
  'category.gas': 'Postos de gasolina',
  'category.store': 'Lojas',
  'category.nightlife': 'Vida noturna',
  'category.a11y': 'Categoria {label}',
  'category.badgeA11y': 'Categoria: {label}',

  'explore.allPlaces': 'Todos os lugares',
  'explore.locationLine': 'Culiacán · {label}',
  'explore.openNow': 'Aberto agora',
  'explore.near': 'Perto',
  'explore.searchInCategory': 'Buscar em {category}…',
  'explore.nearbyPlaces': 'Lugares próximos',
  'explore.emptyTitle': 'Sem resultados',
  'explore.emptyFiltered':
    'Nada aberto com esses filtros agora. Remova "Aberto agora" ou mude de categoria.',
  'explore.emptyGeneric': 'Tente outra categoria ou mude sua busca.',
  'explore.removeFilter': 'Remover filtro',
  'explore.seeAll': 'Ver tudo',

  'status.open': 'Aberto',
  'status.openUntil': 'Aberto até {time}',
  'status.closed': 'Fechado',
  'status.unknown': 'Horário não confirmado',

  'confidence.high': 'Alta confiança',
  'confidence.medium': 'Informação recente',
  'confidence.low': 'Informação limitada',
  'confidence.a11y': 'Confiança da informação: {label}',

  'recommend.bestOption': 'MELHOR OPÇÃO AGORA',
  'recommend.bestOptionA11y': 'Melhor opção agora: {name}',
  'recommend.details': 'Detalhes',
  'recommend.detailsHint': 'Abre os detalhes do lugar',
  'reason.OPEN_NOW': 'está aberto',
  'reason.NEARBY': 'está perto',
  'reason.RECENTLY_VERIFIED': 'sua informação foi verificada recentemente',
  'reason.HIGH_CONFIDENCE': 'sua informação é de alta confiança',
  'reason.COMPLETE_INFORMATION': 'sua informação está completa',
  'reason.template': 'Recomendado porque {list}.',
  'reason.and': ' e ',
  'reason.separator': ', ',
  'reason.fallback': 'É a opção mais conveniente entre os resultados disponíveis.',

  'place.directions': 'Como chegar',
  'place.directionsHint': 'Abre o Google Maps com a rota até o lugar',
  'place.address': 'Endereço',
  'place.phone': 'Telefone',
  'place.website': 'Site',
  'place.websiteA11y': 'Abrir site de {name}',
  'place.priceLevel': 'Faixa de preço',
  'place.price.1': 'Preço econômico',
  'place.price.2': 'Preço médio',
  'place.price.3': 'Preço alto',
  'place.price.4': 'Preço muito alto',
  'place.price.unknown': 'Preço não disponível',
  'place.source': 'Fonte',
  'place.sourceDemo': 'Dados de demonstração (demo-seed)',
  'place.lastVerification': 'Última verificação',
  'place.verifiedOn': 'Verificado em {date}',
  'place.verifiedUnknown': 'Data de verificação não disponível',
  'place.cardA11y': '{name}, {category}',
  'place.cardHint': 'Abre os detalhes do lugar',
  'place.loading': 'Carregando lugar…',
  'place.notFoundTitle': 'Lugar não encontrado',
  'place.notFoundBody': 'Este lugar não está mais disponível nos dados de demonstração.',
  'place.navNote':
    'O Locavo registra sua intenção de navegar; não confirma visitas nem compras. A rota abre no Google Maps.',

  'navError.title': 'Não conseguimos abrir o Google Maps para {name}.',
  'navError.body':
    'Verifique se há um navegador ou o app do Google Maps disponível e tente novamente.',
  'navError.closeA11y': 'Fechar aviso',

  'map.a11y': 'Mapa de resultados',
  'map.loading': 'Carregando mapa…',
  'map.failedTitle': 'Não conseguimos carregar o mapa.',
  'map.failedBody': 'Você pode continuar usando a lista de lugares.',
  'map.retry': 'Tentar mapa de novo',
  'map.yourLocation': 'Sua localização',

  'state.loadingPlaces': 'Buscando lugares perto de você…',
  'state.errorTitle': 'Ocorreu um problema',
  'state.errorBody': 'Algo deu errado ao carregar os lugares.',
  'state.notFoundTitle': 'Tela não encontrada',
  'state.notFoundBody': 'A rota que você tentou abrir não existe.',

  'search.a11yLabel': 'Buscar lugares',
  'search.a11yHint': 'Digite o que você precisa, por exemplo tacos ou farmácia',
  'search.clear': 'Limpar busca',

  'settings.title': 'Ajustes',
  'settings.theme': 'Tema',
  'settings.theme.system': 'Seguir o sistema',
  'settings.theme.light': 'Modo claro',
  'settings.theme.dark': 'Modo escuro',
  'settings.theme.systemShort': 'sistema',
  'settings.theme.lightShort': 'claro',
  'settings.theme.darkShort': 'escuro',
  'settings.language': 'Idioma',
  'settings.manualLocation': 'Localização manual',
  'settings.manualLocationBody':
    'Se você não conceder a permissão de localização, o Locavo usa uma área de referência em Culiacán.',
  'settings.privacy': 'Privacidade',
  'settings.privacyBody':
    'Sua localização é lida apenas quando você pede e somente para ordenar resultados; não há rastreamento em segundo plano, não há histórico de trajetos e nada é enviado a servidores. Os eventos de uso ficam apenas neste aparelho.',
  'settings.demoData': 'Dados de demonstração',
  'settings.demoDataBody':
    'Esta é a fase de demonstração do Locavo: todos os lugares são dados simulados com o prefixo “Demo”. Não representam negócios reais verificados.',
  'settings.info': 'Informações',
  'settings.privacyLink': 'Privacidade',
  'settings.termsLink': 'Termos de uso',
  'settings.supportLink': 'Suporte',

  'privacy.title': 'Privacidade',
  'privacy.intro': 'É assim que o Locavo trata suas informações na fase atual de demonstração.',
  'privacy.location.title': 'Localização',
  'privacy.location.body':
    'O Locavo solicita sua localização apenas para mostrar lugares próximos e ordenar os resultados. A leitura é pontual: acontece só quando você pede.',
  'privacy.location.b1': 'Não há rastreamento contínuo da sua posição.',
  'privacy.location.b2': 'Não há localização em segundo plano.',
  'privacy.location.b3': 'Não é guardado histórico de trajetos.',
  'privacy.location.b4': 'Sua localização nunca é enviada a um servidor do Locavo.',
  'privacy.location.b5':
    'Se você negar a permissão, pode usar uma área manual de Culiacán e o app continua funcionando.',
  'privacy.account.title': 'Conta e dados pessoais',
  'privacy.account.body':
    'O Locavo não exige conta, cadastro nem dados pessoais nesta fase.',
  'privacy.analytics.title': 'Analítica',
  'privacy.analytics.body':
    'A analítica desta fase é demonstrativa e fica apenas no seu aparelho. Nenhum serviço externo é conectado e nenhuma coordenada é registrada nos eventos.',
  'privacy.data.title': 'Dados de lugares',
  'privacy.data.body':
    'Os lugares mostrados atualmente são dados simulados de demonstração, identificados com o prefixo “Demo”. Não representam negócios reais verificados.',
  'privacy.external.title': 'Serviços externos',
  'privacy.external.body1':
    'Quando você pede direções, o Google Maps abre externamente (app ou navegador) e aplica sua própria política de privacidade.',
  'privacy.external.body2':
    'O mapa interno usa tiles de provedores externos (OpenStreetMap); carregá-los pode exigir conexão com esses servidores.',
  'legal.note': 'Documento inicial de produto. Será revisado antes do lançamento comercial.',

  'terms.title': 'Termos de uso',
  'terms.intro': 'Condições da fase atual de demonstração do Locavo.',
  'terms.demo.title': 'Informação demonstrativa',
  'terms.demo.body1':
    'A informação mostrada nesta fase é demonstrativa: os lugares são dados simulados e não representam negócios reais verificados.',
  'terms.demo.body2':
    'Ainda não existe relação comercial entre o Locavo e os negócios exibidos no app.',
  'terms.approx.title': 'Aproximações',
  'terms.approx.body1':
    'Horários, distâncias e tempos de deslocamento são aproximados e podem não refletir a realidade. Não há informação de trânsito em tempo real.',
  'terms.approx.body2':
    'Antes de decisões importantes, confirme a informação diretamente com o lugar.',
  'terms.nav.title': 'Navegação',
  'terms.nav.body':
    'O Locavo não oferece navegação própria passo a passo. Ao pedir direções, abre-se o Google Maps, um serviço externo com seus próprios termos.',

  'support.title': 'Suporte',
  'support.intro': 'Respostas rápidas às dúvidas mais comuns desta fase de demonstração.',
  'support.enable.title': 'Como ativo minha localização?',
  'support.enable.b1':
    'No Início, toque em "Usar minha localização atual" e aceite a permissão quando o sistema pedir.',
  'support.enable.b2':
    'Se você negou antes, ative nos ajustes do sistema: procure Locavo em Apps → Permissões → Localização.',
  'support.manual.title': 'E se eu não quiser compartilhar minha localização?',
  'support.manual.body':
    'Você pode usar o Locavo sem permissão de localização: em Ajustes escolha uma área manual de Culiacán e os resultados serão ordenados a partir dela.',
  'support.map.title': 'O mapa não carrega',
  'support.map.b1': 'Verifique sua conexão com a internet: os tiles do mapa precisam dela.',
  'support.map.b2': 'Use o botão "Tentar mapa de novo" do aviso.',
  'support.map.b3': 'Mesmo se o mapa falhar, a lista, a busca e a recomendação continuam funcionando.',
  'support.maps.title': 'O Google Maps não abre',
  'support.maps.b1': 'Tente novamente pelo aviso na tela.',
  'support.maps.b2': 'O link funciona mesmo sem o app do Google Maps: abrirá no navegador.',
  'support.maps.b3': 'Verifique se há um navegador habilitado no seu aparelho.',
  'support.pwa.title': 'Como instalo o Locavo como aplicativo (PWA)?',
  'support.pwa.b1': 'Abra a versão web do Locavo no Chrome ou Edge.',
  'support.pwa.b2':
    'No Android: toque no menu ⋮ e escolha "Adicionar à tela inicial" ou "Instalar aplicativo".',
  'support.pwa.b3': 'No desktop: use o ícone de instalação na barra de endereço.',
  'support.pwa.b4': 'No iPhone (Safari): botão Compartilhar → "Adicionar à Tela de Início".',
  'support.note': 'O canal oficial de contato de suporte será publicado antes do lançamento.',

  'format.months': 'jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez',
  'format.date': '{day} {month} {year}',
  'format.distanceM': 'A {value} m',
  'format.distanceKm': 'A {value} km',
  'format.distanceMi': 'A {value} mi',
  'format.travelTime': 'Cerca de {min} min',
};
