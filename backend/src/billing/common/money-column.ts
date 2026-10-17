import { Column, ColumnOptions, ValueTransformer } from 'typeorm';
import { roundRupees } from './money';

/** numeric comes back from pg as a string; expose it as rupees (number). */
export const moneyTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : roundRupees(value)),
};

/**
 * `numeric(12,2)` money column (5.0). NOT NULL default 0 unless
 * `nullable` is passed; may hold negatives only where documented (signed).
 */
export function MoneyColumn(
  name: string,
  opts: Pick<ColumnOptions, 'nullable' | 'default'> = {},
): PropertyDecorator {
  return Column({
    name,
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: moneyTransformer,
    nullable: opts.nullable ?? false,
    ...(opts.nullable
      ? {}
      : { default: (opts.default as number | undefined) ?? 0 }),
  });
}
