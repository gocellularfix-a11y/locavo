/**
 * CATÁLOGO de campos de conocimiento (PKE-0).
 *
 * Un campo de conocimiento es la unidad atómica de información que el Place
 * Knowledge Engine puede afirmar sobre un lugar con evidencia. El catálogo es
 * la ÚNICA lista de campos: extender el conocimiento = agregar una entrada al
 * mapa (y su tipo de valor), jamás cambiar `KnowledgeFragment` ni
 * `PlaceKnowledge`.
 *
 * Los tipos de valor son primitivos canónicos del dominio (reutilizados de
 * `domain/place` y `LocavoPlace`), nunca DTOs de proveedor.
 */
import type { CategoryId, OpeningHours } from '../../domain/place';
import type { LocalizedText } from '../../domain/places/LocalizedText';

/** Plataforma social (cadena abierta; constantes canónicas abajo). */
export type SocialPlatform = string;

export const SOCIAL_PLATFORM_FACEBOOK: SocialPlatform = 'facebook';
export const SOCIAL_PLATFORM_INSTAGRAM: SocialPlatform = 'instagram';
export const SOCIAL_PLATFORM_TIKTOK: SocialPlatform = 'tiktok';
export const SOCIAL_PLATFORM_WHATSAPP: SocialPlatform = 'whatsapp';
export const SOCIAL_PLATFORM_X: SocialPlatform = 'x';
export const SOCIAL_PLATFORM_YOUTUBE: SocialPlatform = 'youtube';

/** Redes sociales OFICIALES del negocio: plataforma → URL canónica. */
export type SocialMediaLinks = Readonly<Partial<Record<SocialPlatform, string>>>;

/** Servicio disponible (cadena abierta; constantes canónicas abajo). */
export type ServiceTag = string;

export const SERVICE_DELIVERY: ServiceTag = 'delivery';
export const SERVICE_TAKEOUT: ServiceTag = 'takeout';
export const SERVICE_DINE_IN: ServiceTag = 'dine_in';
export const SERVICE_RESERVATIONS: ServiceTag = 'reservations';
export const SERVICE_WIFI: ServiceTag = 'wifi';
export const SERVICE_DRIVE_THRU: ServiceTag = 'drive_thru';

/** Método de pago (cadena abierta; constantes canónicas abajo). */
export type PaymentMethod = string;

export const PAYMENT_CASH: PaymentMethod = 'cash';
export const PAYMENT_CREDIT_CARD: PaymentMethod = 'credit_card';
export const PAYMENT_DEBIT_CARD: PaymentMethod = 'debit_card';
export const PAYMENT_TRANSFER: PaymentMethod = 'transfer';
export const PAYMENT_MOBILE: PaymentMethod = 'mobile_payment';

/**
 * Accesibilidad: booleanos tri-estado — ausente = desconocido, nunca `false`
 * por omisión (doctrina OSM V4F-0).
 */
export interface AccessibilityKnowledge {
  readonly wheelchairAccessible?: boolean;
  readonly stepFreeEntry?: boolean;
  readonly accessibleRestroom?: boolean;
  readonly accessibleParking?: boolean;
}

export type ParkingKind = 'street' | 'lot' | 'garage' | 'valet' | 'private';

export interface ParkingKnowledge {
  readonly available?: boolean;
  readonly free?: boolean;
  readonly kinds?: readonly ParkingKind[];
}

/**
 * Mapa campo → tipo de valor. Fuente de verdad del catálogo:
 * `KnowledgeFieldKey` y el tipado de fragmentos derivan de aquí.
 */
export interface KnowledgeFieldValueMap {
  /** Horario semanal (reutiliza el evaluador determinista existente). */
  readonly hours: OpeningHours;
  /** Teléfonos en formato canónico E.164 cuando sea derivable. */
  readonly phones: readonly string[];
  /** Sitio web oficial (URL absoluta). */
  readonly website: string;
  /** Correo electrónico de contacto público. */
  readonly email: string;
  readonly socialMedia: SocialMediaLinks;
  readonly services: readonly ServiceTag[];
  readonly paymentMethods: readonly PaymentMethod[];
  readonly accessibility: AccessibilityKnowledge;
  readonly parking: ParkingKnowledge;
  /** Categorías adicionales dentro de la taxonomía canónica (nunca texto libre). */
  readonly extraCategories: readonly CategoryId[];
  /** Descripción localizable; el texto original jamás se sobrescribe. */
  readonly description: LocalizedText;
}

export type KnowledgeFieldKey = keyof KnowledgeFieldValueMap;

/** Valor tipado de un campo concreto del catálogo. */
export type KnowledgeValueOf<K extends KnowledgeFieldKey> = KnowledgeFieldValueMap[K];

/**
 * Guardia de exhaustividad: si `KnowledgeFieldValueMap` gana o pierde un campo
 * sin actualizar esta tabla, la compilación falla. El arreglo canónico deriva
 * de aquí (orden de inserción = orden canónico del catálogo).
 */
const KNOWLEDGE_FIELD_CATALOG: Readonly<Record<KnowledgeFieldKey, true>> = {
  hours: true,
  phones: true,
  website: true,
  email: true,
  socialMedia: true,
  services: true,
  paymentMethods: true,
  accessibility: true,
  parking: true,
  extraCategories: true,
  description: true,
};

/** Orden canónico y completo del catálogo (validado por test). */
export const KNOWLEDGE_FIELD_KEYS: readonly KnowledgeFieldKey[] = Object.keys(
  KNOWLEDGE_FIELD_CATALOG,
) as KnowledgeFieldKey[];
