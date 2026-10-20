export function AssistantPanel({ open }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!open) return null;
  return <aside className="hidden w-[400px] shrink-0 xl:block" />;
}
