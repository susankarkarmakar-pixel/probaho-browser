const { app } = require('electron');
const path = require('path');
const fs = require('fs');

class PermissionsStore {
  constructor() {
    this.path = path.join(app.getPath('userData'), 'permissions.json');
    this.data = this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(this.path)) {
        return JSON.parse(fs.readFileSync(this.path, 'utf8'));
      }
    } catch (error) {
      console.error('Error reading permissions file:', error);
    }
    return {};
  }

  saveData() {
    try {
      fs.writeFileSync(this.path, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error writing permissions file:', error);
    }
  }

  getPermission(origin, permission) {
    if (this.data[origin] && this.data[origin][permission] !== undefined) {
      return this.data[origin][permission];
    }
    return null;
  }

  setPermission(origin, permission, allowed) {
    if (!this.data[origin]) {
      this.data[origin] = {};
    }
    this.data[origin][permission] = allowed;
    this.saveData();
  }
}

module.exports = new PermissionsStore();
