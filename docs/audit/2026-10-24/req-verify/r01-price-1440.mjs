// 需求1 验收 · 1440 档：搜索可用性 + 溢出 + 页签表现 + 无结果空状态
const OUT = '/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/req-verify'

const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')

const metrics = async () => {
  const rows = await page.evaluate(() => {
    // 只在「完整价目」卡片里数，避免把图像模型表算进来
    const cards = [...document.querySelectorAll('section')]
    const card = cards.find((s) => s.textContent && s.textContent.includes('完整价目'))
    if (!card) return { error: 'no table card' }
    const tbody = card.querySelector('.ant-table-tbody')
    const trs = tbody ? [...tbody.querySelectorAll('tr.ant-table-row')] : []
    const empty = card.querySelector('.ant-empty')
    const searchEmpty = card.querySelector('[class*="searchEmpty"]')
    const meta = card.querySelector('[class*="searchMeta"]')
    const input = card.querySelector('input[aria-label="搜索模型"]')
    const wrap = input ? input.closest('.ant-input-affix-wrapper') : null
    const tabsBox = card.querySelector('[class*="tabs"]')
    const tabBtns = tabsBox ? [...tabsBox.querySelectorAll('button')] : []
    const head = card.querySelector('[class*="tableHead"]')
    const activeTabs = tabBtns.filter((b) => /tabActive/.test(b.className)).map((b) => b.textContent.trim())
    const mutedTabs = tabBtns.filter((b) => b.dataset.muted !== undefined).map((b) => b.textContent.trim())
    const doc = document.documentElement
    const cardRect = card.getBoundingClientRect()
    const inputRect = wrap ? wrap.getBoundingClientRect() : null
    const tabsRect = tabsBox ? tabsBox.getBoundingClientRect() : null
    const headRect = head ? head.getBoundingClientRect() : null
    const cs = wrap ? getComputedStyle(wrap) : null
    return {
      url: location.pathname + location.search,
      docScrollW: doc.scrollWidth,
      docClientW: doc.clientWidth,
      bodyScrollW: document.body.scrollWidth,
      overflow: Math.max(0, doc.scrollWidth - doc.clientWidth),
      cardW: Math.round(cardRect.width),
      rows: trs.length,
      hasAntEmpty: Boolean(empty),
      antEmptyText: empty ? empty.textContent.replace(/\s+/g, ' ').trim() : null,
      hasSearchEmpty: Boolean(searchEmpty),
      searchEmptyText: searchEmpty ? searchEmpty.textContent.replace(/\s+/g, ' ').replace(/\s+/g, ' ') : null,
      hasSearchMeta: Boolean(meta),
      metaText: meta ? meta.textContent.replace(/\s+/g, ' ').trim() : null,
      hasInput: Boolean(input),
      inputValue: input ? input.value : null,
      inputPlaceholder: input ? input.placeholder : null,
      wrapperH: inputRect ? Math.round(inputRect.height) : null,
      wrapperW: inputRect ? Math.round(inputRect.width) : null,
      wrapperRadius: cs ? cs.borderRadius : null,
      inputFontSize: cs ? cs.fontSize : null,
      wrapperTop: inputRect ? Math.round(inputRect.top) : null,
      headTop: headRect ? Math.round(headRect.top) : null,
      headH: headRect ? Math.round(headRect.height) : null,
      tabsW: tabsRect ? Math.round(tabsRect.width) : null,
      tabsH: tabsRect ? Math.round(tabsRect.height) : null,
      tabsTop: tabsRect ? Math.round(tabsRect.top) : null,
      tabsLines: tabsRect ? Math.round(tabsRect.height / 36) : null,
      tabCount: tabBtns.length,
      activeTabs,
      mutedTabs,
      inputOverTabs: inputRect && tabsRect ? (inputRect.bottom > tabsRect.top && inputRect.top < tabsRect.bottom) : null,
      markCount: card.querySelectorAll('mark').length,
      subtitle: card.querySelector('h2 small') ? card.querySelector('h2 small').textContent.trim() : null,
      tabRowWrap: tabsRect ? Math.round(tabsRect.height) : null
    }
  })
  return rows
}

const setSearch = async (kw) => {
  await page.fill('input[aria-label="搜索模型"]', kw)
  await page.waitForTimeout(350)
}

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(800)

const result = {}
result.default = await metrics()
await page.screenshot({ path: `${OUT}/r01-1440-default-light.png` })

for (const kw of ['gpt', 'claude', 'gpt sol', 'zzzz', 'GPT ', 'glm']) {
  await setSearch(kw)
  const m = await metrics()
  result[`kw:${kw}`] = m
  const safe = kw.trim().replace(/[^a-z0-9]/gi, '_') || 'empty'
  await page.screenshot({ path: `${OUT}/r01-1440-search-${safe}-light.png` })
}

// 清空恢复
await setSearch('')
await page.waitForTimeout(400)
result.afterClear = await metrics()
await page.screenshot({ path: `${OUT}/r01-1440-after-clear-light.png` })

// 搜索态点「Claude」页签 → 应退出搜索并切到该厂商
await setSearch('gpt')
result.beforeTabClick = await metrics()
const tabsInfo = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('section')]
  const card = cards.find((s) => s.textContent && s.textContent.includes('完整价目'))
  const btns = [...card.querySelectorAll('[class*="tabs"] button')]
  return btns.map((b) => b.textContent.trim())
})
result.tabLabels = tabsInfo
await page.evaluate(() => {
  const cards = [...document.querySelectorAll('section')]
  const card = cards.find((s) => s.textContent && s.textContent.includes('完整价目'))
  const b = [...card.querySelectorAll('[class*="tabs"] button')].find((x) => x.textContent.trim() === 'Claude')
  if (b) b.click()
})
await page.waitForTimeout(450)
result.afterTabClickClaude = await metrics()
await page.screenshot({ path: `${OUT}/r01-1440-tabclick-claude-light.png` })

// 深色模式同一批
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark')
  try { localStorage.setItem('theme', 'dark') } catch (e) {}
})
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/r01-1440-dark-default.png` })
await setSearch('gpt')
result.darkSearch = await metrics()
await page.screenshot({ path: `${OUT}/r01-1440-dark-search-gpt.png` })
await setSearch('zzzz')
result.darkNoResult = await metrics()
await page.screenshot({ path: `${OUT}/r01-1440-dark-noresult.png` })
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'light')
  try { localStorage.setItem('theme', 'light') } catch (e) {}
})

console.log(JSON.stringify(result, null, 1))
await task.finish({ keep: [] })
