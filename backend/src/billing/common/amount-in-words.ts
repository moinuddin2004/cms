/**
 * "Rupees Five Thousand Eight Hundred Only" (9.1). English thousand /
 * million wording — lakh/crore is intentionally not used. Pure.
 */
const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];
const SCALES = ['', 'Thousand', 'Million', 'Billion'];

function belowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(' ');
}

export function integerInWords(n: number): string {
  if (n === 0) return 'Zero';
  const groups: string[] = [];
  let scale = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk)
      groups.unshift(
        `${belowThousand(chunk)}${SCALES[scale] ? ` ${SCALES[scale]}` : ''}`,
      );
    n = Math.floor(n / 1000);
    scale++;
  }
  return groups.join(' ');
}

export function amountInWords(rupees: number): string {
  const minorTotal = Math.round(Math.abs(rupees) * 100);
  const whole = Math.floor(minorTotal / 100);
  const minor = minorTotal % 100;
  const words = `Rupees ${integerInWords(whole)}`;
  return minor
    ? `${words} and ${integerInWords(minor)} Paisa Only`
    : `${words} Only`;
}
