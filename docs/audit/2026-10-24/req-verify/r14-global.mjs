// 关键：非「全部」页签下搜索是否全局；总数校验；中文关键词；390 深色
const OUT = '/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/req-verify'
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
    const ids = rows.map((tr) => {
      const el = tr.querySelector('[class*="modelCellId"]')
      return el ? el.textContent.trim() : ''
    })
    const meta = card.querySelector('[class*="searchMeta"]')
    const pag = card.querySelector('.ant-pagination')
    const totalTxt = pag ? pag.textContent.replace(/\s+/g, ' ').trim() : null
    return {
      rows: rows.length,
      ids: ids.slice(0, 20),
      meta: meta ? meta.textContent.replace(/\s+/g, ' ').trim().slice(0, 50) : null,
      activeTabs: tabs.filter((b) => /tabActive/.test(b.className)).map((b) => b.textContent.trim()),
      muted: tabs.filter((b) => b.dataset.muted !== undefined).length,
      pagText: totalTxt,
      hasAntEmpty: Boolean(card.querySelector('.ant-empty')),
      hasSearchEmpty: Boolean(card.querySelector('[class*="searchEmpty"]')),
      value: card.querySelector('input[aria-label="搜索模型"]').value
    }
  })

const clickTab = (n) =>
  page.evaluate((name) => {
    const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
    const b = [...card.querySelectorAll('button')].find((x) => x.textContent.trim() === name)
    if (b) b.click()
  }, n)

const setSearch = async (kw) => {
  await page.fill('input[aria-label="搜索模型"]', kw)
  await page.waitForTimeout(340)
}

const out = {}
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(900)

// 总模型数（翻到第4页看末页条数 + 分页项）
out.allTotal = await snap()
const total = await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  const pag = card.querySelector('.ant-pagination')
  const items = pag ? [...pag.querySelectorAll('.ant-pagination-item')] : []
  return { pages: items.length, last: items.length ? items[items.length - 1].textContent.trim() : null }
})
out.paginationTotal = total

// 关键：先切 Claude 页签，再搜 gpt（应 13，跨厂商而非 0）
await clickTab('Claude')
await page.waitForTimeout(400)
out.onClaudeTab = await snap()
await setSearch('gpt')
out.claudeTabThenGpt = await snap()
await page.screenshot({ path: `${OUT}/r14-1440-claude-tab-search-gpt.png` })

// 中文关键词（规格 §6 已知限制：智谱 → 0）
await setSearch('智谱')
out.chineseKeyword = await snap()

// 英文 glm → 4
await setSearch('glm')
out.glm = await snap()

// 点回「全部」并确认搜索被清空
await clickTab('全部')
await page.waitForTimeout(400)
out.backToAll = await snap()

// 390 深色
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.evaluate(() => localStorage.setItem('theme_storage', JSON.stringify({ state: { mode: 'dark' }, version: 0 })))
await page.reload({ timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(900)
await setSearch('gpt')
await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 10)
})
await page.waitForTimeout(300)
out.dark390 = await snap()
out.dark390Theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
await page.screenshot({ path: `${OUT}/r14-390-dark-gpt.png` })
await setSearch('zzzz')
await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 10)
})
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/r14-390-dark-empty.png` })
out.dark390Empty = await snap()

// 恢复浅色
await page.evaluate(() => localStorage.setItem('theme_storage', JSON.stringify({ state: { mode: 'light' }, version: 0 })))
await page.reload({ timeout: 30000 })
await page.waitForTimeout(800)

console.log(JSON.stringify(out, null, 1))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: [] })
