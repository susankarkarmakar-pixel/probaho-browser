const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

function inspectNavigationUrl(rawUrl) {
  if (rawUrl === 'about:blank') {
    return { allowed: true, reason: 'blank' };
  }

  if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl.length > 8192) {
    return { allowed: false, reason: 'invalid-url' };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: 'invalid-url' };
  }

  if (parsedUrl.protocol === 'view-source:') {
    const sourceUrl = rawUrl.slice('view-source:'.length);
    const sourceDecision = inspectNavigationUrl(sourceUrl);
    return sourceDecision.allowed
      ? { allowed: true, reason: 'view-source' }
      : { allowed: false, reason: 'view-source-target-not-allowed' };
  }

  if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
    return { allowed: false, reason: 'scheme-not-allowed' };
  }

  if (!parsedUrl.hostname || parsedUrl.username || parsedUrl.password) {
    return { allowed: false, reason: 'malformed-origin' };
  }

  return { allowed: true, reason: 'web' };
}

function isAllowedNavigationUrl(rawUrl) {
  return inspectNavigationUrl(rawUrl).allowed;
}

function isSafeBrowsingCandidate(rawUrl) {
  const decision = inspectNavigationUrl(rawUrl);
  if (!decision.allowed) return false;
  return decision.reason === 'web' || decision.reason === 'view-source';
}

module.exports = {
  ALLOWED_PROTOCOLS,
  inspectNavigationUrl,
  isAllowedNavigationUrl,
  isSafeBrowsingCandidate
};
