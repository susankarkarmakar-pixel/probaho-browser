const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const STORE_VERSION = 1;
const MAX_MANIFEST_BYTES = 256 * 1024;
const ALLOWED_PERMISSIONS = new Set([
  'activeTab',
  'bookmarks',
  'clipboardRead',
  'clipboardWrite',
  'cookies',
  'downloads',
  'history',
  'notifications',
  'storage',
  'tabs'
]);

function normalizeString(value, maxLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
    ? value.trim()
    : null;
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('Extension manifest must be an object');
  }
  const name = normalizeString(manifest.name, 128);
  const version = normalizeString(manifest.version, 64);
  if (!name || !version) throw new Error('Extension manifest requires name and version');
  if (manifest.manifest_version !== 2 && manifest.manifest_version !== 3) {
    throw new Error('Only Manifest V2 and V3 extensions are supported');
  }

  const permissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  if (permissions.some(permission => typeof permission !== 'string' || !ALLOWED_PERMISSIONS.has(permission))) {
    throw new Error('Extension requests an unsupported permission');
  }
  const hostPermissions = Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [];
  if (hostPermissions.some(value => typeof value !== 'string' || (!value.startsWith('http://') && !value.startsWith('https://') && value !== '<all_urls>'))) {
    throw new Error('Extension contains an invalid host permission');
  }

  return {
    name,
    version,
    manifestVersion: manifest.manifest_version,
    permissions,
    hostPermissions,
    description: normalizeString(manifest.description || '', 512) || ''
  };
}

function inspectExtension(extensionPath) {
  if (typeof extensionPath !== 'string' || !path.isAbsolute(extensionPath)) {
    throw new Error('Extension path must be absolute');
  }
  const resolvedPath = fs.realpathSync(extensionPath);
  if (!fs.statSync(resolvedPath).isDirectory()) throw new Error('Extension path must be a directory');
  const manifestPath = path.join(resolvedPath, 'manifest.json');
  const stats = fs.statSync(manifestPath);
  if (stats.size > MAX_MANIFEST_BYTES) throw new Error('Extension manifest is too large');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return { path: resolvedPath, ...validateManifest(manifest) };
}

class ExtensionManager {
  constructor() {
    this.storePath = path.join(app.getPath('userData'), 'extensions.json');
    this.records = this.loadRecords();
    this.loaded = new Map();
  }

  loadRecords() {
    try {
      if (!fs.existsSync(this.storePath)) return [];
      const parsed = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
      if (!parsed || parsed.version !== STORE_VERSION || !Array.isArray(parsed.extensions)) return [];
      return parsed.extensions.filter(item => typeof item.path === 'string' && typeof item.enabled === 'boolean');
    } catch (error) {
      console.error('Error reading extensions file:', error);
      return [];
    }
  }

  saveRecords() {
    const tempPath = `${this.storePath}.tmp`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify({ version: STORE_VERSION, extensions: this.records }, null, 2), {
        encoding: 'utf8',
        mode: 0o600
      });
      fs.renameSync(tempPath, this.storePath);
    } catch (error) {
      fs.rmSync(tempPath, { force: true });
      console.error('Error writing extensions file:', error);
    }
  }

  list() {
    return this.records.map(record => ({ ...record, loaded: this.loaded.has(record.id) }));
  }

  async load(session, extensionPath, persist = true) {
    const metadata = inspectExtension(extensionPath);
    const extension = await session.loadExtension(metadata.path, { allowFileAccess: false });
    const record = {
      id: extension.id,
      path: metadata.path,
      name: metadata.name,
      version: metadata.version,
      manifestVersion: metadata.manifestVersion,
      permissions: metadata.permissions,
      hostPermissions: metadata.hostPermissions,
      description: metadata.description,
      enabled: true
    };
    this.loaded.set(record.id, extension);
    this.records = this.records.filter(item => item.id !== record.id);
    this.records.push(record);
    if (persist) this.saveRecords();
    return record;
  }

  async restore(session) {
    for (const record of [...this.records]) {
      if (!record.enabled) continue;
      try {
        await this.load(session, record.path, false);
      } catch (error) {
        console.error(`Unable to restore extension ${record.name || record.path}:`, error.message);
        record.enabled = false;
      }
    }
    this.saveRecords();
  }

  async setEnabled(session, id, enabled) {
    if (typeof id !== 'string' || typeof enabled !== 'boolean') return null;
    const record = this.records.find(item => item.id === id);
    if (!record) return null;
    if (enabled && !this.loaded.has(id)) {
      await this.load(session, record.path, false);
    } else if (!enabled && this.loaded.has(id)) {
      session.removeExtension(id);
      this.loaded.delete(id);
    }
    record.enabled = enabled;
    this.saveRecords();
    return { ...record, loaded: this.loaded.has(id) };
  }

  async remove(session, id) {
    if (typeof id !== 'string') return false;
    const extension = this.loaded.get(id);
    if (extension) {
      session.removeExtension(id);
      this.loaded.delete(id);
    }
    const before = this.records.length;
    this.records = this.records.filter(record => record.id !== id);
    if (this.records.length !== before) this.saveRecords();
    return this.records.length !== before;
  }
}

module.exports = { ALLOWED_PERMISSIONS, validateManifest, inspectExtension, ExtensionManager };
