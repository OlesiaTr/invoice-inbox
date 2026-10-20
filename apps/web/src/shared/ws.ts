import { createClient, type Client } from 'graphql-ws';
import { getAccessCode } from './access-code';
import { WS_URL } from './config';

let client: Client | undefined;
const connectedListeners = new Set<(isReconnect: boolean) => void>();
let connectedOnce = false;

/** One WebSocket per tab; graphql-ws reconnects with backoff on its own. */
export function wsClient(): Client {
  client ??= createClient({
    url: WS_URL,
    connectionParams: () => ({ accessCode: getAccessCode() }),
    retryAttempts: Infinity,
    shouldRetry: () => true,
    on: {
      connected: () => {
        for (const l of connectedListeners) l(connectedOnce);
        connectedOnce = true;
      },
    },
  });
  return client;
}

/** `isReconnect` is true after a drop: events may have been missed, so callers resync. */
export function onWsConnected(listener: (isReconnect: boolean) => void): () => void {
  connectedListeners.add(listener);
  return () => connectedListeners.delete(listener);
}
