/**
 * Optional privacy filter applied to note text before it leaves the browser.
 * Deliberately conservative: it targets contact details and identifier formats, and leaves
 * numbers, units, equations and dates intact so scientific notes are not damaged.
 */
const PATTERNS: [RegExp, string][] = [
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]'],
  [/\b\d{3}-\d{2}-\d{4}\b/g, '[id-number]'],
  [/(?:\+\d{1,3}[\s.-]?)?\(\d{3}\)\s?\d{3}[\s.-]\d{4}\b/g, '[phone]'],
  [/(?<![\d.])(?:\+\d{1,3}[\s.-])?\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/g, '[phone]'],
  [/\b(?:\d[ -]?){13,19}\b/g, (m: string) => (luhn(m.replace(/\D/g, '')) ? '[card-number]' : m)] as unknown as [RegExp, string],
];

function luhn(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

export function redactPII(text: string): string {
  let out = text;
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep as never);
  return out;
}
