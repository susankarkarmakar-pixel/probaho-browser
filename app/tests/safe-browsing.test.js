const test = require('node:test');
const assert = require('node:assert/strict');
const { lookupUrl, clearCache, isHttpUrl, SAFE_BROWSING_ENDPOINT } = require('../electron/safe-browsing');

test.afterEach(() => clearCache());

test('recognizes only HTTP and HTTPS reputation candidates', () => {
  assert.equal(isHttpUrl('https://example.com'), true);
  assert.equal(isHttpUrl('http://example.com'), true);
  assert.equal(isHttpUrl('file:///tmp/example'), false);
  assert.equal(isHttpUrl('javascript:alert(1)'), false);
});

test('returns a transparent unavailable result when no API key is configured', async () => {
  const result = await lookupUrl('https://example.com', { apiKey: '' });
  assert.deepEqual(result, { status: 'unavailable', safe: null, matches: [], reason: 'api-key-not-configured' });
});

test('parses threat matches and caches safe results', async () => {
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls += 1;
    assert.equal(url, `${SAFE_BROWSING_ENDPOINT}?key=test-key`);
    assert.equal(options.method, 'POST');
    const request = JSON.parse(options.body);
    assert.equal(request.client.clientId, 'probaho-browser');
    assert.equal(request.threatInfo.threatEntries[0].url, 'https://unsafe.example.test');
    return {
      ok: true,
      json: async () => ({ matches: [{ threatType: 'MALWARE', platformType: 'ANY_PLATFORM' }] })
    };
  };

  const first = await lookupUrl('https://unsafe.example.test', { apiKey: 'test-key', fetchImpl });
  const second = await lookupUrl('https://unsafe.example.test', { apiKey: 'test-key', fetchImpl });
  assert.deepEqual(first, { status: 'unsafe', safe: false, matches: [{ threatType: 'MALWARE', platformType: 'ANY_PLATFORM' }] });
  assert.deepEqual(second, first);
  assert.equal(calls, 1);
});

test('returns an error state for provider failures without blocking the caller', async () => {
  const result = await lookupUrl('https://example.com', {
    apiKey: 'test-key',
    fetchImpl: async () => ({ ok: false, status: 503 })
  });
  assert.deepEqual(result, { status: 'error', safe: null, matches: [], reason: 'http-503' });
});
