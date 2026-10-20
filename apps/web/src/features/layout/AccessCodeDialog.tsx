import { useState, type SubmitEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { setAccessCode, useAccessCodeRequired } from '@/shared/access-code';

/** Shown when the API answers 401: the public demo is protected by a shared access code. */
export const AccessCodeDialog = () => {
  const required = useAccessCodeRequired();
  const [code, setCode] = useState('');

  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!code.trim()) return;
    setAccessCode(code.trim());
    // Simplest correct way to restart every query and the WebSocket with the new code.
    window.location.reload();
  };

  return (
    <Dialog open={required}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" /> Access code
          </DialogTitle>
          <DialogDescription>
            This demo is protected. Enter the access code you received with the link.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex gap-2">
          {/* The dialog is blocking and has one field: focusing it is the expected behaviour. */}
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <Input autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Access code" />
          <Button type="submit">Continue</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
