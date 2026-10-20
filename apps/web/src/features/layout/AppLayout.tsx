import { Outlet, useNavigate, useSearch } from '@tanstack/react-router';
import { FileText, Moon, Sparkles, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AssistantPanel } from '@/features/assistant/AssistantPanel';
import { useInvoiceLiveUpdates } from '@/features/invoices/live-updates';
import { AccessCodeDialog } from './AccessCodeDialog';
import { useTheme } from '@/shared/theme';

export function AppLayout() {
  useInvoiceLiveUpdates();
  const { theme, toggle } = useTheme();
  const search: { chat?: boolean } = useSearch({ strict: false });
  const navigate = useNavigate();
  const chatOpen = !!search.chat;
  const setChatOpen = (open: boolean) =>
    navigate({ to: '/', search: (s) => ({ ...s, chat: open || undefined }), replace: true });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-white">
              <FileText className="size-5" />
            </div>
            <div>
              <p className="text-base font-semibold leading-tight text-dark dark:text-white">Invoice Inbox</p>
              <p className="text-xs text-muted-foreground">Upload · extract · ask</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
                  {theme === 'dark' ? <Sun /> : <Moon />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle theme</TooltipContent>
            </Tooltip>
            <Button
              variant={chatOpen ? 'default' : 'lightprimary'}
              onClick={() => setChatOpen(!chatOpen)}
              aria-pressed={chatOpen}
            >
              <Sparkles />
              Assistant
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 sm:px-6">
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
        <AssistantPanel open={chatOpen} onOpenChange={setChatOpen} />
      </div>

      <AccessCodeDialog />
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
