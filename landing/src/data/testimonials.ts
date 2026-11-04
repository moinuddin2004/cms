/**
 * Real quotes from clinics only. Leave the list empty until a clinic has
 * agreed to be quoted; the page then shows the "first clinics" card instead.
 */
export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  clinic: string;
  city: string;
}

export const TESTIMONIALS: Testimonial[] = [];
