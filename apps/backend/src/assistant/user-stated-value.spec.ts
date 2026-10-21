import { userStatedValue } from './user-stated-value';

describe('userStatedValue', () => {
  it.each([
    ['set the total to 1200', 1200],
    ['total should be €1,200.00', 1200],
    ['tax is 19,50', 19.5],
    ['vendor is Acme GmbH', 'acme gmbh'],
    ['due date 01.10.2026', '2026-10-01'],
    ['issued Sep 3, 2026', '2026-09-03'],
  ] as const)('accepts "%s" for %s', (text, value) => {
    expect(userStatedValue(text, value)).toBe(true);
  });

  it.each([
    ["let's correct the sum of FL-1", 150.5],
    ['FL-1 total is wrong', 1],
    ['change the vendor', 'Acme'],
    ['set the total to 12', 120],
  ] as const)('rejects "%s" for %s', (text, value) => {
    expect(userStatedValue(text, value)).toBe(false);
  });
});
