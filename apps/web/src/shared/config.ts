/**
 * Empty API_URL = same origin (Vite dev proxy locally, nginx in Docker).
 * The hosted demo serves the web app from a different domain and sets VITE_API_URL.
 */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export const WS_URL = API_URL
  ? `${API_URL.replace(/^http/, 'ws')}/graphql`
  : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/graphql`;

/**
 * Must not exceed the backend's MAX_UPLOAD_BYTES — it rejects anything larger, and the
 * dropzone should say no first rather than spend the upload. Overridable for a deployment
 * that raised the server limit.
 */
export const MAX_UPLOAD_BYTES = Number(import.meta.env.VITE_MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);

export const MAX_UPLOAD_LABEL = `${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`;
