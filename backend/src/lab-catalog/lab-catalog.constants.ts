/**
 * Lab prices are platform-level (a lab serves clinics in many places), so
 * "today" for a price window is the platform's calendar day, not a
 * location's. Pakistan-first product; one zone keeps every lab's price
 * switch-over at the same midnight.
 */
export const CATALOG_TIMEZONE = 'Asia/Karachi';

/** At most this many service lines in one order template. */
export const MAX_TEMPLATE_ITEMS = 20;

/** Money is bigint minor units; this keeps every amount exactly representable in JS. */
export const MAX_MINOR = 1_000_000_000_00; // PKR 1 billion
