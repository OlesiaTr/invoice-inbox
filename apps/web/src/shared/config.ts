/**
 * Empty API_URL = same origin (Vite dev proxy locally, nginx in Docker).
 * The hosted demo serves the web app from a different domain and sets VITE_API_URL.
 */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const WS_URL = API_URL
  ? `${API_URL.replace(/^http/, 'ws')}/graphql`
  : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/graphql`;
