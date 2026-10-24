const OUT = '/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/req-verify'
const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(1000)
await page.fill('input[aria-label="搜索模型"]', 'gpt')
await page.waitForTimeout(500)
const rect = await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 100)
  const tabs = [...card.querySelectorAll('button')].find(b => b.textContent.trim() === '全部')
  const tb = tabs.parentElement.getBoundingClientRect()
  const meta = card.querySelector('[class*="searchMeta"]').getBoundingClientRect()
  return { tabTop: tb.top, tabBottom: tb.bottom, tabLeft: tb.left, tabRight: tb.right, metaTop: meta.top, metaBottom: meta.bottom, metaLeft: meta.left }
})
await page.waitForTimeout(400)
const r2 = await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  const tabs = [...card.querySelectorAll('button')].find(b => b.textContent.trim() === '全部')
  const tb = tabs.parentElement.getBoundingClientRect()
  const meta = card.querySelector('[class*="searchMeta"]').getBoundingClientRect()
  return { tabTop: tb.top, tabBottom: tb.bottom, tabLeft: tb.left, tabRight: tb.right, metaTop: meta.top, metaBottom: meta.bottom, metaLeft: meta.left }
})
await page.screenshot({ path: `${OUT}/r20-full-1440-gpt-2x.png` })
console.log(JSON.stringify({ dprViewport: await page.evaluate(() => ({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio })), before: rect, after: r2 }))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: [] })
