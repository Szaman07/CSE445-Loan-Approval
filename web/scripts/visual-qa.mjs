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
  await desktop.getByRole('button', { name: /How does credit score/ }).click()
  await desktop.getByRole('heading', { name: 'Credit Score distribution' }).waitFor()
  await desktop.getByRole('button', { name: 'Simulator', exact: true }).click()
  await desktop.getByLabel('Credit score').fill('350')
  await desktop.getByRole('button', { name: 'Compare scenario' }).click()
  await desktop.getByText('Score movement').waitFor()
  await desktop.getByLabel('Credit score').fill('360')
  await desktop.getByText(/Inputs changed/).waitFor()
  await desktop.getByRole('button', { name: /Reset both/ }).click()
  if (await desktop.locator('.score-card').count()) throw new Error('Reset left a previous result visible')
  await desktop.goto(`${baseUrl}model`, { waitUntil: 'networkidle' })
  await desktop.getByRole('heading', { name: /How well does this model/ }).waitFor()

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true })
  observe(mobile)
  await mobile.goto(baseUrl, { waitUntil: 'networkidle' })
  await mobile.getByRole('button', { name: 'Open navigation' }).click()
  await mobile.keyboard.press('Escape')
  await mobile.getByRole('dialog', { name: 'Navigation' }).waitFor({ state: 'detached' })
  const sizes = await mobile.evaluate(() => ({ inner: window.innerWidth, body: document.body.scrollWidth, document: document.documentElement.scrollWidth }))
  await mobile.screenshot({ path: path.join(outputDir, 'overview-mobile.png'), fullPage: true })
  if (sizes.body > sizes.inner || sizes.document > sizes.inner) throw new Error(`Mobile overflow: ${JSON.stringify(sizes)}`)
  if (errors.length) throw new Error(errors.join('; '))
  const report = { baseUrl, mobile: sizes, runtimeErrors: errors }
  await fs.writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
