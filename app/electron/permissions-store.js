const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const STORE_VERSION = 2;
const PERMISSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SUPPORTED_PERMISSIONS = new Set(['media', 'geolocation', 'notifications']);

class PermissionsStore {
  constructor() {
    this.path = path.join(app.getPath('userData'), 'permissions.json');
    this.data = this.loadData();
  }

  isValidOrigin(origin) {
    try {
      const parsed = new URL(origin);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  isSupportedPermission(permission) {
    return typeof permission === 'string' && SUPPORTED_PERMISSIONS.has(permission);
  }

  normalizeRecord(value) {
    if (typeof value === 'boolean') {
      const updatedAt = Date.now();
      return { allowed: value, updatedAt, expiresAt: updatedAt + PERMISSION_TTL_MS };
    }
    if (!value || typeof value !== 'object' || typeof value.allowed !== 'boolean') {
      return null;
    }

    const updatedAt = Number.isFinite(value.updatedAt) ? value.updatedAt : Date.now();
    const expiresAt = value.expiresAt === null
      ? null
      : (Number.isFinite(value.expiresAt) ? value.expiresAt : updatedAt + PERMISSION_TTL_MS);
    return { allowed: value.allowed, updatedAt, expiresAt };
  }

  normalizeData(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const source = value.version === STORE_VERSION && value.permissions ? value.permissions : value;
    const result = {};

    for (const [origin, permissions] of Object.entries(source)) {
      if (!this.isValidOrigin(origin) || !permissions || typeof permissions !== 'object') continue;
      for (const [permission, record] of Object.entries(permissions)) {
        if (!this.isSupportedPermission(permission)) continue;
        const normalized = this.normalizeRecord(record);
        if (normalized) {
          if (!result[origin]) result[origin] = {};
          result[origin][permission] = normalized;
        }
      }
    }
    return result;
  }

  loadData() {
    try {
      if (!fs.existsSync(this.path)) return {};
      return this.normalizeData(JSON.parse(fs.readFileSync(this.path, 'utf8')));
    } catch (error) {
      console.error('Error reading permissions file:', error);
      return {};
    }
  }

  saveData() {
    const tempPath = `${this.path}.tmp`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify({ version: STORE_VERSION, permissions: this.data }, null, 2), {
        encoding: 'utf8',
        mode: 0o600
      });
      fs.renameSync(tempPath, this.path);
    } catch (error) {
      fs.rmSync(tempPath, { force: true });
      console.error('Error writing permissions file:', error);
    }
  }

  getPermission(origin, permission) {
    if (!this.isValidOrigin(origin) || !this.isSupportedPermission(permission)) return null;
    const record = this.data[origin]?.[permission];
    if (!record) return null;
    if (record.expiresAt !== null && record.expiresAt <= Date.now()) {
      this.deletePermission(origin, permission);
      return null;
    }
    return record.allowed;
  }

  getAllPermissions() {
    let changed = false;
    const now = Date.now();
    for (const [origin, permissions] of Object.entries(this.data)) {
      for (const [permission, record] of Object.entries(permissions)) {
        if (record.expiresAt !== null && record.expiresAt <= now) {
          delete permissions[permission];
          changed = true;
        }
      }
      if (Object.keys(permissions).length === 0) {
        delete this.data[origin];
        changed = true;
      }
    }
    if (changed) this.saveData();
    return this.data;
  }

  setPermission(origin, permission, allowed, expiresAt = Date.now() + PERMISSION_TTL_MS) {
    if (!this.isValidOrigin(origin) || !this.isSupportedPermission(permission) || typeof allowed !== 'boolean') {
      throw new Error('Invalid permission record');
    }
    if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= Date.now())) {
      throw new Error('Invalid permission expiry');
    }
    if (!this.data[origin]) this.data[origin] = {};
    this.data[origin][permission] = { allowed, updatedAt: Date.now(), expiresAt };
    this.saveData();
  }

  deletePermission(origin, permission) {
    if (!this.isValidOrigin(origin) || !this.isSupportedPermission(permission)) return;
    if (this.data[origin]?.[permission]) {
      delete this.data[origin][permission];
      if (Object.keys(this.data[origin]).length === 0) delete this.data[origin];
      this.saveData();
    }
  }

  clear() {
    this.data = {};
    this.saveData();
  }
}

module.exports = new PermissionsStore();
