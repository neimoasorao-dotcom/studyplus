// Sites continues to use its existing authenticated D1 endpoint. The Pages
// build aliases only this module to a browser-local implementation.
export const storageMode: 'server' | 'browser' = 'server';
export function stateRequest(init?: RequestInit): Promise<Response> {
  return fetch('/api/state', init);
}
