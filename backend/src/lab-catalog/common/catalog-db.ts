import { pgError } from 'src/common/database/sql';
import { catalogError, CatalogErrorCode } from './catalog-errors';

/**
 * Runs a write and turns the catalog's unique / exclusion violations into
 * friendly errors: `constraints` maps a constraint name to the error to
 * throw. Anything else is rethrown untouched.
 */
export async function mapConstraintErrors<T>(
  run: () => Promise<T>,
  constraints: Record<string, readonly [CatalogErrorCode, string]>,
): Promise<T> {
  try {
    return await run();
  } catch (err) {
    const { code, constraint } = pgError(err);
    if ((code === '23505' || code === '23P01') && constraint) {
      const hit = constraints[constraint];
      if (hit) throw catalogError(hit[0], hit[1]);
    }
    throw err;
  }
}

export const PRICE_OVERLAP: Record<
  string,
  readonly [CatalogErrorCode, string]
> = {
  excl_lab_service_prices_overlap: [
    'LAB_PRICE_OVERLAP',
    'Another price is already set for some of these dates',
  ],
};
