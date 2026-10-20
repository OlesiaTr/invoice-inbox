import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { z } from 'zod';
import { AppLayout } from '@/features/layout/AppLayout';
import { InvoicesPage } from '@/features/invoices/InvoicesPage';

/**
 * All view state lives in the URL (filters, sort, page, open invoice, chat panel):
 * shareable links, back button works, survives reload. Invalid values fall back to defaults.
 */
export const invoicesSearchSchema = z.object({
  status: z.enum(['uploaded', 'processing', 'completed', 'failed']).optional().catch(undefined),
  q: z.string().optional().catch(undefined),
  sort: z.enum(['createdAt', 'issueDate', 'total', 'vendorName']).optional().catch(undefined),
  dir: z.enum(['asc', 'desc']).optional().catch(undefined),
  page: z.number().int().min(1).optional().catch(undefined),
  invoice: z.string().optional().catch(undefined),
  chat: z.boolean().optional().catch(undefined),
});
export type InvoicesSearch = z.infer<typeof invoicesSearchSchema>;

const rootRoute = createRootRoute({ component: AppLayout });

export const invoicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search) => invoicesSearchSchema.parse(search),
  component: InvoicesPage,
});

export const router = createRouter({ routeTree: rootRoute.addChildren([invoicesRoute]) });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
