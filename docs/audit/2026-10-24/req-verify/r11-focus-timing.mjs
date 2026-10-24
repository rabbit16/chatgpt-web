// 聚焦时序复核：点击后按 0/100/300/800/1500ms 多次读数，判断是否只是 transition
const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')

const read = () =>
  page.evaluate(() => {
    const el = document.querySelector('input[aria-label="搜索模型"]')
    const wrap = el.closest('.ant-input-affix-wrapper')
    const cs = getComputedStyle(wrap)
    return {
      focused: document.activeElement === el,
      border: cs.borderColor,
      shadow: cs.boxShadow,
      transition: cs.transitionProperty + ' ' + cs.transitionDuration
    }
  })

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(800)

const out = { before: await read() }
await page.click('input[aria-label="搜索模型"]')
for (const ms of [0, 100, 300, 800, 1500]) {
  if (ms) await page.waitForTimeout(ms)
  out[`click+${ms}ms`] = await read()
}

// 键盘 Tab 进入
await page.evaluate(() => document.querySelector('input[aria-label="搜索模型"]').blur())
await page.waitForTimeout(300)
await page.focus('input[aria-label="搜索模型"]')
await page.waitForTimeout(450)
out.afterProgrammaticFocus = await read()

console.log(JSON.stringify(out, null, 1))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: [] })
