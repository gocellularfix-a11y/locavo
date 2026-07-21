/**
 * Catálogo base (español). Define el conjunto de claves de toda la
 * interfaz; los demás idiomas se tipan contra este objeto, por lo que una
 * clave faltante rompe la compilación.
 *
 * Regla de producto: los DATOS (nombres comerciales, calles, colonias,
 * ciudades) nunca se traducen; solo la interfaz.
 */
export const es = {
  // Comunes
  'common.back': 'Volver',
  'common.retry': 'Reintentar',
  'common.backToApp': 'Volver a Locavo',
  'common.goHome': 'Ir al inicio',
  'common.change': 'Cambiar',
  'common.loading': 'Cargando',

  // Navegación inferior
  'tabs.home': 'Inicio',
  'tabs.explore': 'Explorar',
  'tabs.settings': 'Ajustes',

  // Inicio
  'home.heroTitle': '¿Qué necesitas ahora?',
  'home.tagline': 'No busques. Decide.',
  'home.searchPlaceholder': '¿Qué estás buscando?',
  'home.searchExamples': 'Tacos, hoteles, cerveza...',
  'home.surprise': 'Sorpréndeme',
  'home.surpriseHint': 'Locavo elige por ti un buen lugar cercano según la hora',
  'home.surpriseEmpty':
    'No encontramos un lugar para sorprenderte ahora. Te llevamos a explorar.',
  'home.useMyLocation': 'Usar mi ubicación actual',
  'home.gettingLocation': 'Obteniendo ubicación…',
  'home.useMyLocationHint': 'Pide permiso de ubicación y usa tu posición actual una sola vez',
  'home.recommendedNearYou': 'Recomendado cerca de ti',
  'home.explorePlaces': 'Explorar lugares',
  'home.explorePlacesHint': 'Abre la lista completa de lugares',
  'home.demoNotice': 'Fase de demostración: los lugares mostrados son datos simulados.',
  'home.locationLine': 'Culiacán · {label} · Cambiar',
  'home.locationA11y': 'Ubicación: Culiacán, {label}. Cambiar ubicación',
  'home.themeToggleA11y': 'Cambiar tema. Actual: {mode}',

  // Sugerencias contextuales del hero (rotación por franja horaria)
  'suggest.morning.1': '☕ Buenos días. ¿Un café?',
  'suggest.morning.2': '🥐 Algo para desayunar',
  'suggest.morning.3': '💊 ¿Necesitas una farmacia?',
  'suggest.lunch.1': '🌮 ¿Hora de comer?',
  'suggest.lunch.2': '🍔 Tengo hambre',
  'suggest.lunch.3': '🍜 Algo bueno cerca',
  'suggest.afternoon.1': '☕ Necesito café',
  'suggest.afternoon.2': '🍰 Algo dulce',
  'suggest.afternoon.3': '🍺 Una cerveza fría',
  'suggest.evening.1': '🍺 ¿Dónde salir esta noche?',
  'suggest.evening.2': '🌮 Algo para cenar',
  'suggest.evening.3': '🏨 ¿Buscas dónde dormir?',
  'suggest.evening.4': '🌙 Lugares abiertos ahora',
  'suggest.lateNight.1': '🌙 Lugares abiertos ahora',
  'suggest.lateNight.2': '🍔 Tengo hambre',
  'suggest.lateNight.3': '🏨 Busco dónde dormir',
  'suggest.general.1': '🍔 Tengo hambre',
  'suggest.general.2': '🍺 Quiero una cerveza',
  'suggest.general.3': '☕ Necesito café',
  'suggest.general.4': '🏨 Busco dónde dormir',
  'suggest.general.5': '📍 Algo bueno cerca de mí',

  // Ubicación
  'location.current': 'Tu ubicación actual',
  'location.failure.denied':
    'Permiso de ubicación rechazado. Seguimos usando {label} como referencia; puedes cambiar la zona en Ajustes.',
  'location.failure.servicesOff':
    'La ubicación del dispositivo está desactivada. Actívala en el sistema o sigue usando {label}.',
  'location.failure.timeout':
    'Tu ubicación tardó demasiado en responder. Seguimos usando {label}; puedes intentarlo de nuevo.',
  'location.failure.error': 'Tu ubicación no está disponible ahora. Usamos {label} como referencia.',

  // Categorías (IDs internos nunca cambian; solo la presentación)
  'category.food': 'Comida',
  'category.beer': 'Cerveza',
  'category.coffee': 'Café',
  'category.lodging': 'Hospedaje',
  'category.pharmacy': 'Farmacias',
  'category.gas': 'Gasolineras',
  'category.store': 'Tiendas',
  'category.nightlife': 'Vida nocturna',
  'category.a11y': 'Categoría {label}',
  'category.badgeA11y': 'Categoría: {label}',

  // Explorar
  'explore.allPlaces': 'Todos los lugares',
  'explore.locationLine': 'Culiacán · {label}',
  'explore.openNow': 'Abierto ahora',
  'explore.near': 'Cerca',
  'explore.searchInCategory': 'Buscar en {category}…',
  'explore.nearbyPlaces': 'Lugares cercanos',
  'explore.emptyTitle': 'Sin resultados',
  'explore.emptyFiltered':
    'Nada abierto con esos filtros ahora mismo. Quita "Abierto ahora" o cambia de categoría.',
  'explore.emptyGeneric': 'Prueba con otra categoría o cambia tu búsqueda.',
  'explore.removeFilter': 'Quitar filtro',
  'explore.seeAll': 'Ver todo',
  'explore.loadMore': 'Cargar más lugares',
  'explore.loadMoreHint': 'Carga la siguiente página de resultados',

  // Estado de apertura
  'status.open': 'Abierto',
  'status.openUntil': 'Abierto hasta las {time}',
  'status.closed': 'Cerrado',
  'status.unknown': 'Horario no confirmado',

  // Confianza
  'confidence.high': 'Alta confianza',
  'confidence.medium': 'Información reciente',
  'confidence.low': 'Información limitada',
  'confidence.a11y': 'Confianza de la información: {label}',

  // Recomendación
  'recommend.bestOption': 'MEJOR OPCIÓN AHORA',
  'recommend.bestOptionA11y': 'Mejor opción ahora: {name}',
  'recommend.details': 'Detalles',
  'recommend.detailsHint': 'Abre los detalles del lugar',
  'reason.OPEN_NOW': 'está abierto',
  'reason.NEARBY': 'está cerca',
  'reason.RECENTLY_VERIFIED': 'su información fue verificada recientemente',
  'reason.HIGH_CONFIDENCE': 'su información es de alta confianza',
  'reason.COMPLETE_INFORMATION': 'su información está completa',
  'reason.template': 'Recomendado porque {list}.',
  'reason.and': ' y ',
  'reason.separator': ', ',
  'reason.fallback': 'Es la opción más conveniente entre los resultados disponibles.',
  'reason.EXACT_NAME_MATCH': 'coincide exactamente con tu búsqueda',
  'reason.NAME_MATCH': 'el nombre coincide con tu búsqueda',
  'reason.NAME_AND_ACTIVITY': 'el nombre y la actividad coinciden',
  'reason.CATEGORY_MATCH': 'coincide con la categoría buscada',
  'reason.TERM_MATCH': 'coincide con tu búsqueda',
  'search.hoursUnconfirmed': 'Los horarios no están confirmados; muestro coincidencias por relevancia.',

  // Detalle del lugar
  'place.directions': 'Cómo llegar',
  'place.directionsHint': 'Abre Google Maps con la ruta al lugar',
  'place.address': 'Dirección',
  'place.phone': 'Teléfono',
  'place.website': 'Sitio web',
  'place.websiteA11y': 'Abrir sitio web de {name}',
  'place.priceLevel': 'Nivel de precio',
  'place.price.1': 'Precio económico',
  'place.price.2': 'Precio medio',
  'place.price.3': 'Precio alto',
  'place.price.4': 'Precio muy alto',
  'place.price.unknown': 'Precio no disponible',
  'place.source': 'Fuente',
  'place.sourceDemo': 'Datos de demostración (demo-seed)',
  'place.sourceDenue': 'INEGI DENUE — Directorio oficial de unidades económicas',
  'place.datasetUpdated':
    'Directorio oficial actualizado el {date}. Negocio aún sin verificación individual.',
  'place.lastVerification': 'Última verificación',
  'place.verifiedOn': 'Verificado el {date}',
  'place.verifiedUnknown': 'Fecha de verificación no disponible',
  'place.cardA11y': '{name}, {category}',
  'place.cardHint': 'Abre los detalles del lugar',
  'place.loading': 'Cargando lugar…',
  'place.notFoundTitle': 'Lugar no encontrado',
  'place.notFoundBody': 'Este lugar ya no está disponible en los datos de demostración.',
  'place.navNote':
    'Locavo registra tu intención de navegar, no confirma visitas ni compras. La ruta se abre en Google Maps.',

  // Aviso de navegación externa
  'navError.title': 'No pudimos abrir Google Maps para {name}.',
  'navError.body':
    'Verifica que tengas un navegador o la app de Google Maps disponible e inténtalo de nuevo.',
  'navError.closeA11y': 'Cerrar aviso',

  // Mapa
  'map.a11y': 'Mapa de resultados',
  'map.loading': 'Cargando mapa…',
  'map.failedTitle': 'No pudimos cargar el mapa.',
  'map.failedBody': 'Puedes seguir usando la lista de lugares.',
  'map.retry': 'Reintentar mapa',
  'map.yourLocation': 'Tu ubicación',

  // Estados genéricos
  'state.loadingPlaces': 'Buscando lugares cerca de ti…',
  'state.errorTitle': 'Ocurrió un problema',
  'state.errorBody': 'Algo salió mal al cargar los lugares.',
  'state.notFoundTitle': 'Pantalla no encontrada',
  'state.notFoundBody': 'La ruta que intentaste abrir no existe.',

  // Búsqueda
  'search.a11yLabel': 'Buscar lugares',
  'search.a11yHint': 'Escribe qué necesitas, por ejemplo tacos o farmacia',
  'search.clear': 'Limpiar búsqueda',

  // Ajustes
  'settings.title': 'Ajustes',
  'settings.theme': 'Tema',
  'settings.theme.system': 'Según el sistema',
  'settings.theme.light': 'Modo claro',
  'settings.theme.dark': 'Modo oscuro',
  'settings.theme.systemShort': 'sistema',
  'settings.theme.lightShort': 'claro',
  'settings.theme.darkShort': 'oscuro',
  'settings.language': 'Idioma',
  'settings.manualLocation': 'Ubicación manual',
  'settings.manualLocationBody':
    'Si no otorgas permiso de ubicación, Locavo usa una zona de referencia en Culiacán.',
  'settings.privacy': 'Privacidad',
  'settings.privacyBody':
    'Tu ubicación se lee solo cuando lo pides y únicamente para ordenar resultados; no se rastrea en segundo plano, no se guarda historial de recorridos y nada se envía a servidores. Los eventos de uso se registran solo en este dispositivo.',
  'settings.demoData': 'Datos de demostración',
  'settings.demoDataBody':
    'Esta es la fase de demostración de Locavo: todos los lugares son datos simulados con el prefijo “Demo”. No representan negocios reales verificados.',
  'settings.info': 'Información',
  'settings.privacyLink': 'Privacidad',
  'settings.termsLink': 'Términos de uso',
  'settings.supportLink': 'Soporte',

  // Página de privacidad
  'privacy.title': 'Privacidad',
  'privacy.intro':
    'Así maneja Locavo tu información en la fase actual de demostración.',
  'privacy.location.title': 'Ubicación',
  'privacy.location.body':
    'Locavo solicita tu ubicación únicamente para mostrarte lugares cercanos y ordenar los resultados. La lectura es puntual: ocurre solo cuando tú la pides.',
  'privacy.location.b1': 'No hay seguimiento continuo de tu posición.',
  'privacy.location.b2': 'No se usa ubicación en segundo plano.',
  'privacy.location.b3': 'No se guarda historial de recorridos.',
  'privacy.location.b4': 'Tu ubicación no se envía a ningún servidor de Locavo.',
  'privacy.location.b5':
    'Si rechazas el permiso, puedes usar una zona manual de Culiacán y la app sigue funcionando.',
  'privacy.account.title': 'Cuenta y datos personales',
  'privacy.account.body':
    'Locavo no requiere cuenta, registro ni datos personales para usarse en esta fase.',
  'privacy.analytics.title': 'Analítica',
  'privacy.analytics.body':
    'La analítica de esta fase es demostrativa y permanece únicamente en tu dispositivo. No se conecta ningún servicio externo de analítica y no se registran coordenadas en los eventos.',
  'privacy.data.title': 'Datos de lugares',
  'privacy.data.body':
    'Los lugares mostrados actualmente son datos simulados de demostración, identificados con el prefijo “Demo”. No representan negocios reales verificados.',
  'privacy.external.title': 'Servicios externos',
  'privacy.external.body1':
    'Cuando pides indicaciones, Google Maps se abre externamente (app o navegador) y aplica su propia política de privacidad.',
  'privacy.external.body2':
    'El mapa interno usa teselas de proveedores externos (OpenStreetMap), por lo que cargarlas puede requerir conexión con esos servidores.',
  'legal.note': 'Documento inicial de producto. Será revisado antes de la publicación comercial.',

  // Términos
  'terms.title': 'Términos de uso',
  'terms.intro': 'Condiciones de la fase actual de demostración de Locavo.',
  'terms.demo.title': 'Información demostrativa',
  'terms.demo.body1':
    'La información mostrada en esta fase es demostrativa: los lugares son datos simulados y no representan negocios reales verificados.',
  'terms.demo.body2':
    'Todavía no existe una relación comercial entre Locavo y los negocios que aparecen en la aplicación.',
  'terms.approx.title': 'Aproximaciones',
  'terms.approx.body1':
    'Los horarios, distancias y tiempos de traslado son aproximados y pueden no reflejar la realidad. No se usa información de tráfico en tiempo real.',
  'terms.approx.body2':
    'Antes de tomar decisiones importantes, confirma la información directamente con el lugar.',
  'terms.nav.title': 'Navegación',
  'terms.nav.body':
    'Locavo no ofrece navegación propia paso a paso. Al pedir indicaciones se abre Google Maps, que es un servicio externo con sus propios términos y condiciones.',

  // Soporte
  'support.title': 'Soporte',
  'support.intro': 'Respuestas rápidas a las dudas más comunes de esta fase de demostración.',
  'support.enable.title': '¿Cómo activo mi ubicación?',
  'support.enable.b1':
    'En Inicio, toca el botón de ubicación junto a tu zona y acepta el permiso cuando el sistema lo pida.',
  'support.enable.b2':
    'Si antes lo rechazaste, actívalo desde los ajustes del sistema: busca Locavo en Aplicaciones → Permisos → Ubicación.',
  'support.manual.title': '¿Y si no quiero compartir mi ubicación?',
  'support.manual.body':
    'Puedes usar Locavo sin permiso de ubicación: en Ajustes elige una zona manual de Culiacán y los resultados se ordenarán desde ahí.',
  'support.map.title': 'El mapa no carga',
  'support.map.b1': 'Revisa tu conexión a internet: las teselas del mapa la necesitan.',
  'support.map.b2': 'Usa el botón "Reintentar mapa" del aviso.',
  'support.map.b3':
    'Aunque el mapa falle, la lista de lugares, la búsqueda y la recomendación siguen funcionando.',
  'support.maps.title': 'Google Maps no abre',
  'support.maps.b1': 'Vuelve a intentarlo desde el aviso que aparece en pantalla.',
  'support.maps.b2':
    'El enlace funciona aunque no tengas la app de Google Maps: se abrirá en el navegador.',
  'support.maps.b3': 'Verifica que tengas un navegador habilitado en tu dispositivo.',
  'support.pwa.title': '¿Cómo instalo Locavo como aplicación (PWA)?',
  'support.pwa.b1': 'Abre la versión web de Locavo en Chrome o Edge.',
  'support.pwa.b2':
    'En Android: toca el menú ⋮ y elige "Agregar a pantalla principal" o "Instalar aplicación".',
  'support.pwa.b3': 'En escritorio: usa el icono de instalación en la barra de direcciones.',
  'support.pwa.b4': 'En iPhone (Safari): botón Compartir → "Agregar a pantalla de inicio".',
  'support.note': 'El canal formal de contacto de soporte será publicado antes del lanzamiento.',

  // Formato local
  'format.months': 'ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic',
  'format.date': '{day} {month} {year}',
  'format.distanceM': 'A {value} m',
  'format.distanceKm': 'A {value} km',
  'format.distanceMi': 'A {value} mi',
  'format.travelTime': 'Aprox. {min} min',
} as const;

export type TranslationCatalog = Record<keyof typeof es, string>;
export type TranslationKey = keyof typeof es;
