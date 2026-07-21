import type { TranslationCatalog } from './es';

/** Catalogue français. Les données (noms commerciaux, rues, quartiers) ne sont jamais traduites. */
export const fr: TranslationCatalog = {
  'common.back': 'Retour',
  'common.retry': 'Réessayer',
  'common.backToApp': 'Retour à Locavo',
  'common.goHome': "Aller à l'accueil",
  'common.change': 'Changer',
  'common.loading': 'Chargement',

  'tabs.home': 'Accueil',
  'tabs.explore': 'Explorer',
  'tabs.settings': 'Réglages',

  'home.heroTitle': 'De quoi avez-vous besoin maintenant ?',
  'home.tagline': 'Ne cherchez pas. Décidez.',
  'home.searchPlaceholder': 'Que cherchez-vous ?',
  'home.searchExamples': 'Tacos, hôtels, bière...',
  'home.surprise': 'Surprends-moi',
  'home.surpriseHint': 'Locavo choisit pour vous un bon endroit à proximité selon l’heure',
  'home.surpriseEmpty':
    'Aucun lieu à vous proposer pour le moment. Nous vous emmenons explorer.',
  'home.useMyLocation': 'Utiliser ma position actuelle',
  'home.gettingLocation': 'Localisation en cours…',
  'home.useMyLocationHint': 'Demande la permission de localisation et lit votre position une seule fois',
  'home.recommendedNearYou': 'Recommandé près de vous',
  'home.explorePlaces': 'Explorer les lieux',
  'home.explorePlacesHint': 'Ouvre la liste complète des lieux',
  'home.demoNotice': 'Phase de démonstration : les lieux affichés sont des données simulées.',
  'home.locationLine': 'Culiacán · {label} · Changer',
  'home.locationA11y': 'Position : Culiacán, {label}. Changer de position',
  'home.themeToggleA11y': 'Changer de thème. Actuel : {mode}',

  'suggest.morning.1': '☕ Bonjour. Un café ?',
  'suggest.morning.2': '🥐 Quelque chose pour le petit-déjeuner',
  'suggest.morning.3': '💊 Besoin d’une pharmacie ?',
  'suggest.lunch.1': '🌮 L’heure de manger ?',
  'suggest.lunch.2': '🍔 J’ai faim',
  'suggest.lunch.3': '🍜 Quelque chose de bon à proximité',
  'suggest.afternoon.1': '☕ J’ai besoin d’un café',
  'suggest.afternoon.2': '🍰 Quelque chose de sucré',
  'suggest.afternoon.3': '🍺 Une bière fraîche',
  'suggest.evening.1': '🍺 Où sortir ce soir ?',
  'suggest.evening.2': '🌮 Quelque chose pour dîner',
  'suggest.evening.3': '🏨 Vous cherchez où dormir ?',
  'suggest.evening.4': '🌙 Lieux ouverts maintenant',
  'suggest.lateNight.1': '🌙 Lieux ouverts maintenant',
  'suggest.lateNight.2': '🍔 J’ai faim',
  'suggest.lateNight.3': '🏨 Je cherche où dormir',
  'suggest.general.1': '🍔 J’ai faim',
  'suggest.general.2': '🍺 Je veux une bière',
  'suggest.general.3': '☕ J’ai besoin d’un café',
  'suggest.general.4': '🏨 Je cherche où dormir',
  'suggest.general.5': '📍 Quelque chose de bien près de moi',

  'location.current': 'Votre position actuelle',
  'location.failure.denied':
    'Permission de localisation refusée. Nous continuons avec {label} comme référence ; vous pouvez changer de zone dans Réglages.',
  'location.failure.servicesOff':
    "La localisation de l'appareil est désactivée. Activez-la dans le système ou continuez avec {label}.",
  'location.failure.timeout':
    'Votre position a mis trop de temps à répondre. Nous continuons avec {label} ; vous pouvez réessayer.',
  'location.failure.error':
    "Votre position n'est pas disponible pour le moment. Nous utilisons {label} comme référence.",

  'category.food': 'Restauration',
  'category.beer': 'Bière',
  'category.coffee': 'Café',
  'category.lodging': 'Hébergement',
  'category.pharmacy': 'Pharmacies',
  'category.gas': 'Stations-service',
  'category.store': 'Magasins',
  'category.nightlife': 'Vie nocturne',
  'category.a11y': 'Catégorie {label}',
  'category.badgeA11y': 'Catégorie : {label}',

  'explore.allPlaces': 'Tous les lieux',
  'explore.locationLine': 'Culiacán · {label}',
  'explore.openNow': 'Ouvert maintenant',
  'explore.near': 'À proximité',
  'explore.searchInCategory': 'Chercher dans {category}…',
  'explore.nearbyPlaces': 'Lieux à proximité',
  'explore.emptyTitle': 'Aucun résultat',
  'explore.emptyFiltered':
    'Rien d\'ouvert avec ces filtres pour le moment. Retirez « Ouvert maintenant » ou changez de catégorie.',
  'explore.emptyGeneric': 'Essayez une autre catégorie ou modifiez votre recherche.',
  'explore.removeFilter': 'Retirer le filtre',
  'explore.seeAll': 'Tout voir',
  'explore.loadMore': 'Charger plus de lieux',
  'explore.loadMoreHint': 'Charge la page de résultats suivante',

  'status.open': 'Ouvert',
  'status.openUntil': "Ouvert jusqu'à {time}",
  'status.closed': 'Fermé',
  'status.unknown': 'Horaires non confirmés',

  'confidence.high': 'Confiance élevée',
  'confidence.medium': 'Information récente',
  'confidence.low': 'Information limitée',
  'confidence.a11y': "Fiabilité de l'information : {label}",

  'recommend.bestOption': 'MEILLEURE OPTION MAINTENANT',
  'recommend.bestOptionA11y': 'Meilleure option maintenant : {name}',
  'recommend.details': 'Détails',
  'recommend.detailsHint': 'Ouvre les détails du lieu',
  'reason.OPEN_NOW': 'il est ouvert',
  'reason.NEARBY': 'il est proche',
  'reason.RECENTLY_VERIFIED': 'ses informations ont été vérifiées récemment',
  'reason.HIGH_CONFIDENCE': 'ses informations sont très fiables',
  'reason.COMPLETE_INFORMATION': 'ses informations sont complètes',
  'reason.template': 'Recommandé parce que {list}.',
  'reason.and': ' et ',
  'reason.separator': ', ',
  'reason.fallback': "C'est l'option la plus pratique parmi les résultats disponibles.",
  'reason.EXACT_NAME_MATCH': 'il correspond exactement à votre recherche',
  'reason.NAME_MATCH': 'son nom correspond à votre recherche',
  'reason.NAME_AND_ACTIVITY': 'son nom et son activité correspondent',
  'reason.CATEGORY_MATCH': 'il correspond à la catégorie recherchée',
  'reason.TERM_MATCH': 'il correspond à votre recherche',
  'search.hoursUnconfirmed': "Les horaires ne sont pas confirmés ; résultats affichés par pertinence.",

  'place.directions': 'Itinéraire',
  'place.directionsHint': "Ouvre Google Maps avec l'itinéraire vers ce lieu",
  'place.address': 'Adresse',
  'place.phone': 'Téléphone',
  'place.website': 'Site web',
  'place.websiteA11y': 'Ouvrir le site de {name}',
  'place.priceLevel': 'Niveau de prix',
  'place.price.1': 'Prix économique',
  'place.price.2': 'Prix moyen',
  'place.price.3': 'Prix élevé',
  'place.price.4': 'Prix très élevé',
  'place.price.unknown': 'Prix non disponible',
  'place.source': 'Source',
  'place.sourceDemo': 'Données de démonstration (demo-seed)',
  'place.sourceDenue': 'INEGI DENUE — Répertoire officiel des unités économiques',
  'place.datasetUpdated':
    'Répertoire officiel mis à jour le {date}. Établissement pas encore vérifié individuellement.',
  'place.lastVerification': 'Dernière vérification',
  'place.verifiedOn': 'Vérifié le {date}',
  'place.verifiedUnknown': 'Date de vérification non disponible',
  'place.cardA11y': '{name}, {category}',
  'place.cardHint': 'Ouvre les détails du lieu',
  'place.loading': 'Chargement du lieu…',
  'place.notFoundTitle': 'Lieu introuvable',
  'place.notFoundBody': "Ce lieu n'est plus disponible dans les données de démonstration.",
  'place.navNote':
    "Locavo enregistre votre intention de naviguer ; il ne confirme ni visites ni achats. L'itinéraire s'ouvre dans Google Maps.",

  'navError.title': "Impossible d'ouvrir Google Maps pour {name}.",
  'navError.body':
    "Vérifiez qu'un navigateur ou l'application Google Maps est disponible, puis réessayez.",
  'navError.closeA11y': "Fermer l'avis",

  'map.a11y': 'Carte des résultats',
  'map.loading': 'Chargement de la carte…',
  'map.failedTitle': 'Impossible de charger la carte.',
  'map.failedBody': 'Vous pouvez continuer avec la liste des lieux.',
  'map.retry': 'Réessayer la carte',
  'map.yourLocation': 'Votre position',

  'state.loadingPlaces': 'Recherche de lieux près de vous…',
  'state.errorTitle': 'Un problème est survenu',
  'state.errorBody': 'Un problème est survenu lors du chargement des lieux.',
  'state.notFoundTitle': 'Écran introuvable',
  'state.notFoundBody': "L'itinéraire que vous avez essayé d'ouvrir n'existe pas.",

  'search.a11yLabel': 'Chercher des lieux',
  'search.a11yHint': 'Écrivez ce dont vous avez besoin, par exemple tacos ou pharmacie',
  'search.clear': 'Effacer la recherche',

  'settings.title': 'Réglages',
  'settings.theme': 'Thème',
  'settings.theme.system': 'Selon le système',
  'settings.theme.light': 'Mode clair',
  'settings.theme.dark': 'Mode sombre',
  'settings.theme.systemShort': 'système',
  'settings.theme.lightShort': 'clair',
  'settings.theme.darkShort': 'sombre',
  'settings.language': 'Langue',
  'settings.manualLocation': 'Position manuelle',
  'settings.manualLocationBody':
    "Si vous n'accordez pas la permission de localisation, Locavo utilise une zone de référence à Culiacán.",
  'settings.privacy': 'Confidentialité',
  'settings.privacyBody':
    "Votre position n'est lue que lorsque vous le demandez et uniquement pour trier les résultats ; pas de suivi en arrière-plan, pas d'historique de trajets, rien n'est envoyé à des serveurs. Les événements d'usage restent sur cet appareil.",
  'settings.demoData': 'Données de démonstration',
  'settings.demoDataBody':
    'Ceci est la phase de démonstration de Locavo : tous les lieux sont des données simulées avec le préfixe « Demo ». Ils ne représentent pas de vrais commerces vérifiés.',
  'settings.info': 'Informations',
  'settings.privacyLink': 'Confidentialité',
  'settings.termsLink': "Conditions d'utilisation",
  'settings.supportLink': 'Assistance',

  'privacy.title': 'Confidentialité',
  'privacy.intro': 'Voici comment Locavo traite vos informations pendant la phase de démonstration.',
  'privacy.location.title': 'Localisation',
  'privacy.location.body':
    'Locavo demande votre position uniquement pour afficher les lieux proches et trier les résultats. La lecture est ponctuelle : elle a lieu seulement quand vous la demandez.',
  'privacy.location.b1': 'Aucun suivi continu de votre position.',
  'privacy.location.b2': "Pas de localisation en arrière-plan.",
  'privacy.location.b3': "Aucun historique de trajets n'est conservé.",
  'privacy.location.b4': "Votre position n'est jamais envoyée à un serveur Locavo.",
  'privacy.location.b5':
    "Si vous refusez la permission, vous pouvez utiliser une zone manuelle de Culiacán et l'application continue de fonctionner.",
  'privacy.account.title': 'Compte et données personnelles',
  'privacy.account.body':
    "Locavo ne demande ni compte, ni inscription, ni données personnelles dans cette phase.",
  'privacy.analytics.title': 'Statistiques',
  'privacy.analytics.body':
    "Les statistiques de cette phase sont démonstratives et restent uniquement sur votre appareil. Aucun service externe n'est connecté et aucune coordonnée n'est enregistrée.",
  'privacy.data.title': 'Données des lieux',
  'privacy.data.body':
    'Les lieux affichés sont des données simulées de démonstration, identifiées par le préfixe « Demo ». Ils ne représentent pas de vrais commerces vérifiés.',
  'privacy.external.title': 'Services externes',
  'privacy.external.body1':
    "Quand vous demandez un itinéraire, Google Maps s'ouvre en externe (application ou navigateur) et applique sa propre politique de confidentialité.",
  'privacy.external.body2':
    'La carte interne utilise des tuiles de fournisseurs externes (OpenStreetMap) ; leur chargement peut nécessiter une connexion à ces serveurs.',
  'legal.note': 'Document initial de produit. Il sera révisé avant la publication commerciale.',

  'terms.title': "Conditions d'utilisation",
  'terms.intro': 'Conditions de la phase actuelle de démonstration de Locavo.',
  'terms.demo.title': 'Information démonstrative',
  'terms.demo.body1':
    'Les informations affichées dans cette phase sont démonstratives : les lieux sont des données simulées et ne représentent pas de vrais commerces vérifiés.',
  'terms.demo.body2':
    "Il n'existe pas encore de relation commerciale entre Locavo et les commerces affichés.",
  'terms.approx.title': 'Approximations',
  'terms.approx.body1':
    'Les horaires, distances et temps de trajet sont approximatifs et peuvent ne pas refléter la réalité. Aucune information de trafic en temps réel.',
  'terms.approx.body2':
    'Avant toute décision importante, confirmez les informations directement auprès du lieu.',
  'terms.nav.title': 'Navigation',
  'terms.nav.body':
    "Locavo n'offre pas de navigation propre. Demander un itinéraire ouvre Google Maps, un service externe avec ses propres conditions.",

  'support.title': 'Assistance',
  'support.intro': 'Réponses rapides aux questions les plus fréquentes de cette phase.',
  'support.enable.title': 'Comment activer ma position ?',
  'support.enable.b1':
    "Sur l'accueil, touchez le bouton de localisation à côté de votre zone et acceptez la permission.",
  'support.enable.b2':
    "Si vous l'avez refusée, activez-la dans les réglages du système : Locavo → Autorisations → Localisation.",
  'support.manual.title': 'Et si je ne veux pas partager ma position ?',
  'support.manual.body':
    'Vous pouvez utiliser Locavo sans permission : dans Réglages, choisissez une zone manuelle de Culiacán et les résultats seront triés depuis là.',
  'support.map.title': 'La carte ne charge pas',
  'support.map.b1': 'Vérifiez votre connexion internet : les tuiles de la carte en ont besoin.',
  'support.map.b2': "Utilisez le bouton « Réessayer la carte » de l'avis.",
  'support.map.b3':
    'Même si la carte échoue, la liste, la recherche et la recommandation continuent de fonctionner.',
  'support.maps.title': "Google Maps ne s'ouvre pas",
  'support.maps.b1': "Réessayez depuis l'avis à l'écran.",
  'support.maps.b2':
    "Le lien fonctionne même sans l'application Google Maps : il s'ouvrira dans le navigateur.",
  'support.maps.b3': "Vérifiez qu'un navigateur est disponible sur votre appareil.",
  'support.pwa.title': 'Comment installer Locavo comme application (PWA) ?',
  'support.pwa.b1': 'Ouvrez la version web de Locavo dans Chrome ou Edge.',
  'support.pwa.b2':
    "Sur Android : menu ⋮ puis « Ajouter à l'écran d'accueil » ou « Installer l'application ».",
  'support.pwa.b3': "Sur ordinateur : utilisez l'icône d'installation dans la barre d'adresse.",
  'support.pwa.b4': "Sur iPhone (Safari) : bouton Partager → « Sur l'écran d'accueil ».",
  'support.note': 'Le canal officiel de contact sera publié avant le lancement.',

  'format.months': 'janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc',
  'format.date': '{day} {month} {year}',
  'format.distanceM': 'À {value} m',
  'format.distanceKm': 'À {value} km',
  'format.distanceMi': 'À {value} mi',
  'format.travelTime': 'Environ {min} min',
};
