// 复核 Esc：在输入框内按 Esc 是否清空（antd allowClear 默认无 Esc），并再验一次 1440 × 清除
const OUT = '/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/req-verify'
const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')

const state = () =>
  page.evaluate(() => {
    const card = [...document.querySelectorAll('section')].find(
      (s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.trim().startsWith('完整价目')
    )
    const input = card.querySelector('input[aria-label="搜索模型"]')
    const meta = card.querySelector('[class*="searchMeta"]')
    return {
      value: input.value,
      focused: document.activeElement === input,
      rows: card.querySelectorAll('tr.ant-table-row').length,
      meta: meta ? meta.textContent.replace(/\s+/g, ' ').trim().slice(0, 24) : null
    }
  })

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(800)

const out = {}
await page.fill('input[aria-label="搜索模型"]', 'gpt')
await page.waitForTimeout(350)
await page.focus('input[aria-label="搜索模型"]')
await page.waitForTimeout(200)
out.beforeEsc = await state()
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
out.afterEsc = await state()

// 再试 Esc 两次
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
out.afterEsc2 = await state()

// × 按钮清除（1440）
await page.fill('input[aria-label="搜索模型"]', 'claude')
await page.waitForTimeout(350)
out.beforeX = await state()
await page.click('.ant-input-clear-icon')
await page.waitForTimeout(500)
out.afterX = await state()
await page.screenshot({ path: `${OUT}/r13-1440-after-x-clear.png` })

// 清除后焦点是否回到输入框（规格 §3）
out.focusAfterX = await page.evaluate(() => document.activeElement === document.querySelector('input[aria-label="搜索模型"]'))

console.log(JSON.stringify(out, null, 1))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: [] })
