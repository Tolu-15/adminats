/** Refresh once for concurrent requests, and retry only after authentication fails. */
export function createAuthenticatedFetch({ auth, fetchImpl = (...args) => fetch(...args), onSessionExpired = () => {} }) {
  let refreshing = null;
  async function refresh() {
    if (!refreshing) refreshing = auth.refreshSession().finally(() => { refreshing = null; });
    const { data, error } = await refreshing;
    if (error || !data?.session?.access_token) {
      if (!error || [400, 401, 403].includes(error.status)) onSessionExpired();
      throw new Error('Your session could not be renewed. Please sign in again.');
    }
    return data.session.access_token;
  }
  return async function authenticatedFetch(url, options = {}) {
    const { data, error } = await auth.getSession();
    if (error || !data?.session?.access_token) {
      onSessionExpired();
      throw new Error('Your session has expired. Please sign in again.');
    }
    function send(token) {
      const headers = new Headers(options.headers);
      headers.set('Authorization', 'Bearer ' + token);
      return fetchImpl(url, { ...options, headers, cache: 'no-store' });
    }
    const response = await send(data.session.access_token);
    if (response.status !== 401) return response;
    // Another request may already have renewed this same stale access token.
    const { data: latest } = await auth.getSession();
    const token = latest?.session?.access_token && latest.session.access_token !== data.session.access_token
      ? latest.session.access_token : await refresh();
    const retry = await send(token);
    if (retry.status === 401) {
      onSessionExpired();
      throw new Error('Your session was rejected. Please sign in again. If this continues, check the server Supabase configuration.');
    }
    return retry;
  };
}
