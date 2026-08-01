const { app } = require('electron');
const path = require('path');
const fs = require('fs');

class PasswordsStore {
  constructor() {
    this.path = path.join(app.getPath('userData'), 'passwords.json');
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.path)) {
        return JSON.parse(fs.readFileSync(this.path, 'utf8'));
      }
    } catch (error) {
      console.error('Error reading passwords file:', error);
    }
    return {};
  }

  saveData() {
    try {
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error writing passwords file:', error);
    }
  }

  getPassword(origin) {
    return this.data[origin] || null;
  }

  setPassword(origin, credentials) {
    this.data[origin] = credentials;
    this.saveData();
  }
}

module.exports = new PasswordsStore();
