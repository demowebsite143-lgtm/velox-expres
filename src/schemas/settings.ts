import { z } from 'zod';

/**
 * One schema per settings row. The admin form and the runtime reader
 * use the same object, so a field can never be saved in a shape the
 * site cannot render.
 *
 * Every field has a default. A missing or malformed row degrades to
 * defaults rather than crashing the site — losing a settings row should
 * never take the business offline.
 */

const url = z.string().trim().default('');
const hex = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Use a hex colour like #0A1F44');

export const brandSchema = z.object({
  websiteName: z.string().trim().default(''),
  brandName: z.string().trim().default(''),
  tagline: z.string().trim().default(''),
  brandDescription: z.string().trim().default(''),
  logoUrl: url,
  logoLightUrl: url,
  logoDarkUrl: url,
  footerLogoUrl: url,
  faviconUrl: url,
  appIconUrl: url,
  browserTitle: z.string().trim().default(''),
});

export const contactSchema = z.object({
  businessName: z.string().trim().default(''),
  proprietor: z.string().trim().default(''),
  phone: z.string().trim().default(''),
  whatsapp: z.string().trim().default(''),
  countryCode: z.string().trim().default('91'),
  email: z.string().trim().default(''),
  addressLine1: z.string().trim().default(''),
  addressLine2: z.string().trim().default(''),
  city: z.string().trim().default(''),
  state: z.string().trim().default(''),
  pinCode: z.string().trim().default(''),
  mapsUrl: url,
  businessHoursNote: z.string().trim().default(''),
});

export const socialSchema = z.object({
  facebook: url,
  instagram: url,
  youtube: url,
  x: url,
  linkedin: url,
});

export const themeSchema = z.object({
  primary: hex.default('#0A1F44'),
  primaryDark: hex.default('#06142E'),
  primaryLight: hex.default('#1A3A70'),
  accent: hex.default('#FFC42E'),
  accentDark: hex.default('#E0A616'),
  secondary: hex.default('#1A3A70'),
  background: hex.default('#F6F8FB'),
  surface: hex.default('#FFFFFF'),
  text: hex.default('#0F1A2D'),
  textMuted: hex.default('#64728A'),
  border: hex.default('#E0E5EE'),
  buttonRadius: z.coerce.number().min(0).max(32).default(12),
});

export const navItemSchema = z.object({
  label: z.string().trim().min(1, 'Label is required'),
  path: z.string().trim().min(1, 'Path is required'),
  visible: z.boolean().default(true),
  order: z.coerce.number().default(0),
});

export const navigationSchema = z.object({
  items: z.array(navItemSchema).default([]),
  ctaLabel: z.string().trim().default(''),
  ctaPath: z.string().trim().default('/book'),
});

export const headerSchema = z.object({
  showAnnouncement: z.boolean().default(false),
  announcementText: z.string().trim().default(''),
  announcementLink: z.string().trim().default(''),
  showCallButton: z.boolean().default(true),
  showWhatsappButton: z.boolean().default(true),
  sticky: z.boolean().default(true),
});

export const footerLinkSchema = z.object({
  label: z.string().trim().min(1),
  path: z.string().trim().min(1),
});

export const footerSectionSchema = z.object({
  title: z.string().trim().min(1),
  links: z.array(footerLinkSchema).default([]),
});

export const footerSchema = z.object({
  description: z.string().trim().default(''),
  copyright: z.string().trim().default(''),
  showSocial: z.boolean().default(true),
  sections: z.array(footerSectionSchema).default([]),
});

export const seoSchema = z.object({
  title: z.string().trim().default(''),
  metaDescription: z.string().trim().default(''),
  ogImageUrl: url,
  keywords: z.string().trim().default(''),
  canonicalUrl: url,
});

export const pwaSchema = z.object({
  appName: z.string().trim().default(''),
  shortName: z.string().trim().default(''),
  themeColor: hex.default('#0A1F44'),
  backgroundColor: hex.default('#FFFFFF'),
  iconUrl: url,
  display: z.enum(['standalone', 'fullscreen', 'minimal-ui', 'browser']).default('standalone'),
});

export const bookingSchema = z.object({
  parcelTypes: z.array(z.string().trim().min(1)).default([]),
  /** 0 means no configured limit. */
  maxWeightKg: z.coerce.number().min(0).default(0),
  minLeadTimeHours: z.coerce.number().min(0).default(0),
  maxAdvanceDays: z.coerce.number().min(0).max(90).default(7),
  requireReceiverPhone: z.boolean().default(true),
  unavailableMessage: z
    .string()
    .trim()
    .default('Pricing is currently unavailable. Please contact us.'),
});

/**
 * Payment display configuration. Note what is absent: no gateway secret,
 * no API key. Those live in Edge Function environment variables, never
 * in a table the browser can read.
 */
export const paymentsSchema = z.object({
  upiId: z.string().trim().default(''),
  upiDisplayName: z.string().trim().default(''),
  qrImageUrl: url,
  instructions: z.string().trim().default(''),
  onlineEnabled: z.boolean().default(false),
  cashEnabled: z.boolean().default(true),
  payLaterEnabled: z.boolean().default(false),
  gatewayEnabled: z.boolean().default(false),
});

export const settingsSchemas = {
  brand: brandSchema,
  contact: contactSchema,
  social: socialSchema,
  theme: themeSchema,
  navigation: navigationSchema,
  header: headerSchema,
  footer: footerSchema,
  seo: seoSchema,
  pwa: pwaSchema,
  booking: bookingSchema,
  payments: paymentsSchema,
} as const;

export type SettingsKey = keyof typeof settingsSchemas;

export type SettingsShape = {
  [K in SettingsKey]: z.infer<(typeof settingsSchemas)[K]>;
};

export const SETTINGS_KEYS = Object.keys(settingsSchemas) as SettingsKey[];

/** Every domain parsed from `{}` — the fallback when a row is missing. */
export function defaultSettings(): SettingsShape {
  return SETTINGS_KEYS.reduce((acc, key) => {
    // @ts-expect-error indexed write across a mapped type
    acc[key] = settingsSchemas[key].parse({});
    return acc;
  }, {} as SettingsShape);
}

/**
 * Parse one row leniently. A bad field falls back to its default and is
 * reported, rather than throwing and blanking the whole site.
 */
export function parseSetting<K extends SettingsKey>(
  key: K,
  value: unknown,
): { data: SettingsShape[K]; issues: string[] } {
  const result = settingsSchemas[key].safeParse(value ?? {});
  if (result.success) {
    return { data: result.data as SettingsShape[K], issues: [] };
  }
  return {
    data: settingsSchemas[key].parse({}) as SettingsShape[K],
    issues: result.error.issues.map((i) => `${key}.${i.path.join('.')}: ${i.message}`),
  };
}
