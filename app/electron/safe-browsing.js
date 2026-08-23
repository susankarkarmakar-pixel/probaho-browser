const SAFE_BROWSING_ENDPOINT = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

function isHttpUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function cacheKey(rawUrl) {
  try {
    return new URL(rawUrl).toString();
  } catch {
    return rawUrl;
  }
}

async function lookupUrl(rawUrl, options = {}) {
  const apiKey = options.apiKey || process.env.GOOGLE_SAFE_BROWSING_API_KEY || '';
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const cacheTtlMs = Number.isFinite(options.cacheTtlMs) ? options.cacheTtlMs : DEFAULT_CACHE_TTL_MS;

  if (!isHttpUrl(rawUrl)) return { status: 'skipped', safe: true, matches: [] };
  if (!apiKey) return { status: 'unavailable', safe: null, matches: [], reason: 'api-key-not-configured' };
  if (typeof fetchImpl !== 'function') return { status: 'unavailable', safe: null, matches: [], reason: 'fetch-unavailable' };

  const key = cacheKey(rawUrl);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  if (cached) cache.delete(key);

  const body = {
    client: { clientId: 'probaho-browser', clientVersion: '2.1.0' },
    threatInfo: {
      threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE'],
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: [{ url: rawUrl }]
    }
  };

  try {
    const response = await fetchImpl(`${SAFE_BROWSING_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return { status: 'error', safe: null, matches: [], reason: `http-${response.status}` };
    const payload = await response.json();
    const matches = Array.isArray(payload?.matches) ? payload.matches.map(match => ({
      threatType: match.threatType || 'UNKNOWN',
      platformType: match.platformType || 'ANY_PLATFORM'
    })) : [];
    const result = { status: matches.length > 0 ? 'unsafe' : 'safe', safe: matches.length === 0, matches };
    cache.set(key, { expiresAt: Date.now() + cacheTtlMs, result });
    return result;
  } catch (error) {
    return { status: 'error', safe: null, matches: [], reason: error?.name === 'TimeoutError' ? 'timeout' : 'network-error' };
  }
}

function clearCache() {
  cache.clear();
}

module.exports = {
  SAFE_BROWSING_ENDPOINT,
  lookupUrl,
  clearCache,
  isHttpUrl
};
