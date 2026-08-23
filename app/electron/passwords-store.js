const { app, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

const STORE_VERSION = 1;

class PasswordsStore {
  constructor() {
    const userDataPath = app.getPath('userData');
    this.encryptedPath = path.join(userDataPath, 'passwords.enc');
    this.legacyPath = path.join(userDataPath, 'passwords.json');
    this.data = {};
    this.initialized = false;
  }

  ensureEncryptionAvailable() {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS-backed credential encryption is unavailable');
    }
  }

  sanitizeData(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).flatMap(([origin, credentials]) => {
        if (!/^https:\/\/[^\s]+$/i.test(origin)) return [];
        if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) return [];
        const username = typeof credentials.username === 'string' ? credentials.username : '';
        const password = typeof credentials.password === 'string' ? credentials.password : '';
        if (!password) return [];
        return [[origin, { username, password }]];
      })
    );
  }

  readEncryptedData() {
    if (!fs.existsSync(this.encryptedPath)) return {};

    const stored = JSON.parse(fs.readFileSync(this.encryptedPath, 'utf8'));
    if (stored?.version !== STORE_VERSION || typeof stored.data !== 'string') {
      throw new Error('Unsupported encrypted credential store format');
    }

    const decrypted = safeStorage.decryptString(Buffer.from(stored.data, 'base64'));
    return this.sanitizeData(JSON.parse(decrypted));
  }

  readLegacyData() {
    if (!fs.existsSync(this.legacyPath)) return null;
    return this.sanitizeData(JSON.parse(fs.readFileSync(this.legacyPath, 'utf8')));
  }

  initialize() {
    if (this.initialized) return;
    this.ensureEncryptionAvailable();

    try {
      if (fs.existsSync(this.encryptedPath)) {
        this.data = this.readEncryptedData();
      } else {
        const legacyData = this.readLegacyData();
        if (legacyData !== null) {
          this.data = legacyData;
          this.saveData();
          fs.rmSync(this.legacyPath, { force: true });
        }
      }
      this.initialized = true;
    } catch (error) {
      console.error('Error reading encrypted passwords:', error);
      throw new Error('Unable to read encrypted credentials');
    }
  }

  saveData() {
    this.ensureEncryptionAvailable();
    const tempPath = `${this.encryptedPath}.tmp`;
    const encrypted = safeStorage.encryptString(JSON.stringify(this.data));
    const payload = JSON.stringify({
      version: STORE_VERSION,
      data: encrypted.toString('base64')
    });

    try {
      fs.writeFileSync(tempPath, payload, { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(tempPath, this.encryptedPath);
    } catch (error) {
      fs.rmSync(tempPath, { force: true });
      console.error('Error writing encrypted passwords:', error);
      throw new Error('Unable to save encrypted credentials');
    }
  }

  getPassword(origin) {
    this.initialize();
    return this.data[origin] || null;
  }

  getAllPasswords() {
    this.initialize();
    return this.data;
  }

  setPassword(origin, credentials) {
    this.initialize();
    const sanitized = this.sanitizeData({ [origin]: credentials });
    if (!sanitized[origin]) throw new Error('Invalid credential record');
    this.data[origin] = sanitized[origin];
    this.saveData();
  }

  deletePassword(origin) {
    this.initialize();
    if (this.data[origin]) {
      delete this.data[origin];
      this.saveData();
    }
  }
}

module.exports = new PasswordsStore();
