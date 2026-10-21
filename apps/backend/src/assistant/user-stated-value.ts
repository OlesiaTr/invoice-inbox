/** Any number appearing in free text: 1200, -1,200.00, "1 200,50". */
const NUMBER_IN_TEXT = /-?\d[\d,.\s]*\d|-?\d/g;

/** Trailing comma group, which marks the comma as a decimal separator ("1.200,50"). */
const DECIMAL_COMMA = /,\d{1,2}$/;

/** An already-normalised date. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Date shapes a person might type: 2026-09-01, 01/09/2026, September 1, 2026, 1 Sep 2026. */
const DATE_IN_TEXT =
  /\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{4}|[a-z]{3,9}\.? \d{1,2},? \d{4}|\d{1,2} [a-z]{3,9} \d{4}/gi;

/** Day-first date, captured so it can be reordered into ISO. */
const DMY_DATE = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/;

/** Amounts are compared with a tolerance, not for equality — the text is user-typed. */
const AMOUNT_TOLERANCE = 0.005;

const collapseWhitespace = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** "1,200.00", "1 200,50" and "1200" all mean the same number. */
const matchesNumber = (text: string, value: number): boolean =>
  (text.match(NUMBER_IN_TEXT) ?? []).some((candidate) => {
    const clean = candidate.replace(/[\s,]/g, (m) => (m === ',' && DECIMAL_COMMA.test(candidate) ? '.' : ''));
    return Math.abs(Number(clean) - value) < AMOUNT_TOLERANCE;
  });

/** The value is already YYYY-MM-DD; any date in the text that lands on that day counts. */
const matchesDate = (text: string, isoValue: string): boolean =>
  (text.match(DATE_IN_TEXT) ?? []).some((candidate) => {
    const dmy = DMY_DATE.exec(candidate);
    const iso = dmy ? `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}` : candidate;
    // Parsed as UTC either way, so the day can't drift with the server's timezone.
    const parsed = Date.parse(ISO_DATE.test(iso) ? `${iso}T00:00:00Z` : `${iso} UTC`);
    return !Number.isNaN(parsed) && new Date(parsed).toISOString().slice(0, 10) === isoValue;
  });

/**
 * Does the user's own message contain this value?
 *
 * This is the check behind `userStatedArgs`: the model may propose an edit, but the value
 * has to be one the user actually gave. Enforced in code rather than asked for in the
 * prompt, because a prompt is advice and this is a rule.
 */
export const userStatedValue = (text: string, value: unknown): boolean => {
  if (typeof value === 'number') return matchesNumber(text, value);
  if (typeof value !== 'string') return false;
  if (collapseWhitespace(text).includes(collapseWhitespace(value))) return true;
  return ISO_DATE.test(value) && matchesDate(text, value);
};
