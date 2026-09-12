/**
 * Supabase PostgREST pagination and chunking helpers.
 *
 * PostgREST enforces a max-rows limit (1000 rows by default) on unpaged queries,
 * and URLs fail with HTTP 414 / 500 when .in(...) has more than a few hundred IDs.
 * These helpers guarantee complete, untruncated results regardless of dataset size.
 */

/**
 * Fetches all rows matching a query using page-by-page range queries.
 *
 * @param {Function} createQuery - A function returning a fresh Supabase query builder.
 * @param {number} pageSize - Number of rows to fetch per page (default: 1000).
 * @returns {Promise<Array>} Complete concatenated list of matching rows.
 */
export async function fetchAllPaginated(createQuery, pageSize = 1000) {
  let allRows = [];
  let from = 0;
  while (true) {
    const { data, error } = await createQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}

/**
 * Splits an array of IDs into manageable chunks and executes queries per chunk,
 * avoiding query string overflow and server timeouts.
 *
 * @param {Array<string>} ids - Array of entity IDs (e.g. registration or student UUIDs).
 * @param {number} chunkSize - Number of IDs per query chunk (default: 200).
 * @param {Function} fetchChunk - Async callback receiving chunk array and returning rows.
 * @returns {Promise<Array>} Combined results from all chunks.
 */
export async function chunkedFetch(ids, chunkSize = 200, fetchChunk) {
  const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
  if (uniqueIds.length === 0) return [];
  const size = chunkSize || 200;
  let results = [];
  for (let i = 0; i < uniqueIds.length; i += size) {
    const chunk = uniqueIds.slice(i, i + size);
    const rows = await fetchChunk(chunk);
    if (rows && rows.length > 0) {
      results = results.concat(rows);
    }
  }
  return results;
}
