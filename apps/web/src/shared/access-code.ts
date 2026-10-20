import { useSyncExternalStore } from 'react';

const KEY = 'invoice-inbox.access-code';
let required = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getAccessCode(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setAccessCode(code: string) {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // private mode: the code then lives only for this page load
  }
  required = false;
  emit();
}

/** Called by the API layer on 401: the demo is protected and our code is missing or wrong. */
export function markAccessCodeRequired() {
  if (required) return;
  required = true;
  emit();
}

export class AccessCodeRequiredError extends Error {
  constructor() {
    super('Access code required');
  }
}

export function useAccessCodeRequired(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => required,
  );
}
