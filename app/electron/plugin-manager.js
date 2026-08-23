const fs = require('fs');

const PLUGIN_TYPES = new Set(['command', 'panel']);
const MAX_PLUGINS = 50;
const STORE_VERSION = 1;

function validatePlugin(plugin) {
  if (!plugin || typeof plugin !== 'object' || Array.isArray(plugin)) {
    throw new Error('Plugin definition must be an object');
  }
  if (typeof plugin.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{1,63}$/.test(plugin.id)) {
    throw new Error('Plugin id is invalid');
  }
  if (typeof plugin.type !== 'string' || !PLUGIN_TYPES.has(plugin.type)) {
    throw new Error('Plugin type is invalid');
  }
  if (typeof plugin.name !== 'string' || plugin.name.trim().length === 0 || plugin.name.length > 128) {
    throw new Error('Plugin name is invalid');
  }
  if (typeof plugin.url !== 'string') throw new Error('Plugin URL is required');
  const url = new URL(plugin.url);
  if (url.protocol !== 'https:') throw new Error('Plugin URL must use HTTPS');
  if (url.username || url.password) throw new Error('Plugin URL cannot contain credentials');
  if (plugin.type === 'command' && typeof plugin.action !== 'string') {
    throw new Error('Command plugin action is required');
  }
  if (typeof plugin.action === 'string' && !/^[a-z][a-z0-9._:-]{0,63}$/.test(plugin.action)) {
    throw new Error('Plugin action is invalid');
  }
  return {
    id: plugin.id,
    type: plugin.type,
    name: plugin.name.trim(),
    url: url.toString(),
    action: plugin.action || null,
    enabled: plugin.enabled !== false
  };
}

class PluginManager {
  constructor(storePath = null) {
    this.storePath = storePath;
    this.plugins = new Map();
    this.load();
  }

  load() {
    if (!this.storePath) return;
    try {
      if (!fs.existsSync(this.storePath)) return;
      const parsed = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
      if (!parsed || parsed.version !== STORE_VERSION || !Array.isArray(parsed.plugins)) return;
      for (const plugin of parsed.plugins) {
        try { this.plugins.set(plugin.id, validatePlugin(plugin)); } catch { /* ignore invalid persisted plugin */ }
      }
    } catch (error) {
      console.error('Error reading plugins file:', error);
    }
  }

  save() {
    if (!this.storePath) return;
    const tempPath = `${this.storePath}.tmp`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify({ version: STORE_VERSION, plugins: this.list() }, null, 2), {
        encoding: 'utf8',
        mode: 0o600
      });
      fs.renameSync(tempPath, this.storePath);
    } catch (error) {
      fs.rmSync(tempPath, { force: true });
      console.error('Error writing plugins file:', error);
    }
  }

  register(plugin) {
    if (this.plugins.size >= MAX_PLUGINS && !this.plugins.has(plugin.id)) {
      throw new Error('Plugin limit reached');
    }
    const normalized = validatePlugin(plugin);
    this.plugins.set(normalized.id, normalized);
    this.save();
    return { ...normalized };
  }

  remove(id) {
    const removed = this.plugins.delete(id);
    if (removed) this.save();
    return removed;
  }

  setEnabled(id, enabled) {
    const plugin = this.plugins.get(id);
    if (!plugin || typeof enabled !== 'boolean') return null;
    plugin.enabled = enabled;
    this.save();
    return { ...plugin };
  }

  list() {
    return [...this.plugins.values()].map(plugin => ({ ...plugin }));
  }
}

module.exports = { PLUGIN_TYPES, validatePlugin, PluginManager };
