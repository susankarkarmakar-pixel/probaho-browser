'use strict';

function createCertificateErrorBroker({
  requestIdFactory,
  timeoutMs = 45_000
} = {}) {
  if (typeof requestIdFactory !== 'function') {
    throw new TypeError('requestIdFactory must be a function');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new TypeError('timeoutMs must be a non-negative number');
  }

  const pending = new Map();

  const settle = (requestId, allow) => {
    const entry = pending.get(requestId);
    if (!entry) return false;
    pending.delete(requestId);
    clearTimeout(entry.timer);
    entry.callback(Boolean(allow));
    return true;
  };

  const request = ({ ownerWindow, url, error, certificate, callback }) => {
    if (!ownerWindow || ownerWindow.isDestroyed()) {
      callback(false);
      return null;
    }

    const requestId = requestIdFactory();
    const timer = setTimeout(() => settle(requestId, false), timeoutMs);
    timer.unref?.();
    pending.set(requestId, {
      callback,
      senderId: ownerWindow.webContents.id,
      timer
    });

    try {
      ownerWindow.webContents.send('certificate-error', {
        requestId,
        url,
        error: String(error || 'certificate-error'),
        subjectName: certificate?.subjectName || '',
        issuerName: certificate?.issuerName || '',
        validStart: certificate?.validStart || 0,
        validExpiry: certificate?.validExpiry || 0
      });
    } catch {
      settle(requestId, false);
      return null;
    }

    return requestId;
  };

  const resolve = (requestId, senderId, allow) => {
    const entry = pending.get(requestId);
    if (!entry || entry.senderId !== senderId) return false;
    return settle(requestId, allow);
  };

  const cancelForSender = (senderId) => {
    let cancelled = 0;
    for (const [requestId, entry] of pending) {
      if (entry.senderId === senderId && settle(requestId, false)) cancelled += 1;
    }
    return cancelled;
  };

  return {
    request,
    resolve,
    cancelForSender,
    size: () => pending.size
  };
}

module.exports = { createCertificateErrorBroker };
