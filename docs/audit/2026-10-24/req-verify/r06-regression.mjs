// 回归 + 一致性：页签筛选、行数=命中数（精确卡片）、手机横向滚动、估算器、删除失败提示（预期）
const OUT = '/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/req-verify'

const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')

// 精确取「完整价目」卡片：类名含 tableCard 且 h2 以完整价目开头
const exact = () =>
  page.evaluate(() => {
    const cards = [...document.querySelectorAll('section')]
    const card = cards.find(
      (s) =>
        /tableCard/.test(s.className) &&
        s.querySelector('h2') &&
        s.querySelector('h2').textContent.trim().startsWith('完整价目')
    )
    if (!card) return { error: 'card not found', all: cards.map((c) => c.className).slice(0, 8) }
    const rows = [...card.querySelectorAll('tr.ant-table-row')]
    const ids = rows.map((tr) => {
      const el = tr.querySelector('[class*="modelCellId"]')
      return el ? el.textContent.trim() : null
    })
    const pag = card.querySelector('.ant-pagination')
    const pagText = pag ? pag.textContent.replace(/\s+/g, ' ').trim() : null
    const meta = card.querySelector('[class*="searchMeta"]')
    const metaNumRaw = meta ? meta.textContent.trim() : null
    const tabs = [...card.querySelectorAll('button')].filter((b) =>
      ['全部', 'OpenAI', 'Claude', 'Google', 'DeepSeek', '智谱', 'xAI', '其他'].includes(b.textContent.trim())
    )
    const dragBox = card.querySelector('[class*="horizontalDrag"], [class*="Drag"]')
    const tableContent = card.querySelector('.ant-table-content')
    const sc = dragBox || tableContent
    return {
      rows: rows.length,
      ids,
      pagText,
      metaText: metaNumRaw ? metaNumRaw.replace(/\s+/g, ' ').trim() : null,
      activeTab: tabs.filter((b) => /tabActive/.test(b.className)).map((b) => b.textContent.trim()),
      mutedCount: tabs.filter((b) => b.dataset.muted !== undefined).length,
      hasAntEmpty: Boolean(card.querySelector('.ant-empty')),
      hasSearchEmpty: Boolean(card.querySelector('[class*="searchEmpty"]')),
      scrollW: sc ? sc.scrollWidth : null,
      clientW: sc ? sc.clientWidth : null,
      canScrollX: sc ? sc.scrollWidth > sc.clientWidth + 1 : null,
      docOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
    }
  })

const setSearch = async (kw) => {
  await page.fill('input[aria-label="搜索模型"]', kw)
  await page.waitForTimeout(330)
}

const clickTab = async (name) =>
  page.evaluate((n) => {
    const cards = [...document.querySelectorAll('section')]
    const card = cards.find(
      (s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.trim().startsWith('完整价目')
    )
    const b = [...card.querySelectorAll('button')].find((x) => x.textContent.trim() === n)
    if (b) b.click()
  }, name)

const out = {}

// ---- 1440 一致性 + 页签回归 ----
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(800)
out.default1440 = await exact()

for (const kw of ['gpt', 'claude', 'gpt sol']) {
  await setSearch(kw)
  out[`kw_${kw.replace(/\s+/g, '_')}`] = await exact()
}
await setSearch('zzzz')
out.kw_zzzz = await exact()

// 页签筛选回归：清空后点每个页签，行数应等于该厂商数量且不为 0
await setSearch('')
await page.waitForTimeout(350)
out.afterClear1440 = await exact()
const tabResults = {}
for (const name of ['OpenAI', 'Claude', 'Google', 'DeepSeek', '智谱', 'xAI', '其他', '全部']) {
  await clickTab(name)
  await page.waitForTimeout(320)
  const m = await exact()
  tabResults[name] = { rows: m.rows, active: m.activeTab, providerTags: m.ids.slice(0, 2), muted: m.mutedCount }
}
out.tabFilter = tabResults

// 费用估算器仍工作：改 token 数值看预计消费变化
await clickTab('全部')
await page.waitForTimeout(300)
const calcBefore = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find((x) => /预计消费/.test(x.textContent) && x.className && /calcResult/.test(x.className))
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : document.body.innerText.match(/预计消费（USD）\s*\$[\d.]+/)?.[0]
})
await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('.ant-input-number-input')]
  const target = inputs[0]
  if (target) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(target, '100000')
    target.dispatchEvent(new Event('input', { bubbles: true }))
    target.dispatchEvent(new Event('change', { bubbles: true }))
  }
})
await page.waitForTimeout(600)
const calcAfter = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find((x) => /预计消费/.test(x.textContent) && x.className && /calcResult/.test(x.className))
  return el ? el.textContent.replace(/\s+/g, ' ').trim() : document.body.innerText.match(/预计消费（USD）\s*\$[\d.]+/)?.[0]
})
out.calculator = { before: calcBefore, after: calcAfter, changed: calcBefore !== calcAfter }
await page.screenshot({ path: `${OUT}/r06-1440-calc-after-input.png` })

// ---- 390 横向滚动 ----
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(800)
await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 10)
})
await page.waitForTimeout(300)
out.m390 = await exact()
await page.screenshot({ path: `${OUT}/r06-390-table-start.png` })
const scrolled = await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  const box = card.querySelector('.ant-table-content') || card.querySelector('.ant-table-body')
  if (!box) return null
  box.scrollLeft = box.scrollWidth
  return { scrollLeft: box.scrollLeft, scrollWidth: box.scrollWidth, clientWidth: box.clientWidth }
})
await page.waitForTimeout(400)
out.m390Scrolled = scrolled
await page.screenshot({ path: `${OUT}/r06-390-table-end.png` })
out.m390AfterScroll = await exact()

// ---- 后台：删除确认后点「删除」，验证预期失败提示 ----
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await page.goto('http://127.0.0.1:5173/admin/feedback', { timeout: 30000 })
await page.waitForTimeout(2200)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '删除')
  if (b) b.click()
})
await page.waitForTimeout(500)
await page.evaluate(() => {
  const pop = document.querySelector('.ant-popover-inner')
  const ok = pop && [...pop.querySelectorAll('button')].find((b) => b.textContent.replace(/\s/g, '') === '删除')
  if (ok) ok.click()
})
await page.waitForTimeout(1800)
out.deleteToast = await page.evaluate(() => {
  const msgs = [...document.querySelectorAll('.ant-message-notice-content, .ant-message-custom-content')]
  return {
    texts: msgs.map((m) => m.textContent.replace(/\s+/g, ' ').trim()),
    html: msgs.map((m) => m.innerHTML.slice(0, 200))
  }
})
await page.screenshot({ path: `${OUT}/r06-admin-delete-toast.png` })

console.log(JSON.stringify(out, null, 1))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: [] })
