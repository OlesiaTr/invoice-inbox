import { type ExtractedInvoice, extractedInvoiceSchema, promotedColumns, sanityCheck } from './invoice-data';

const base: ExtractedInvoice = {
  invoiceNumber: 'INV-1',
  vendorName: 'Acme',
  vendorAddress: null,
  customerName: null,
  issueDate: '2026-09-01',
  dueDate: '2026-10-01',
  currency: 'EUR',
  subtotal: 100,
  tax: 19,
  total: 119,
  lineItems: [{ description: 'Hosting', quantity: 1, unitPrice: 100, amount: 100 }],
};

describe('extractedInvoiceSchema (lenient parsing of model output)', () => {
  it('normalises the messy values small models produce', () => {
    const parsed = extractedInvoiceSchema.parse({
      ...base,
      total: '€1,234.50',
      tax: 'n/a',
      issueDate: 'September 1, 2026',
      currency: 'eur',
      vendorName: '   ',
      lineItems: 'none',
    });
    expect(parsed.total).toBe(1234.5);
    expect(parsed.tax).toBeNull();
    expect(parsed.issueDate).toBe('2026-09-01');
    expect(parsed.currency).toBe('EUR');
    expect(parsed.vendorName).toBeNull();
    expect(parsed.lineItems).toEqual([]);
  });

  it('turns an unknown currency string into null instead of failing', () => {
    expect(extractedInvoiceSchema.parse({ ...base, currency: 'Euros' }).currency).toBeNull();
  });

  // Regression: normalising via toISOString() moved the day back for every timezone east
  // of UTC, because a date with no time parses as local midnight.
  it.each([
    ['September 1, 2026', '2026-09-01'],
    ['01/09/2026', '2026-01-09'],
    ['2026-09-01', '2026-09-01'],
    ['1 Sep 2026', '2026-09-01'],
  ])('normalises %s to %s regardless of the machine timezone', (input, expected) => {
    expect(extractedInvoiceSchema.parse({ ...base, issueDate: input }).issueDate).toBe(expected);
  });
});

describe('sanityCheck', () => {
  it('has no warnings for a consistent invoice', () => {
    expect(sanityCheck(base)).toEqual([]);
  });

  it('flags subtotal + tax ≠ total', () => {
    expect(sanityCheck({ ...base, total: 150 })).toContainEqual(expect.stringContaining('does not equal total'));
  });

  it('still checks the total when no tax amount was found', () => {
    expect(sanityCheck({ ...base, tax: null, total: 150 })).toContainEqual(
      expect.stringContaining('Subtotal (100.00) does not equal total (150.00) and no tax amount was found'),
    );
    expect(sanityCheck({ ...base, tax: null, total: 100 })).toEqual([]);
  });

  it('flags line items that do not add up', () => {
    const lineItems = [{ description: 'x', quantity: 1, unitPrice: 50, amount: 50 }];
    expect(sanityCheck({ ...base, lineItems })).toContainEqual(expect.stringContaining('Line items add up to 50.00'));
  });

  it('tolerates rounding differences of a cent', () => {
    expect(sanityCheck({ ...base, tax: 19.004, total: 119.01 })).toEqual([]);
  });

  it('flags missing key fields and impossible dates', () => {
    const warnings = sanityCheck({ ...base, total: null, invoiceNumber: null, dueDate: '2026-08-01' });
    expect(warnings).toEqual(
      expect.arrayContaining([
        'Total amount not found',
        'Invoice number not found',
        'Due date is before the issue date',
      ]),
    );
  });
});

describe('promotedColumns', () => {
  it('copies the sortable fields out of the JSON', () => {
    expect(promotedColumns(base)).toEqual({
      vendorName: 'Acme',
      invoiceNumber: 'INV-1',
      issueDate: new Date('2026-09-01T00:00:00Z'),
      total: 119,
      currency: 'EUR',
    });
  });
});
