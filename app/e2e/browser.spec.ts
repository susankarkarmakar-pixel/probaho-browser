import { test, expect } from './fixtures';

const tabCount = (page: import('@playwright/test').Page) => page.locator('.tab').count();

test.describe('browser shell', () => {
  test('starts with a usable new-tab shell', async ({ appPage }) => {
    await expect(appPage.getByTestId('browser-shell')).toBeVisible();
    await expect(appPage.getByTestId('address-input')).toHaveValue('');
    await expect(appPage.getByTestId('new-tab-button')).toBeVisible();
    await expect(appPage.locator('.tab')).toHaveCount(1);
    await expect(appPage.locator('.new-tab-page')).toBeVisible();
  });

  test('renders an accessible toolbar and address bar', async ({ appPage }) => {
    await expect(appPage.getByTestId('browser-toolbar')).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Go back' })).toBeDisabled();
    await expect(appPage.getByRole('button', { name: 'Go forward' })).toBeDisabled();
    await expect(appPage.getByRole('button', { name: 'Reload page' })).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Go home' })).toBeVisible();
    await appPage.getByTestId('address-input').focus();
    await expect(appPage.getByTestId('address-input')).toBeFocused();
  });

  test('supports keyboard tab navigation and semantic tab controls', async ({ appPage }) => {
    const firstTab = appPage.getByRole('tab').first();
    await expect(firstTab).toHaveAttribute('aria-selected', 'true');
    await firstTab.focus();
    await expect(firstTab).toBeFocused();
    await appPage.getByTestId('new-tab-button').click();
    const newestTab = appPage.getByRole('tab').last();
    await newestTab.focus();
    await newestTab.press('Enter');
    await expect(newestTab).toHaveAttribute('aria-selected', 'true');
    await expect(newestTab.getByRole('button', { name: /Close/ })).toBeVisible();
  });

  test('creates and closes tabs', async ({ appPage }) => {
    await appPage.getByTestId('new-tab-button').click();
    await expect.poll(() => tabCount(appPage)).toBe(2);

    const newestTab = appPage.locator('.tab').last();
    await expect(newestTab).toBeVisible();
    await newestTab.locator('.tab-close').click();
    await expect.poll(() => tabCount(appPage)).toBe(1);
    await expect(appPage.locator('.new-tab-page')).toBeVisible();
  });

  test('lazy-loads inactive tabs and wakes a suspended tab', async ({ appPage }) => {
    const addressInput = appPage.getByTestId('address-input');
    await addressInput.fill('https://example.com');
    await addressInput.press('Enter');
    await expect(addressInput).toHaveValue(/^https:\/\/example\.com\/?$/);
    await expect(appPage.locator('webview')).toHaveCount(1);

    await appPage.getByTestId('new-tab-button').click();
    await expect(appPage.locator('webview')).toHaveCount(0);
    const loadedTab = appPage.locator('.tab').first();
    await loadedTab.click({ button: 'right' });
    await appPage.getByText('Suspend Tab', { exact: true }).click();
    await expect(loadedTab).toHaveClass(/suspended/);

    await loadedTab.click();
    await expect(loadedTab).not.toHaveClass(/suspended/);
    await expect(appPage.locator('webview')).toHaveCount(1);
  });

  test('normalizes an address-bar submission', async ({ appPage }) => {
    const addressInput = appPage.getByTestId('address-input');
    await addressInput.fill('example.com');
    await addressInput.press('Enter');
    await expect(addressInput).toHaveValue(/^https:\/\/example\.com\/?$/);
  });

  test('opens the settings dialog from the application menu', async ({ appPage }) => {
    await appPage.getByTestId('menu-button').click();
    await appPage.getByText('Settings', { exact: true }).click();
    await expect(appPage.getByTestId('settings-modal')).toBeVisible();
    await expect(appPage.getByTestId('settings-modal')).toHaveClass(/settings-modal/);
    await expect(appPage.getByText('Homepage URL', { exact: true })).toBeVisible();
    await expect(appPage.getByTestId('performance-settings')).toBeVisible();
    await expect(appPage.getByTestId('lazy-tabs-toggle')).toBeChecked();
    await expect(appPage.getByTestId('suspend-tabs-toggle')).toBeChecked();
  });

  test('shows tracker protection controls for the current site', async ({ appPage }) => {
    const addressInput = appPage.getByTestId('address-input');
    await addressInput.fill('https://example.com');
    await addressInput.press('Enter');
    await expect(addressInput).toHaveValue(/^https:\/\/example\.com\/?$/);

    await appPage.getByTestId('shields-button').click();
    await expect(appPage.getByTestId('shields-popup')).toBeVisible();
    await expect(appPage.getByTestId('global-shields-toggle')).toBeChecked();
    const siteToggle = appPage.getByTestId('site-shields-toggle');
    await expect(siteToggle).toBeEnabled();
    await expect(siteToggle).not.toBeChecked();
    await siteToggle.check();
    await expect(siteToggle).toBeChecked();
    await siteToggle.uncheck();
    await expect(siteToggle).not.toBeChecked();
  });

  test('registers and toggles a declarative HTTPS plugin', async ({ appPage }) => {
    await appPage.getByTestId('menu-button').click();
    await appPage.getByText('Settings', { exact: true }).click();
    await expect(appPage.getByTestId('extensions-section')).toBeVisible();
    await appPage.getByTestId('plugin-json-input').fill(JSON.stringify({
      id: 'test.panel',
      type: 'panel',
      name: 'Test Panel',
      url: 'https://example.com/panel'
    }));
    await appPage.getByTestId('register-plugin-button').click();
    const plugin = appPage.getByTestId('plugin-test.panel');
    await expect(plugin).toBeVisible();
    await plugin.getByText('Disable', { exact: true }).click();
    await expect(plugin.getByText('Enable', { exact: true })).toBeVisible();
  });

  test('shows the per-site permission manager for a fresh profile', async ({ appPage }) => {
    await appPage.getByTestId('menu-button').click();
    await appPage.getByText('Settings', { exact: true }).click();
    const permissionsSection = appPage.getByTestId('permissions-section');
    await expect(permissionsSection).toBeVisible();
    await expect(permissionsSection.getByText('No permissions saved.', { exact: true })).toBeVisible();
  });

  test('opens an isolated private window without normal tabs or history', async ({ appPage, electronApp }) => {
    await appPage.getByTestId('new-tab-button').click();
    await expect(appPage.locator('.tab')).toHaveCount(2);
    await appPage.evaluate(() => {
      localStorage.setItem('history', JSON.stringify([
        { title: 'Normal profile history', url: 'https://example.com', time: new Date().toISOString() },
      ]));
    });

    await appPage.getByTestId('menu-button').click();
    const privateWindowPromise = electronApp.waitForEvent('window');
    await appPage.getByTestId('new-private-window').click();
    const privatePage = await privateWindowPromise;
    await privatePage.waitForLoadState('domcontentloaded');
    await expect(privatePage.getByTestId('browser-shell')).toBeVisible();
    await expect(privatePage.locator('.tab.private')).toHaveCount(1);
    await expect(privatePage.locator('.tab:not(.private)')).toHaveCount(0);

    await privatePage.getByTestId('menu-button').click();
    await privatePage.getByText('History', { exact: true }).click();
    await expect(privatePage.locator('.bookmarks-panel .no-bookmarks').filter({ hasText: 'No history yet' })).toBeVisible();
  });
});
