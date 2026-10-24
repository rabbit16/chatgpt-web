const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(900)
await page.fill('input[aria-label="搜索模型"]', 'gpt')
await page.waitForTimeout(400)
const out = await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  const R = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) } }
  const h2 = card.querySelector('h2')
  const head = card.querySelector('[class*="tableHead"]')
  const wrap = card.querySelector('input[aria-label="搜索模型"]').closest('.ant-input-affix-wrapper')
  const tabBox = card.querySelector('[class*="_tabs_"]') || [...card.querySelectorAll('button')].find(b=>b.textContent.trim()==='全部').parentElement
  const meta = card.querySelector('[class*="searchMeta"]')
  const prefix = wrap.querySelector('.ant-input-prefix')
  const clear = wrap.querySelector('.ant-input-clear-icon')
  const cs = getComputedStyle(wrap)
  return {
    card: R(card), h2: R(h2), head: R(head), searchWrap: R(wrap), prefix: prefix ? R(prefix) : null,
    tabBox: R(tabBox), meta: meta ? R(meta) : null, clear: clear ? R(clear) : null,
    headRightGap: Math.round(R(card).right - R(wrap).right),
    sameRowTitle: Math.abs(R(h2).y + R(h2).h/2 - (R(wrap).y + R(wrap).h/2)) < 6,
    metaSameRowAsTabs: meta ? (R(meta).y < R(tabBox).bottom && R(meta).y + R(meta).h > R(tabBox).y) : null,
    metaBelowTabs: meta ? R(meta).y >= R(tabBox).bottom - 8 : null,
    metaLeftAlignedWithTabs: meta ? Math.abs(R(meta).x - R(tabBox).x) < 6 : null,
    metaRightEdgeVsTabs: meta ? Math.round(R(meta).right - R(tabBox).right) : null,
    wrapPadLeft: cs.paddingLeft, wrapPadRight: cs.paddingRight
  }
})
console.log(JSON.stringify(out, null, 1))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: [] })
