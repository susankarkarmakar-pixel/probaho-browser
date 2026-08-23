const test = require('node:test');
const assert = require('node:assert/strict');
const { getOrigin, matchTracker, normalizeExceptions } = require('../electron/tracker-protection');

test('extracts only http and https origins', () => {
  assert.equal(getOrigin('https://example.com/path'), 'https://example.com');
  assert.equal(getOrigin('file:///tmp/page.html'), null);
  assert.equal(getOrigin('not a url'), null);
});

test('matches tracker domains and subdomains', () => {
  assert.deepEqual(matchTracker('https://www.google-analytics.com/collect', 'https://example.com'), {
    category: 'analytics',
    domain: 'google-analytics.com',
  });
  assert.deepEqual(matchTracker('https://ads.doubleclick.net/pagead', 'https://example.com'), {
    category: 'advertising',
    domain: 'doubleclick.net',
  });
});

test('does not block lookalike domains or same-origin requests', () => {
  assert.equal(matchTracker('https://notgoogle-analytics.com/collect', 'https://example.com'), null);
  assert.equal(matchTracker('https://google-analytics.com/collect', 'https://google-analytics.com'), null);
});

test('applies path-specific social tracking rules', () => {
  assert.equal(matchTracker('https://facebook.com/home', 'https://example.com'), null);
  assert.deepEqual(matchTracker('https://facebook.com/tr?id=1', 'https://example.com'), {
    category: 'social',
    domain: 'facebook.com',
  });
});

test('respects exact origin exceptions', () => {
  const exceptions = normalizeExceptions(['https://example.com/path', 'file:///tmp/ignored']);
  assert.equal(matchTracker('https://google-analytics.com/collect', 'https://example.com', exceptions), null);
  assert.notEqual(matchTracker('https://google-analytics.com/collect', 'https://other.example.com', exceptions), null);
});
