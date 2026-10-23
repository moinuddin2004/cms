import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  registerDecorator,
  ValidateNested,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import type { NavLayoutSectionJson } from './nav-layout.types';

export const NAV_KEY_PATTERN = /^nav\.[a-z0-9_.-]+$/;
export const NAV_LABEL_MAX = 40;
export const NAV_SECTIONS_MAX = 20;
/** Per list (a section's or a group's items). */
export const NAV_ITEMS_MAX = 100;
const ICON_PATTERN = /^[A-Za-z0-9]{1,40}$/;
/** In-app path only: one leading slash, no scheme or `//host`. */
const HOME_ROUTE_PATTERN = /^\/(?!\/)[A-Za-z0-9/_.-]{0,199}$/;

const keyMessage = 'key must look like nav.something (a-z, 0-9, _ . -)';

/**
 * Cross-field rules the per-field decorators can't express: a section entry
 * is either a link (`key`, no `items`) or a group (`group: true`, a label and
 * `items`, no `key`), and no key appears twice anywhere. Null = valid.
 */
export function navSectionsProblem(sections: unknown): string | null {
  if (!Array.isArray(sections)) return 'sections must be an array';
  const seen = new Set<string>();
  const addKey = (key: unknown): string | null => {
    if (typeof key !== 'string') return 'every item needs a key';
    if (seen.has(key)) return `duplicate key ${key}`;
    seen.add(key);
    return null;
  };
  for (const section of sections as Partial<NavLayoutSectionJson>[]) {
    if (!section || !Array.isArray(section.items)) continue; // per-field error
    for (const raw of section.items as unknown[]) {
      if (!raw || typeof raw !== 'object') return 'invalid item';
      const entry = raw as Record<string, unknown>;
      if (entry.group === true) {
        if (entry.key !== undefined) return 'a group cannot have a key';
        if (typeof entry.label !== 'string' || !entry.label.trim()) {
          return 'every group needs a label';
        }
        if (!Array.isArray(entry.items)) return 'every group needs items';
        for (const child of entry.items as { key?: unknown }[]) {
          const problem = addKey(child?.key);
          if (problem) return problem;
        }
      } else {
        if (entry.items !== undefined || entry.icon !== undefined) {
          return `item ${String(entry.key)} cannot have items or an icon (set group: true)`;
        }
        const problem = addKey(entry.key);
        if (problem) return problem;
      }
    }
  }
  return null;
}

function IsNavSections(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isNavSections',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => navSectionsProblem(value) === null,
        defaultMessage: (args: ValidationArguments) =>
          `${args.property}: ${navSectionsProblem(args.value) ?? 'invalid'}`,
      },
    });
}

/** A link inside a group. */
export class NavLayoutItemDto {
  @Matches(NAV_KEY_PATTERN, { message: keyMessage })
  @MaxLength(100)
  key: string;

  @IsOptional()
  @IsString()
  @MaxLength(NAV_LABEL_MAX)
  label?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

/** A section entry: a link (`key`) or a group (`group: true` + `items`). */
export class NavLayoutEntryDto {
  @IsOptional()
  @Matches(NAV_KEY_PATTERN, { message: keyMessage })
  @MaxLength(100)
  key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NAV_LABEL_MAX)
  label?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @Equals(true)
  group?: true;

  @IsOptional()
  @Matches(ICON_PATTERN)
  icon?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(NAV_ITEMS_MAX)
  @ValidateNested({ each: true })
  @Type(() => NavLayoutItemDto)
  items?: NavLayoutItemDto[];
}

export class NavLayoutSectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(NAV_LABEL_MAX)
  label?: string;

  @IsOptional()
  @IsBoolean()
  group?: boolean;

  @IsOptional()
  @Matches(ICON_PATTERN)
  icon?: string;

  @IsArray()
  @ArrayMaxSize(NAV_ITEMS_MAX)
  @ValidateNested({ each: true })
  @Type(() => NavLayoutEntryDto)
  items: NavLayoutEntryDto[];
}

/** `PUT /admin/navigation` body — the whole layout. */
export class NavLayoutDto {
  @IsArray()
  @ArrayMaxSize(NAV_SECTIONS_MAX)
  @ValidateNested({ each: true })
  @Type(() => NavLayoutSectionDto)
  @IsNavSections()
  sections: NavLayoutSectionDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(NAV_ITEMS_MAX * 2)
  @ArrayUnique()
  @Matches(NAV_KEY_PATTERN, { each: true, message: keyMessage })
  hidden?: string[];

  @IsOptional()
  @Matches(HOME_ROUTE_PATTERN, {
    message: 'homeRoute must be an in-app path like /queue/doctor',
  })
  homeRoute?: string;
}
