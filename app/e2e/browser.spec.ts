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

  test('recovers from malformed persisted profile data', async ({ appPage }) => {
    await appPage.evaluate(() => {
      localStorage.setItem('workspaces', '{broken');
      localStorage.setItem('tabGroups', '[]oops');
      localStorage.setItem('collapsedTabGroups', 'not-an-object');
      localStorage.setItem('bookmarks', '{broken');
      localStorage.setItem('readingList', 'null');
      localStorage.setItem('history', '[');
    });
    await appPage.reload();
    await expect(appPage.getByTestId('browser-shell')).toBeVisible();
    await expect(appPage.getByTestId('address-input')).toBeVisible();
  });

  test('keeps the core toolbar discoverable and accessible', async ({ appPage }) => {
    const toolbar = appPage.getByTestId('browser-toolbar');
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByTestId('address-input')).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Go back' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Go forward' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Go home' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Open split view' })).toHaveAttribute('aria-pressed', 'false');
    await expect(toolbar.getByRole('button', { name: 'Picture in picture' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Add to reading list' })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Share current page' })).toBeVisible();
    await expect(toolbar.getByTestId('shields-button')).toBeVisible();
    await expect(toolbar.getByTestId('downloads-button')).toBeVisible();
    await expect(toolbar.getByTestId('menu-button')).toBeVisible();
    const geometry = await toolbar.evaluate((element) => {
      const address = element.querySelector('[data-testid="address-bar"]')?.getBoundingClientRect();
      const navigation = element.querySelector('.nav-buttons')?.getBoundingClientRect();
      return { addressWidth: address?.width || 0, navigationWidth: navigation?.width || 0 };
    });
    expect(geometry.addressWidth).toBeGreaterThan(300);
    expect(geometry.addressWidth).toBeGreaterThan(geometry.navigationWidth);
  });

  test('shows accessible minimize maximize and close window controls', async ({ appPage }) => {
    const controls = appPage.locator('.window-controls');
    await expect(controls).toBeVisible();
    await expect(appPage.getByTestId('minimize-window-button')).toHaveAccessibleName('Minimize window');
    await expect(appPage.getByTestId('maximize-window-button')).toHaveAccessibleName('Maximize or restore window');
    await expect(appPage.getByTestId('close-window-button')).toHaveAccessibleName('Close window');
    await expect(appPage.getByTestId('minimize-window-button')).toHaveAttribute('title', 'Minimize window');
    await expect(appPage.getByTestId('maximize-window-button')).toHaveAttribute('title', 'Maximize or restore window');
    await expect(appPage.getByTestId('close-window-button')).toHaveAttribute('title', 'Close window');
    await expect(controls).toHaveCSS('position', 'absolute');
    await expect(controls).toHaveCSS('right', '0px');
    await expect(controls).toHaveCSS('top', '0px');
  });

  test('opens annotation tools for a web page', async ({ appPage }) => {
    const addressInput = appPage.getByTestId('address-input');
    await addressInput.fill('https://example.com');
    await addressInput.press('Enter');
    const annotationButton = appPage.getByTestId('annotation-button');
    await expect(annotationButton).toBeEnabled();
    await annotationButton.click();
    await expect(appPage.getByTestId('annotation-layer')).toBeVisible();
    await expect(appPage.getByTestId('annotation-toolbar')).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Highlight' })).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Draw mark' })).toBeVisible();
    await expect(appPage.getByRole('button', { name: 'Add text note' })).toBeVisible();
    await annotationButton.click();
    await expect(appPage.getByTestId('annotation-layer')).not.toBeVisible();
  });

  test('opens the Chrome-style Extensions manager from the toolbar', async ({ appPage }) => {
    const extensionsButton = appPage.getByTestId('extensions-button');
    await expect(extensionsButton).toBeVisible();
    await expect(extensionsButton).toHaveAttribute('aria-expanded', 'false');
    await extensionsButton.click();
    const popout = appPage.getByTestId('extensions-popout');
    await expect(popout).toBeVisible();
    await expect(popout.getByText('Extensions', { exact: true })).toBeVisible();
    await expect(popout.getByTestId('extensions-empty')).toContainText('No extensions yet');
    await expect(popout.getByRole('button', { name: 'Add unpacked' })).toBeVisible();
    await expect(popout.getByRole('button', { name: 'Manage extensions' })).toBeVisible();
    await popout.getByRole('button', { name: 'Manage extensions' }).click();
    await expect(appPage.getByTestId('settings-modal')).toBeVisible();
    await expect(appPage.getByTestId('extensions-section')).toBeVisible();
    await appPage.getByRole('button', { name: 'Close settings' }).click();
    await expect(appPage.getByTestId('settings-modal')).not.toBeVisible();
  });

  test('switches dark and light themes instantly from the toolbar', async ({ appPage }) => {
    const themeButton = appPage.getByTestId('theme-toggle-button');
    const body = appPage.locator('body');
    await expect(body).toHaveClass(/theme-light/);
    await expect(themeButton).toHaveAttribute('aria-label', 'Switch to dark theme');
    await themeButton.click();
    await expect(body).not.toHaveClass(/theme-light/);
    await expect(themeButton).toHaveAttribute('aria-label', 'Switch to light theme');
    await themeButton.click();
    await expect(body).toHaveClass(/theme-light/);
  });

  test('exposes a sanitized performance snapshot', async ({ appPage }) => {
    const snapshot = await appPage.evaluate(() => window.electronAPI.getPerformanceSnapshot?.());
    expect(snapshot).toBeTruthy();
    expect(snapshot?.windowCount).toBeGreaterThanOrEqual(1);
    expect(snapshot?.rendererCount).toBeGreaterThanOrEqual(0);
    expect(snapshot?.metrics.every(metric => typeof metric.pid === 'number' && typeof metric.cpuPercent === 'number')).toBe(true);
  });

  test('renders the premium home dashboard and quick actions', async ({ appPage }) => {
    const home = appPage.getByTestId('new-tab-page');
    await expect(home).toBeVisible();
    await expect(home.getByTestId('ntp-content')).toBeVisible();
    await expect(home.getByTestId('ntp-privacy-card')).toContainText('Shields active');
    await expect(home.getByTestId('ntp-search-input')).toBeVisible();
    await expect(home.getByTestId('ntp-quick-actions')).toBeVisible();
    await expect(home.getByTestId('ntp-top-sites-empty')).toContainText('Your shortcuts will appear here');
    await expect(home.getByTestId('ntp-bookmarks-preview')).toContainText('Bookmarks');
    await home.getByTestId('ntp-downloads-action').click();
    await expect(appPage.getByTestId('downloads-popout')).toBeVisible();
    await appPage.getByRole('button', { name: 'Close downloads' }).click();
    await expect(appPage.getByTestId('downloads-popout')).not.toBeVisible();
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

  test('supports common web URL forms and search fallback', async ({ appPage }) => {
    const addressInput = appPage.getByTestId('address-input');
    await addressInput.fill('localhost:3000/dashboard');
    await addressInput.press('Enter');
    await expect(addressInput).toHaveValue('https://localhost:3000/dashboard');

    await addressInput.fill('//example.com/docs?q=probaho#intro');
    await addressInput.press('Enter');
    await expect(addressInput).toHaveValue('https://example.com/docs?q=probaho#intro');

    await addressInput.fill('probaho browser privacy');
    await addressInput.press('Enter');
    await expect(addressInput).toHaveValue('https://www.google.com/search?q=probaho%20browser%20privacy');
  });

  test('shows local omnibox suggestions and blocks unsafe schemes', async ({ appPage }) => {
    await appPage.evaluate(() => {
      localStorage.setItem('bookmarks', JSON.stringify([{ title: 'Probaho GitHub', url: 'https://github.com/probaho' }]));
    });
    await appPage.reload();
    await appPage.getByTestId('browser-shell').waitFor();
    const addressInput = appPage.getByTestId('address-input');
    await addressInput.fill('github');
    const suggestions = appPage.getByTestId('omnibox-suggestions');
    await expect(suggestions).toBeVisible();
    await expect(suggestions.getByRole('option').first()).toContainText('Probaho GitHub');
    await addressInput.press('ArrowDown');
    await expect(suggestions.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');

    await addressInput.fill('javascript:alert(1)');
    await expect(appPage.getByTestId('omnibox-feedback')).toContainText('javascript: links are blocked');
    await addressInput.press('Enter');
    await expect(addressInput).toHaveValue('javascript:alert(1)');
  });

  test('renders collapsible Edge-style vertical tabs and tab groups', async ({ appPage }) => {
    const savedSettings = await appPage.evaluate(() => JSON.parse(localStorage.getItem('probaho-settings') || '{}'));
    await appPage.evaluate(({ savedSettings }) => {
      localStorage.setItem('probaho-settings', JSON.stringify({ ...savedSettings, verticalTabs: true }));
      localStorage.setItem('tabGroups', JSON.stringify([{ id: 'work', name: 'Work', color: '#2563eb' }]));
      localStorage.setItem('savedTabs', JSON.stringify([
        { id: 'tab-work-1', url: 'probaho://newtab', title: 'Work dashboard', workspaceId: 'default', groupId: 'work', isPrivate: false },
        { id: 'tab-work-2', url: 'probaho://newtab', title: 'Work notes', workspaceId: 'default', groupId: 'work', isPrivate: false },
        { id: 'tab-personal', url: 'probaho://newtab', title: 'Personal', workspaceId: 'default', isPrivate: false }
      ]));
      localStorage.setItem('activeTabId', 'tab-work-1');
    }, { savedSettings });
    await appPage.reload();
    await expect(appPage.getByTestId('browser-shell')).toBeVisible();

    const sidebar = appPage.getByTestId('vertical-tabs-sidebar');
    await expect(sidebar).toBeVisible();
    const groupToggle = sidebar.getByRole('button', { name: 'Collapse Work tab group' });
    await expect(groupToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(sidebar.locator('.vertical-tab-group-count')).toHaveText('2');
    await expect(sidebar.getByTestId('tab-tab-work-1')).toBeVisible();
    await expect(sidebar.getByTestId('tab-tab-work-2')).toBeVisible();

    await groupToggle.click();
    await expect(sidebar.getByRole('button', { name: 'Expand Work tab group' })).toHaveAttribute('aria-expanded', 'false');
    await expect(sidebar.getByTestId('tab-tab-work-2')).not.toBeVisible();
    await sidebar.getByRole('button', { name: 'Expand Work tab group' }).click();
    await expect(sidebar.getByTestId('tab-tab-work-2')).toBeVisible();

    await sidebar.getByTestId('tab-tab-personal').click({ button: 'right' });
    await expect(appPage.getByRole('menu', { name: 'Tab actions' }).getByText('Work', { exact: true })).toBeVisible();
  });

  test('supports keyboard navigation in the Chrome-style overflow menu', async ({ appPage }) => {
    const menuButton = appPage.getByTestId('menu-button');
    await menuButton.click();
    const menu = appPage.getByTestId('overflow-menu');
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('role', 'menu');
    const items = menu.locator('.menu-item');
    await expect(items.first()).toHaveAttribute('role', 'menuitem');
    await expect(items.first()).toBeFocused();
    await menu.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await menu.press('End');
    await expect(items.last()).toBeFocused();
    await menu.press('Home');
    await expect(items.first()).toBeFocused();
    await menu.press('Escape');
    await expect(menu).not.toBeVisible();
    await expect(menuButton).toBeFocused();
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
    await expect(appPage.getByTestId('updates-section')).toBeVisible();
    await expect(appPage.getByTestId('update-status')).toContainText(/Automatic checks on|Up to date/);
    await appPage.getByTestId('check-updates-button').click();
    await expect(appPage.getByTestId('update-status')).toHaveText('Up to date');
    await expect(appPage.getByTestId('privacy-services-settings')).toBeVisible();
    await expect(appPage.getByTestId('safe-browsing-toggle')).toBeChecked();
    await expect(appPage.getByTestId('doh-toggle')).toBeChecked();
    await expect(appPage.getByTestId('safe-browsing-config-note')).toBeVisible();
    await appPage.getByTestId('doh-toggle').uncheck();
    await expect(appPage.getByTestId('doh-toggle')).not.toBeChecked();
    await appPage.getByTestId('doh-toggle').check();
    await expect(appPage.getByTestId('doh-toggle')).toBeChecked();
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

  test('imports Chromium-style bookmarks from the first-run card', async ({ appPage }) => {
    const importCard = appPage.getByTestId('first-run-import-card');
    await expect(importCard).toBeVisible();
    await expect(importCard).toContainText('Chrome, Edge or Firefox');
    const importInput = appPage.getByTestId('first-run-import-input');
    await expect(importInput).toHaveAttribute('accept', '.html,.htm,.json');
    await importInput.setInputFiles({
      name: 'bookmarks.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><A HREF="https://example.com/">Example</A><DT><A HREF="https://developer.mozilla.org/">MDN</A></DL>')
    });
    await expect(appPage.getByTestId('import-status')).toContainText('Imported 2 bookmarks');
    await expect(appPage.getByTestId('first-run-import-card')).not.toBeVisible();
  });

  test('switches panels from the right-side utility rail', async ({ appPage }) => {
    const rail = appPage.getByTestId('utility-rail');
    await expect(rail).toBeVisible();
    await rail.hover();
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
