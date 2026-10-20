import { useSyncExternalStore } from 'react';

const KEY = 'invoice-inbox.access-code';
let required = false;
const listeners = new Set<() => void>();

const emit = () => {
  for (const l of listeners) l();
};

export const getAccessCode = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const setAccessCode = (code: string) => {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    // private mode: the code then lives only for this page load
  }
  required = false;
  emit();
};

/** Called by the API layer on 401: the demo is protected and our code is missing or wrong. */
export const markAccessCodeRequired = () => {
  if (required) return;
  required = true;
  emit();
};

export class AccessCodeRequiredError extends Error {
  constructor() {
    super('Access code required');
  }
}

export const useAccessCodeRequired = (): boolean => {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => required,
  );
};
