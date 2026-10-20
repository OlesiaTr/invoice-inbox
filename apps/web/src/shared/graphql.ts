import type { TypedDocumentString } from '@/gql/graphql';
import { AccessCodeRequiredError, getAccessCode, markAccessCodeRequired } from './access-code';
import { API_URL } from './config';

export const authHeaders = (): Record<string, string> => {
  const code = getAccessCode();
  return code ? { 'x-access-code': code } : {};
};

/** Minimal typed GraphQL client: codegen gives the types, fetch does the rest. */
export const gql = async <TResult, TVariables>(
  document: TypedDocumentString<TResult, TVariables>,
  ...[variables]: TVariables extends Record<string, never> ? [] : [TVariables]
): Promise<TResult> => {
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ query: document.toString(), variables }),
  });
  if (res.status === 401) {
    markAccessCodeRequired();
    throw new AccessCodeRequiredError();
  }
  // A proxy error page (e.g. 502 while the API restarts) is HTML, not JSON.
  if (!res.headers.get('content-type')?.includes('json')) {
    throw new Error(`The server is unavailable right now (HTTP ${res.status}). Try again in a moment.`);
  }
  const body = (await res.json()) as { data?: TResult; errors?: { message: string }[] };
  if (body.errors?.length) {
    const message = body.errors[0].message;
    if (/access code/i.test(message)) {
      markAccessCodeRequired();
      throw new AccessCodeRequiredError();
    }
    throw new Error(message);
  }
  if (!body.data) throw new Error(`Request failed (${res.status})`);
  return body.data;
};
