import { type AppConfig } from '../config/config';
import { type PrismaService } from '../prisma/prisma.service';
import { type JobQueue } from '../queue/job-queue';
import { type FileStorage } from '../storage/file-storage';
import { DEFAULT_PAGE_SIZE, InvoicesService, MAX_PAGE_SIZE } from './invoices.service';

/**
 * Pagination bounds only — everything that needs a real database lives in
 * processing.int-spec.ts. Captures the arguments the service hands to Prisma.
 */
function serviceWithSpy() {
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = {
    // `list` runs both reads in one transaction; resolve the array of promises it passes in.
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
    invoice: { findMany, count: jest.fn().mockResolvedValue(0) },
  } as unknown as PrismaService;

  const service = new InvoicesService(prisma, {} as JobQueue, {} as FileStorage, {} as AppConfig);
  return { service, findMany };
}

describe('InvoicesService.list pagination', () => {
  it('defaults to the standard page size starting at the first row', async () => {
    const { service, findMany } = serviceWithSpy();
    await service.list({});
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: DEFAULT_PAGE_SIZE, skip: 0 }));
  });

  it('caps an oversized limit instead of letting a client ask for everything', async () => {
    const { service, findMany } = serviceWithSpy();
    await service.list({ limit: 10_000 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: MAX_PAGE_SIZE }));
  });

  // Regression: these reached Prisma unchanged, and a negative skip is an error there, not
  // an empty page — so a hand-written query could turn into a 500.
  it.each([
    [0, 1],
    [-5, 1],
  ])('raises a limit of %s to %s', async (limit, expected) => {
    const { service, findMany } = serviceWithSpy();
    await service.list({ limit });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: expected }));
  });

  it('floors a negative offset at zero', async () => {
    const { service, findMany } = serviceWithSpy();
    await service.list({ offset: -1 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
  });
});
