/**
 * Shape of `nav_layouts.layout` — mirrors `NavLayout` in the web app's
 * `features/access/nav/nav.registry.ts`. Keys are registry keys (`nav.*`);
 * the web app ignores keys it doesn't know.
 */
export interface NavLayoutItemJson {
  key: string;
  /** Clinic rename, e.g. "Billing desk" → "Cash counter". */
  label?: string;
  pinned?: boolean;
}

/** A collapsible group of links inside a section. */
export interface NavLayoutGroupJson {
  label: string;
  group: true;
  icon?: string;
  items: NavLayoutItemJson[];
}

export interface NavLayoutSectionJson {
  label?: string;
  /** The whole section renders as one collapsible group. */
  group?: boolean;
  icon?: string;
  items: (NavLayoutItemJson | NavLayoutGroupJson)[];
}

export interface NavLayoutJson {
  sections: NavLayoutSectionJson[];
  /** Keys the clinic hides. */
  hidden?: string[];
  /** Clinic-wide home page, used when the user's role sets none. */
  homeRoute?: string;
}
