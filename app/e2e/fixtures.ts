import { test as base, expect, type Page } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type BrowserFixtures = {
  electronApp: ElectronApplication;
  appPage: Page;
};

export const test = base.extend<BrowserFixtures>({
  electronApp: async ({}, use) => {
    const appDir = path.resolve(__dirname, '..');
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'probaho-e2e-'));
    const electronApp = await electron.launch({
      executablePath: process.env.ELECTRON_PATH,
      args: [
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        `--user-data-dir=${userDataDir}`,
        appDir,
      ],
      env: {
        ...process.env,
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
    });

    await use(electronApp);
    await electronApp.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },

  appPage: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('browser-shell')).toBeVisible();
    await use(page);
  },
});

export { expect };
