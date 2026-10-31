import { z } from 'zod'

// Empty = not set here (inherit from the level above).
const optionalUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), {
    message: 'Must be an http(s) link',
  })

const values = z.object({
  app_name: z.string().trim().max(60, 'At most 60 characters'),
  logo_url: optionalUrl,
  logo_dark_url: optionalUrl,
  favicon_url: optionalUrl,
  brand_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like #2563eb'),
  sidebar_style: z.enum(['light', 'dark', 'brand']),
  default_mode: z.enum(['light', 'dark', 'system']),
  dark_base: z.enum(['tinted', 'graphite', 'midnight', 'stone', 'black']),
})

/** Org theme / platform defaults: values + per-key locks. */
export const themeFormSchema = z.object({
  values,
  locks: z.record(z.string(), z.boolean()),
})

export type ThemeFormValues = z.infer<typeof themeFormSchema>

/** A location's overrides: name and logos only. */
export const locationThemeSchema = values.pick({
  app_name: true,
  logo_url: true,
  logo_dark_url: true,
})

export type LocationThemeFormValues = z.infer<typeof locationThemeSchema>
