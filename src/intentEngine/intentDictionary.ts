/**
 * Diccionarios de INTENCIÓN (Intent Engine V1) — cerrados, deterministas,
 * multilingües (en/es/pt). Contienen FRASES de necesidad, sustantivos de
 * categoría y sinónimos directos; NO platillos ni marcas específicas ("tacos",
 * "starbucks"): esos caen a la búsqueda universal, donde el índice es más
 * preciso. Las entradas se normalizan al hacer match (se pueden escribir
 * naturales). Sin traducción por API: dictados humanos y versionados.
 */
import type { IntentLanguage, SearchIntentId } from './types';

type IntentPhrases = Readonly<Record<IntentLanguage, readonly string[]>>;

export const INTENT_DICTIONARY: Readonly<Record<SearchIntentId, IntentPhrases>> = {
  FOOD: {
    en: ['food', 'restaurant', 'restaurants', 'eat', 'hungry', "i'm hungry", 'im hungry', 'starving', "i'm starving", 'lunch', 'dinner', 'breakfast', 'where to eat', 'where can i eat', 'something to eat', 'place to eat', 'grab a bite'],
    es: ['comida', 'restaurante', 'restaurantes', 'comer', 'hambre', 'tengo hambre', 'quiero comer', 'donde comer', 'almuerzo', 'cena', 'desayuno', 'algo de comer', 'lugar para comer'],
    pt: ['comida', 'restaurante', 'restaurantes', 'comer', 'fome', 'estou com fome', 'quero comer', 'onde comer', 'almoco', 'jantar', 'lanche'],
  },
  COFFEE: {
    en: ['coffee', 'cafe', 'cafes', 'espresso', 'latte', 'cappuccino', 'coffee shop', 'coffee shops', 'need coffee', 'morning coffee'],
    es: ['cafe', 'cafes', 'cafeteria', 'cafeterias', 'espresso', 'capuchino', 'un cafe', 'quiero un cafe'],
    pt: ['cafe', 'cafes', 'cafeteria', 'cafeterias', 'espresso', 'cafezinho', 'um cafe'],
  },
  BEER: {
    en: ['beer', 'beers', 'cold beer', 'brewery', 'pub', 'six pack'],
    es: ['cerveza', 'cervezas', 'chela', 'chelas', 'cheve', 'cerveceria', 'caguama', 'cerveza fria'],
    pt: ['cerveja', 'cervejas', 'cervejaria', 'chopp', 'gelada'],
  },
  LODGING: {
    en: ['hotel', 'hotels', 'motel', 'motels', 'sleep', 'room', 'rooms', 'accommodation', 'place to sleep', 'where can i sleep', 'where to sleep', 'need a room', 'somewhere to stay', 'lodging'],
    es: ['hotel', 'hoteles', 'motel', 'moteles', 'hospedaje', 'habitacion', 'donde dormir', 'un cuarto', 'alojamiento', 'quiero dormir', 'donde puedo dormir', 'donde quedarme'],
    pt: ['hotel', 'hoteis', 'motel', 'moteis', 'hospedagem', 'quarto', 'onde dormir', 'pousada', 'acomodacao'],
  },
  FUEL: {
    en: ['gas', 'fuel', 'gasoline', 'gas station', 'gas stations', 'fill up', 'need gas', 'petrol', 'diesel', 'out of gas'],
    es: ['gasolina', 'gasolinera', 'gasolineras', 'combustible', 'cargar gasolina', 'diesel'],
    pt: ['gasolina', 'posto', 'postos', 'posto de gasolina', 'combustivel', 'abastecer', 'diesel'],
  },
  PHARMACY: {
    en: ['pharmacy', 'pharmacies', 'drugstore', 'drugstores', 'drug store', 'medicine', 'medication', 'need medicine', 'prescription'],
    es: ['farmacia', 'farmacias', 'medicina', 'medicamento', 'botica', 'remedio', 'necesito medicina'],
    pt: ['farmacia', 'farmacias', 'remedio', 'medicamento', 'drogaria'],
  },
  SHOPPING: {
    en: ['shopping', 'shop', 'mall', 'go shopping', 'shopping mall'],
    es: ['compras', 'ir de compras', 'centro comercial', 'plaza comercial'],
    pt: ['compras', 'fazer compras', 'shopping center'],
  },
  NIGHTLIFE: {
    en: ['nightlife', 'bar', 'bars', 'club', 'clubs', 'nightclub', 'nightclubs', 'party', 'drinks', 'night out', 'disco'],
    es: ['antro', 'antros', 'bar', 'bares', 'cantina', 'discoteca', 'fiesta', 'vida nocturna', 'tragos', 'copas'],
    pt: ['balada', 'baladas', 'bar', 'bares', 'boate', 'festa', 'vida noturna'],
  },
  SUPERMARKET: {
    en: ['supermarket', 'supermarkets', 'grocery', 'groceries', 'grocery store', 'grocery stores'],
    es: ['supermercado', 'supermercados', 'abarrotes', 'mandado', 'despensa', 'super'],
    pt: ['supermercado', 'supermercados', 'mercado', 'mercearia'],
  },
  CONVENIENCE_STORE: {
    en: ['convenience store', 'corner store', 'mini market'],
    es: ['tienda de conveniencia', 'mini super', 'tiendita'],
    pt: ['conveniencia', 'mercadinho'],
  },
  TOURIST_ATTRACTION: {
    en: ['tourist attraction', 'things to do', 'sightseeing', 'landmark', 'attractions', 'what to see'],
    es: ['turismo', 'atracciones', 'que ver', 'lugares turisticos', 'que hacer'],
    pt: ['turismo', 'atracoes', 'o que fazer', 'pontos turisticos'],
  },
  ATM: {
    en: ['atm', 'cash machine', 'withdraw cash', 'withdraw money'],
    es: ['cajero', 'cajero automatico', 'retirar dinero', 'sacar dinero'],
    pt: ['caixa eletronico', 'sacar dinheiro'],
  },
  HOSPITAL: {
    en: ['hospital', 'emergency room', 'urgent care', 'emergency'],
    es: ['hospital', 'urgencias', 'emergencia', 'clinica'],
    pt: ['hospital', 'pronto socorro', 'emergencia'],
  },
  PARKING: {
    en: ['parking', 'parking lot', 'where to park'],
    es: ['estacionamiento', 'donde estacionar', 'aparcar'],
    pt: ['estacionamento', 'onde estacionar'],
  },
  PUBLIC_RESTROOM: {
    en: ['restroom', 'bathroom', 'toilet', 'public restroom', 'washroom'],
    es: ['bano', 'sanitario', 'servicios', 'bano publico'],
    pt: ['banheiro', 'toalete', 'sanitario'],
  },
  EV_CHARGING: {
    en: ['ev charging', 'charging station', 'ev charger', 'charge my car'],
    es: ['cargador electrico', 'estacion de carga', 'cargar auto electrico'],
    pt: ['carregador', 'estacao de carga', 'carregar carro eletrico'],
  },
  AIRPORT: {
    en: ['airport', 'terminal', 'flight'],
    es: ['aeropuerto', 'vuelo', 'terminal aerea'],
    pt: ['aeroporto', 'voo'],
  },
  BUS_STATION: {
    en: ['bus station', 'bus stop', 'bus terminal'],
    es: ['central de autobuses', 'parada de autobus', 'terminal de autobuses'],
    pt: ['rodoviaria', 'ponto de onibus'],
  },
  TAXI: {
    en: ['taxi', 'cab', 'taxi stand'],
    es: ['taxi', 'sitio de taxis'],
    pt: ['taxi', 'ponto de taxi'],
  },
  POLICE: {
    en: ['police', 'police station', 'police department'],
    es: ['policia', 'estacion de policia'],
    pt: ['policia', 'delegacia'],
  },
  FIRE_DEPARTMENT: {
    en: ['fire department', 'fire station', 'firefighters'],
    es: ['bomberos', 'estacion de bomberos'],
    pt: ['bombeiros', 'corpo de bombeiros'],
  },
  BANK: {
    en: ['bank', 'bank branch'],
    es: ['banco', 'sucursal bancaria'],
    pt: ['banco', 'agencia bancaria'],
  },
};
