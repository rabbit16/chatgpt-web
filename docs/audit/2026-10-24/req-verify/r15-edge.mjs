// 边界：Claude 页签下搜索 -> 点 x 清空 -> 是否回到 Claude；以及 enterkeyhint/aria 属性核对
const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')

const snap = () =>
  page.evaluate(() => {
    const card = [...document.querySelectorAll('section')].find(
      (s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.trim().startsWith('完整价目')
    )
    const tabs = [...card.querySelectorAll('button')].filter((b) =>
      ['全部', 'OpenAI', 'Claude', 'Google', 'DeepSeek', '智谱', 'xAI', '其他'].includes(b.textContent.trim())
    )
    const rows = [...card.querySelectorAll('tr.ant-table-row')]
    const input = card.querySelector('input[aria-label="搜索模型"]')
    return {
      rows: rows.length,
      firstId: rows.length ? (rows[0].querySelector('[class*="modelCellId"]') || {}).textContent : null,
      activeTabs: tabs.filter((b) => /tabActive/.test(b.className)).map((b) => b.textContent.trim()),
      muted: tabs.filter((b) => b.dataset.muted !== undefined).length,
      value: input.value,
      attrs: {
        enterKeyHint: input.getAttribute('enterkeyhint'),
        inputMode: input.getAttribute('inputmode'),
        ariaLabel: input.getAttribute('aria-label'),
        autocomplete: input.getAttribute('autocomplete')
      }
    }
  })

const out = {}
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(900)

const clickTab = (n) =>
  page.evaluate((name) => {
    const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
    const b = [...card.querySelectorAll('button')].find((x) => x.textContent.trim() === name)
    if (b) b.click()
  }, n)

await clickTab('Claude')
await page.waitForTimeout(400)
out.claudeOnly = await snap()

await page.fill('input[aria-label="搜索模型"]', 'gpt')
await page.waitForTimeout(400)
out.claudeSearchGpt = await snap()

await page.click('.ant-input-clear-icon')
await page.waitForTimeout(500)
out.afterXClear = await snap()

console.log(JSON.stringify(out, null, 1))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: [] })
