const test = require('node:test');
const assert = require('node:assert/strict');
const {
  inspectNavigationUrl,
  isAllowedNavigationUrl,
  isSafeBrowsingCandidate
} = require('../electron/navigation-policy');

test('allows ordinary HTTP and HTTPS navigation', () => {
  assert.equal(isAllowedNavigationUrl('https://example.com/path'), true);
  assert.equal(isAllowedNavigationUrl('http://localhost:3000'), true);
  assert.equal(isSafeBrowsingCandidate('https://example.com/path'), true);
});

test('allows view-source only for HTTP or HTTPS targets', () => {
  assert.deepEqual(inspectNavigationUrl('view-source:https://example.com'), { allowed: true, reason: 'view-source' });
  assert.equal(isAllowedNavigationUrl('view-source:javascript:alert(1)'), false);
  assert.equal(isAllowedNavigationUrl('view-source:file:///etc/passwd'), false);
});

test('rejects executable, local, malformed, and oversized URLs', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'chrome://settings',
    'https://user:pass@example.com',
    'not a url',
    'x'.repeat(8193)
  ]) {
    assert.equal(isAllowedNavigationUrl(url), false, `expected rejection for ${url.slice(0, 40)}`);
    assert.equal(isSafeBrowsingCandidate(url), false);
  }
});

test('permits about:blank only as an internal placeholder', () => {
  assert.deepEqual(inspectNavigationUrl('about:blank'), { allowed: true, reason: 'blank' });
  assert.equal(isSafeBrowsingCandidate('about:blank'), false);
});
