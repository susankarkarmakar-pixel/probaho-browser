const TRACKER_RULES = [
  { domain: 'doubleclick.net', category: 'advertising' },
  { domain: 'googlesyndication.com', category: 'advertising' },
  { domain: 'google-analytics.com', category: 'analytics' },
  { domain: 'adservice.google.com', category: 'advertising' },
  { domain: 'analytics.twitter.com', category: 'analytics' },
  { domain: 'scorecardresearch.com', category: 'analytics' },
  { domain: 'quantserve.com', category: 'analytics' },
  { domain: 'zedo.com', category: 'advertising' },
  { domain: 'advertising.com', category: 'advertising' },
  { domain: 'facebook.com', pathPrefix: '/tr', category: 'social' },
];

function getOrigin(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isDomainOrSubdomain(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function matchTracker(rawUrl, pageOrigin, exceptions = new Set()) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (pageOrigin && exceptions.has(pageOrigin)) return null;
  if (pageOrigin && url.origin === pageOrigin) return null;

  for (const rule of TRACKER_RULES) {
    if (!isDomainOrSubdomain(url.hostname, rule.domain)) continue;
    if (rule.pathPrefix && !url.pathname.startsWith(rule.pathPrefix)) continue;
    return { category: rule.category, domain: rule.domain };
  }
  return null;
}

function normalizeExceptions(values) {
  if (!Array.isArray(values)) return new Set();
  return new Set(values.map(getOrigin).filter(Boolean));
}

module.exports = { TRACKER_RULES, getOrigin, matchTracker, normalizeExceptions };
