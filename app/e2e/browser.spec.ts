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

  test('shows a recoverable error state for a failed navigation', async ({ appPage }) => {
    const addressInput = appPage.getByTestId('address-input');
    await addressInput.fill('file:///tmp/probaho-does-not-exist.html');
    await addressInput.press('Enter');
    const errorSurface = appPage.locator('[data-testid^="load-error-"]').first();
    await expect(errorSurface).toBeVisible({ timeout: 15000 });
    await expect(errorSurface.locator('h2')).toHaveText(/couldn.t load this page/);
    await expect(errorSurface.locator('.load-error-primary')).toBeVisible();
    await errorSurface.locator('.load-error-secondary').click();
    await expect(appPage.locator('.new-tab-page')).toBeVisible();
  });

  test('normalizes an address-bar submission', async ({ appPage }) => {
    const addressInput = appPage.getByTestId('address-input');
    await addressInput.fill('example.com');
    await addressInput.press('Enter');
    await expect(addressInput).toHaveValue(/^https:\/\/example\.com\/?$/);
  });

  test('opens the settings dialog from the application menu', async ({ appPage }) => {
    await appPage.getByTestId('menu-button').click();
    await appPage.locator('.menu-panel').getByText('Settings', { exact: true }).click();
    await expect(appPage.getByTestId('settings-modal')).toBeVisible();
    await expect(appPage.getByTestId('settings-modal')).toHaveClass(/settings-modal/);
    await expect(appPage.getByTestId('settings-title')).toHaveText('Settings');
    await expect(appPage.getByText('Private by default', { exact: true })).toBeVisible();
    await expect(appPage.getByText('Homepage URL', { exact: true })).toBeVisible();
    await expect(appPage.getByTestId('performance-settings')).toBeVisible();
    await expect(appPage.getByTestId('lazy-tabs-toggle')).toBeChecked();
    await expect(appPage.getByTestId('suspend-tabs-toggle')).toBeChecked();
  });

  test('opens the premium Download Manager with search and filters', async ({ appPage }) => {
    await appPage.getByTestId('downloads-button').click();
    const manager = appPage.getByTestId('downloads-popout');
    await expect(manager).toBeVisible();
    await expect(manager.getByText('Downloads', { exact: true })).toBeVisible();
    await expect(manager.getByTestId('downloads-empty')).toBeVisible();
    await expect(manager.getByTestId('download-search')).toBeVisible();
    await expect(manager.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
    await manager.getByRole('tab', { name: 'Active' }).click();
    await expect(manager.getByRole('tab', { name: 'Active' })).toHaveAttribute('aria-selected', 'true');
    await expect(manager.getByTestId('downloads-empty')).toBeVisible();
    await manager.getByRole('button', { name: 'Close downloads' }).click();
    await expect(manager).not.toBeVisible();
  });

  test('searches and manages the redesigned history panel', async ({ appPage }) => {
    await appPage.getByTestId('menu-button').click();
    await appPage.locator('.menu-panel').getByText('History', { exact: true }).click();
    const panel = appPage.getByTestId('history-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByText('0 entries', { exact: true })).toBeVisible();
    await expect(panel.getByTestId('clear-history-button')).toBeDisabled();
    await panel.getByTestId('history-search').fill('missing-site');
    await expect(panel.getByText('No history yet', { exact: true })).toBeVisible();
  });

  test('renders the premium bookmark bar and tab context menu', async ({ appPage }) => {
    await appPage.evaluate(() => {
      const settings = JSON.parse(localStorage.getItem('probaho-settings') || '{}');
      localStorage.setItem('probaho-settings', JSON.stringify({ ...settings, showBookmarksBar: true }));
      localStorage.setItem('bookmarks', JSON.stringify([{ title: 'GitHub', url: 'https://github.com' }]));
    });
    await appPage.reload();
    await appPage.getByTestId('browser-shell').waitFor();
    await expect(appPage.getByTestId('bookmarks-bar')).toBeVisible();
    await expect(appPage.getByTestId('bookmark-bar-item')).toHaveAccessibleName('Open bookmark GitHub');

    await appPage.getByRole('tab').first().click({ button: 'right' });
    const contextMenu = appPage.locator('.tab-context-menu');
    await expect(contextMenu).toBeVisible();
    await expect(contextMenu.getByText('Tab actions', { exact: true })).toBeVisible();
    await expect(contextMenu.getByRole('menuitem').first()).toBeVisible();
  });

  test('opens the privacy Shields status panel', async ({ appPage }) => {
    const addressInput = appPage.getByTestId('address-input');
    await addressInput.fill('https://example.com');
    await addressInput.press('Enter');
    await expect(addressInput).toHaveValue(/^https:\/\/example\.com\/?$/);

    await appPage.getByTestId('shields-button').click();
    const popup = appPage.getByTestId('shields-popup');
    await expect(popup).toBeVisible();
    await expect(popup.getByTestId('shields-status')).toContainText('You are protected');
    await expect(popup.getByText('No blocked requests recorded yet.', { exact: true })).toBeVisible();
    await expect(popup.getByTestId('global-shields-toggle')).toBeChecked();
    await popup.getByTestId('global-shields-toggle').uncheck();
    await expect(popup.getByTestId('shields-status')).toContainText('Shields are off');
    await popup.getByTestId('global-shields-toggle').check();
    await popup.getByRole('button', { name: 'Close Shields' }).click();
    await expect(popup).not.toBeVisible();
  });

  test('switches panels from the right-side utility rail', async ({ appPage }) => {
    const rail = appPage.getByTestId('utility-rail');
    await expect(rail).toBeVisible();
    await expect(rail.getByTestId('utility-history')).toBeVisible();
    await rail.getByTestId('utility-downloads').click();
    await expect(appPage.getByTestId('downloads-popout')).toBeVisible();
    await rail.getByTestId('utility-settings').click();
    await expect(appPage.getByTestId('settings-modal')).toBeVisible();
    await expect(appPage.getByTestId('downloads-popout')).not.toBeVisible();
    await appPage.getByRole('button', { name: 'Close settings' }).click();
    await expect(appPage.getByTestId('settings-modal')).not.toBeVisible();
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
    await appPage.locator('.menu-panel').getByText('Settings', { exact: true }).click();
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
    await appPage.locator('.menu-panel').getByText('Settings', { exact: true }).click();
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
    await privatePage.locator('.menu-panel').getByText('History', { exact: true }).click();
    await expect(privatePage.locator('.bookmarks-panel .no-bookmarks').filter({ hasText: 'No history yet' })).toBeVisible();
  });
});
