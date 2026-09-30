import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'

const edgePath = process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const baseUrl = process.env.CREDITWISE_WEB_URL ?? 'http://127.0.0.1:5173/'
const outputDir = path.resolve('../artifacts/visual-qa')
await fs.mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ executablePath: edgePath, headless: true })
const errors = []
const observe = (page) => {
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`) })
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
}
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  observe(desktop)
  await desktop.goto(baseUrl, { waitUntil: 'networkidle' })
  await desktop.getByText('Live model').waitFor()
  await desktop.screenshot({ path: path.join(outputDir, 'overview-desktop.png'), fullPage: true })
  await desktop.getByRole('button', { name: 'Explore', exact: true }).click()
  await desktop.getByText('Record 0001', { exact: true }).waitFor()
  await desktop.getByRole('button', { name: 'Next rows' }).click()
  await desktop.getByText('Record 0016', { exact: true }).waitFor()
  await desktop.getByRole('button', { name: 'Relationships', exact: true }).click()
  await desktop.getByLabel('Y axis').selectOption('Credit_Score')
  await desktop.waitForFunction(() => document.querySelector('.relationship-stats')?.textContent.includes('Pearson correlation1'))
  await desktop.getByRole('button', { name: /How does credit score/ }).click()
  await desktop.getByRole('heading', { name: 'Credit Score distribution' }).waitFor()
  await desktop.getByLabel('Field', { exact: false }).selectOption('Property_Area')
  await desktop.getByRole('heading', { name: 'Credit Score distribution' }).waitFor()
  if (await desktop.getByRole('alert').count()) throw new Error('Incomplete cohort produced an error')
  await desktop.locator('.cohort-control').getByLabel('Value', { exact: false }).selectOption('Urban')
  await desktop.getByRole('heading', { name: 'Property Area = Urban' }).waitFor()
  await desktop.getByRole('heading', { name: 'Credit Score distribution' }).waitFor()
  await desktop.getByRole('button', { name: 'Simulator', exact: true }).click()
  await desktop.getByLabel('Credit score').fill('350')
  await desktop.getByRole('button', { name: 'Compare scenario' }).click()
  await desktop.getByText('Score movement (percentage points)', { exact: true }).waitFor()
  await desktop.getByLabel('Credit score').fill('360')
  await desktop.getByText(/Inputs changed/).waitFor()
  await desktop.getByRole('button', { name: /Reset both/ }).click()
  if (await desktop.locator('.score-card').count()) throw new Error('Reset left a previous result visible')
  await desktop.goto(`${baseUrl}model`, { waitUntil: 'networkidle' })
  await desktop.getByRole('heading', { name: /Model evaluation/ }).waitFor()
  if (!await desktop.locator('h1').evaluate((heading) => document.activeElement === heading)) throw new Error('Direct route did not focus its heading')

  await desktop.goto(`${baseUrl}simulator`, { waitUntil: 'networkidle' })
  let releaseCompare
  const compareStarted = new Promise((resolve) => { releaseCompare = resolve })
  let finishCompare
  const comparisonDelay = new Promise((resolve) => { finishCompare = resolve })
  await desktop.route('**/api/compare', async (route) => {
    releaseCompare()
    await comparisonDelay
    try { await route.continue() } catch { /* Reset may abort the browser request. */ }
  })
  await desktop.getByRole('button', { name: 'Compare scenario' }).click()
  await compareStarted
  await desktop.getByRole('button', { name: /Reset both/ }).click()
  finishCompare()
  await desktop.getByRole('heading', { name: 'No comparison yet' }).waitFor()
  await desktop.unroute('**/api/compare')

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
  observe(mobile)
  await mobile.goto(baseUrl, { waitUntil: 'networkidle' })
  await mobile.getByRole('button', { name: 'Open navigation' }).click()
  const dialog = mobile.getByRole('dialog', { name: 'Navigation' })
  await mobile.keyboard.press('Shift+Tab')
  if (!await dialog.getByRole('button', { name: 'About', exact: true }).evaluate((button) => document.activeElement === button)) throw new Error('Menu focus escaped the dialog')
  await mobile.keyboard.press('Tab')
  if (!await dialog.getByRole('button', { name: 'Close navigation' }).evaluate((button) => document.activeElement === button)) throw new Error('Menu focus did not wrap')
  await mobile.keyboard.press('Escape')
  await mobile.getByRole('dialog', { name: 'Navigation' }).waitFor({ state: 'detached' })
  await mobile.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Open navigation')
  const sizes = await mobile.evaluate(() => ({ inner: window.innerWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth }))
  await mobile.screenshot({ path: path.join(outputDir, 'overview-mobile.png'), fullPage: true })
  if (sizes.body > sizes.inner || sizes.document > sizes.inner) throw new Error(`Mobile overflow: ${JSON.stringify(sizes)}`)
  if (errors.length) throw new Error(errors.join('; '))
  const report = { baseUrl, mobile: sizes, runtimeErrors: errors }
  await fs.writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
