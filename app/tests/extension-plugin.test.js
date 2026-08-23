const test = require('node:test');
const assert = require('node:assert/strict');
const { validateManifest } = require('../electron/extension-manager');
const { validatePlugin, PluginManager } = require('../electron/plugin-manager');

test('accepts a constrained extension manifest', () => {
  assert.deepEqual(validateManifest({
    manifest_version: 3,
    name: 'Example Extension',
    version: '1.0.0',
    permissions: ['storage', 'tabs'],
    host_permissions: ['https://example.com/*'],
    description: 'A safe extension'
  }), {
    manifestVersion: 3,
    name: 'Example Extension',
    version: '1.0.0',
    permissions: ['storage', 'tabs'],
    hostPermissions: ['https://example.com/*'],
    description: 'A safe extension'
  });
});

test('rejects unsupported extension permissions and host schemes', () => {
  assert.throws(() => validateManifest({ manifest_version: 3, name: 'Bad', version: '1', permissions: ['nativeMessaging'] }));
  assert.throws(() => validateManifest({ manifest_version: 3, name: 'Bad', version: '1', host_permissions: ['file:///tmp/*'] }));
});

test('accepts only declarative HTTPS plugins', () => {
  assert.deepEqual(validatePlugin({ id: 'notes.panel', type: 'panel', name: 'Notes', url: 'https://example.com/notes' }), {
    id: 'notes.panel',
    type: 'panel',
    name: 'Notes',
    url: 'https://example.com/notes',
    action: null,
    enabled: true
  });
  assert.throws(() => validatePlugin({ id: 'unsafe', type: 'panel', name: 'Unsafe', url: 'javascript:alert(1)' }));
  assert.throws(() => validatePlugin({ id: 'unsafe', type: 'panel', name: 'Unsafe', url: 'http://example.com' }));
});

test('registers, toggles, and removes plugins', () => {
  const manager = new PluginManager();
  manager.register({ id: 'search.command', type: 'command', name: 'Search', url: 'https://example.com/search', action: 'search' });
  assert.equal(manager.list()[0].enabled, true);
  assert.equal(manager.setEnabled('search.command', false).enabled, false);
  assert.equal(manager.remove('search.command'), true);
  assert.deepEqual(manager.list(), []);
});
