const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await page.goto('http://127.0.0.1:5173/admin/feedback', { timeout: 30000 })
await page.waitForTimeout(2200)
const out = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button.ant-btn-link')]
  const pick = (t) => btns.find((b) => b.textContent.trim() === t)
  const cs = (b) => (b ? { color: getComputedStyle(b).color, danger: b.className.includes('dangerous') } : null)
  return {
    theme: document.documentElement.getAttribute('data-theme'),
    hide: cs(pick('隐藏')), restore: cs(pick('恢复')), del: cs(pick('删除')), reply: cs(pick('回复')),
    order: [...document.querySelectorAll('.ant-btn-link')].slice(0, 5).map((b) => b.textContent.trim())
  }
})
console.log(JSON.stringify(out, null, 1))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: [] })
