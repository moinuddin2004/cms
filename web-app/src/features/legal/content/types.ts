export type LegalBlock =
  | { type: 'h1' | 'h2' | 'h3' | 'p' | 'note'; text: string }
  | { type: 'ul' | 'ol'; items: Array<string> }
