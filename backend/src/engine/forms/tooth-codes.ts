/**
 * FDI (ISO 3950) tooth codes: quadrant digit + tooth digit.
 * Permanent 11–18, 21–28, 31–38, 41–48; primary 51–55, 61–65, 71–75, 81–85.
 */

export type Dentition = 'permanent' | 'primary';
export type Arch = 'upper' | 'lower';

const PERMANENT_QUADRANTS = [1, 2, 3, 4];
const PRIMARY_QUADRANTS = [5, 6, 7, 8];

function codes(quadrants: number[], teeth: number): string[] {
  return quadrants.flatMap((q) =>
    Array.from({ length: teeth }, (_, i) => `${q}${i + 1}`),
  );
}

export const FDI_PERMANENT: ReadonlySet<string> = new Set(
  codes(PERMANENT_QUADRANTS, 8),
);
export const FDI_PRIMARY: ReadonlySet<string> = new Set(
  codes(PRIMARY_QUADRANTS, 5),
);

export function fdiDentition(code: string): Dentition | null {
  if (FDI_PERMANENT.has(code)) return 'permanent';
  if (FDI_PRIMARY.has(code)) return 'primary';
  return null;
}

/** Quadrants 1, 2, 5, 6 are upper; 3, 4, 7, 8 lower. */
export function fdiArch(code: string): Arch {
  return ['1', '2', '5', '6'].includes(code[0]) ? 'upper' : 'lower';
}
