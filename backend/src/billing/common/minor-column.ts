import { Column, ColumnOptions, ValueTransformer } from 'typeorm';

/**
 * `bigint` comes back from pg as a string; expose it as an integer number of
 * minor units. Clinic amounts stay far below 2^53, so `Number` is exact.
 */
export const minorTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/**
 * Integer minor units column (`bigint`). NOT NULL default 0 unless `nullable` is
 * passed. Used by the commission tables, which store money as minor units.
 */
export function MinorColumn(
  name: string,
  opts: Pick<ColumnOptions, 'nullable' | 'default'> = {},
): PropertyDecorator {
  return Column({
    name,
    type: 'bigint',
    transformer: minorTransformer,
    nullable: opts.nullable ?? false,
    ...(opts.nullable
      ? {}
      : { default: (opts.default as number | undefined) ?? 0 }),
  });
}
