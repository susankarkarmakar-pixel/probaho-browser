import { _electron as electron } from 'playwright';

const startedAt = performance.now();
const electronApp = await electron.launch({ args: ['.'] });
try {
  const page = await electronApp.firstWindow();
  await page.waitForSelector('[data-testid="browser-shell"]', { timeout: 15000 });
  const shellReadyMs = Math.round(performance.now() - startedAt);
  const snapshot = await page.evaluate(() => window.electronAPI.getPerformanceSnapshot?.());
  const report = {
    capturedAt: new Date().toISOString(),
    shellReadyMs,
    windowCount: snapshot?.windowCount ?? null,
    rendererCount: snapshot?.rendererCount ?? null,
    metrics: snapshot?.metrics ?? []
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  await electronApp.close();
}
