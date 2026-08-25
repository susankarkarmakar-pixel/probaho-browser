const test = require('node:test');
const assert = require('node:assert/strict');
const { createCertificateErrorBroker } = require('../electron/certificate-error-broker');

function createWindow(id, { destroyed = false, send = () => {} } = {}) {
  return {
    isDestroyed: () => destroyed,
    webContents: { id, send }
  };
}

test('presents certificate metadata and resolves an explicit proceed decision once', () => {
  const sent = [];
  const decisions = [];
  const broker = createCertificateErrorBroker({
    requestIdFactory: () => 'request-1',
    timeoutMs: 1000
  });
  const ownerWindow = createWindow(101, { send: (...args) => sent.push(args) });

  const requestId = broker.request({
    ownerWindow,
    url: 'https://expired.example.test/',
    error: 'net::ERR_CERT_DATE_INVALID',
    certificate: {
      subjectName: '*.example.test',
      issuerName: 'Test CA',
      validStart: 1,
      validExpiry: 2
    },
    callback: (allow) => decisions.push(allow)
  });

  assert.equal(requestId, 'request-1');
  assert.equal(broker.size(), 1);
  assert.deepEqual(sent, [[
    'certificate-error',
    {
      requestId: 'request-1',
      url: 'https://expired.example.test/',
      error: 'net::ERR_CERT_DATE_INVALID',
      subjectName: '*.example.test',
      issuerName: 'Test CA',
      validStart: 1,
      validExpiry: 2
    }
  ]]);
  assert.deepEqual(decisions, []);

  assert.equal(broker.resolve('request-1', 101, true), true);
  assert.deepEqual(decisions, [true]);
  assert.equal(broker.size(), 0);
  assert.equal(broker.resolve('request-1', 101, false), false);
  assert.deepEqual(decisions, [true]);
});

test('rejects a certificate decision from a different window sender', () => {
  const decisions = [];
  const broker = createCertificateErrorBroker({
    requestIdFactory: () => 'request-2',
    timeoutMs: 1000
  });
  broker.request({
    ownerWindow: createWindow(202),
    url: 'https://mismatch.example.test/',
    callback: (allow) => decisions.push(allow)
  });

  assert.equal(broker.resolve('request-2', 999, true), false);
  assert.deepEqual(decisions, []);
  assert.equal(broker.size(), 1);
  assert.equal(broker.resolve('request-2', 202, false), true);
  assert.deepEqual(decisions, [false]);
});

test('automatically denies an unanswered certificate prompt after the timeout', async () => {
  const decisions = [];
  const broker = createCertificateErrorBroker({
    requestIdFactory: () => 'request-timeout',
    timeoutMs: 10
  });
  broker.request({
    ownerWindow: createWindow(303),
    url: 'https://timeout.example.test/',
    callback: (allow) => decisions.push(allow)
  });

  await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual(decisions, [false]);
  assert.equal(broker.size(), 0);
});

test('denies immediately when the owner window is destroyed or warning delivery fails', () => {
  const destroyedDecisions = [];
  const destroyedBroker = createCertificateErrorBroker({ requestIdFactory: () => 'request-destroyed' });
  assert.equal(destroyedBroker.request({
    ownerWindow: createWindow(404, { destroyed: true }),
    url: 'https://destroyed.example.test/',
    callback: (allow) => destroyedDecisions.push(allow)
  }), null);
  assert.deepEqual(destroyedDecisions, [false]);
  assert.equal(destroyedBroker.size(), 0);

  const failedDeliveryDecisions = [];
  const failedDeliveryBroker = createCertificateErrorBroker({ requestIdFactory: () => 'request-send-failed' });
  assert.equal(failedDeliveryBroker.request({
    ownerWindow: createWindow(505, { send: () => { throw new Error('window closed'); } }),
    url: 'https://send-failed.example.test/',
    callback: (allow) => failedDeliveryDecisions.push(allow)
  }), null);
  assert.deepEqual(failedDeliveryDecisions, [false]);
  assert.equal(failedDeliveryBroker.size(), 0);
});

test('cancels only prompts belonging to a closed window', () => {
  const decisions = [];
  let nextId = 0;
  const broker = createCertificateErrorBroker({
    requestIdFactory: () => `request-${++nextId}`,
    timeoutMs: 1000
  });
  broker.request({ ownerWindow: createWindow(606), url: 'https://one.example.test/', callback: allow => decisions.push(['one', allow]) });
  broker.request({ ownerWindow: createWindow(606), url: 'https://two.example.test/', callback: allow => decisions.push(['two', allow]) });
  broker.request({ ownerWindow: createWindow(707), url: 'https://other.example.test/', callback: allow => decisions.push(['other', allow]) });

  assert.equal(broker.cancelForSender(606), 2);
  assert.deepEqual(decisions, [['one', false], ['two', false]]);
  assert.equal(broker.size(), 1);
  assert.equal(broker.resolve('request-3', 707, true), true);
  assert.deepEqual(decisions, [['one', false], ['two', false], ['other', true]]);
  assert.equal(broker.size(), 0);
});
