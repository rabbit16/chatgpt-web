// 需求1 验收 · 1280 与 390 两档
const OUT = '/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/req-verify'

const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')

const metrics = () =>
  page.evaluate(() => {
    const section = [...document.querySelectorAll('section')].find(
      (s) => s.querySelector('h2') && s.querySelector('h2').textContent.trim().startsWith('完整价目')
    )
    if (!section) return { error: 'no section' }
    const tbody = section.querySelector('.ant-table-tbody')
    const trs = tbody ? [...tbody.querySelectorAll('tr.ant-table-row')] : []
    const emptyEl = section.querySelector('.ant-empty')
    const searchEmpty = section.querySelector('[class*="searchEmpty"]')
    const meta = section.querySelector('[class*="searchMeta"]')
    const input = section.querySelector('input[aria-label="搜索模型"]')
    const wrap = input ? input.closest('.ant-input-affix-wrapper') : null
    const tabBtns = [...section.querySelectorAll('button')].filter((b) =>
      ['全部', 'OpenAI', 'Claude', 'Google', 'DeepSeek', '智谱', 'xAI', '其他'].includes(b.textContent.trim())
    )
    const head = section.querySelector('[class*="tableHead"]')
    const doc = document.documentElement
    const r = (el) => (el ? el.getBoundingClientRect() : null)
    const inputRect = r(wrap)
    const tabsRect = r(tabBtns[0] ? tabBtns[0].parentElement : null)
    const headRect = r(head)
    const secRect = r(section)
    const cs = wrap ? getComputedStyle(wrap) : null
    const inputCs = input ? getComputedStyle(input) : null
    const tops = [...new Set(tabBtns.map((b) => Math.round(b.getBoundingClientRect().top)))]
    // 表格自身横向滚动容器
    const bodyWrap = section.querySelector('.ant-table-content') || section.querySelector('.ant-table-body')
    const dragWrap = section.querySelector('[class*="horizontalDrag"], [class*="dragWrap"]')
    const scrollBox = dragWrap || bodyWrap
    return {
      overflow: Math.max(0, doc.scrollWidth - doc.clientWidth),
      docScrollW: doc.scrollWidth,
      docClientW: doc.clientWidth,
      sectionW: Math.round(secRect.width),
      rows: trs.length,
      hasAntEmpty: Boolean(emptyEl),
      antEmptyText: emptyEl ? emptyEl.textContent.replace(/\s+/g, ' ').trim() : null,
      hasSearchEmpty: Boolean(searchEmpty),
      searchEmptyText: searchEmpty ? searchEmpty.textContent.replace(/\s+/g, ' ').trim() : null,
      metaText: meta ? meta.textContent.replace(/\s+/g, ' ').trim() : null,
      inputValue: input ? input.value : null,
      wrapperH: inputRect ? Math.round(inputRect.height) : null,
      wrapperW: inputRect ? Math.round(inputRect.width) : null,
      wrapperRatio: inputRect && secRect ? +(inputRect.width / secRect.width).toFixed(3) : null,
      radius: cs ? cs.borderRadius : null,
      wrapperFontSize: cs ? cs.fontSize : null,
      inputFontSize: inputCs ? inputCs.fontSize : null,
      inputHeight: inputCs ? inputCs.height : null,
      headH: headRect ? Math.round(headRect.height) : null,
      headTop: headRect ? Math.round(headRect.top) : null,
      inputTop: inputRect ? Math.round(inputRect.top) : null,
      inputBottom: inputRect ? Math.round(inputRect.bottom) : null,
      inputLeft: inputRect ? Math.round(inputRect.left) : null,
      inputRight: inputRect ? Math.round(inputRect.right) : null,
      secRight: secRect ? Math.round(secRect.right) : null,
      tabsTop: tabsRect ? Math.round(tabsRect.top) : null,
      tabsBottom: tabsRect ? Math.round(tabsRect.bottom) : null,
      tabsW: tabsRect ? Math.round(tabsRect.width) : null,
      tabsH: tabsRect ? Math.round(tabsRect.height) : null,
      tabLineCount: tops.length,
      tabCount: tabBtns.length,
      activeTabs: tabBtns.filter((b) => /tabActive/.test(b.className)).map((b) => b.textContent.trim()),
      mutedTabs: tabBtns.filter((b) => b.dataset.muted !== undefined).map((b) => b.textContent.trim()),
      overlap: inputRect && tabsRect ? inputRect.bottom > tabsRect.top + 1 : null,
      markCount: section.querySelectorAll('mark').length,
      subtitle: section.querySelector('h2 small') ? section.querySelector('h2 small').textContent.trim() : null,
      tableCardOverflowX: scrollBox ? scrollBox.scrollWidth > scrollBox.clientWidth + 1 : null,
      scrollBoxW: scrollBox ? scrollBox.clientWidth : null,
      scrollBoxScrollW: scrollBox ? scrollBox.scrollWidth : null,
      calcVisible: Boolean([...document.querySelectorAll('*')].find((el) => el.textContent === '费用估算' && el.children.length === 0)),
      calcToggle: Boolean(section.parentElement && section.parentElement.textContent.includes('费用估算'))
    }
  })

const setSearch = async (kw) => {
  await page.fill('input[aria-label="搜索模型"]', kw)
  await page.waitForTimeout(320)
}

const runWidth = async (w, h, mobile, tag) => {
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile })
  await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
  await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
  await page.waitForTimeout(900)
  const o = {}
  o.default = await metrics()
  await page.screenshot({ path: `${OUT}/r03-${tag}-default-light.png` })
  for (const kw of ['gpt', 'claude', 'gpt sol', 'zzzz']) {
    await setSearch(kw)
    o[`kw:${kw}`] = await metrics()
    await page.screenshot({ path: `${OUT}/r03-${tag}-${kw.replace(/\s+/g, '_')}-light.png` })
  }
  await setSearch('')
  await page.waitForTimeout(350)
  o.afterClear = await metrics()
  return o
}

const result = {}
result.w1280 = await runWidth(1280, 900, false, '1280')
result.w390 = await runWidth(390, 844, true, '390')

// 390 深色 + 页签点击
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark')
  try { localStorage.setItem('theme', 'dark') } catch (e) {}
})
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/r03-390-dark-default.png` })
await setSearch('gpt')
result.dark390 = await metrics()
await page.screenshot({ path: `${OUT}/r03-390-dark-gpt.png` })
await page.evaluate(() => {
  const section = [...document.querySelectorAll('section')].find(
    (s) => s.querySelector('h2') && s.querySelector('h2').textContent.trim().startsWith('完整价目')
  )
  const b = [...section.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Claude')
  if (b) b.click()
})
await page.waitForTimeout(450)
result.dark390AfterTab = await metrics()
await page.screenshot({ path: `${OUT}/r03-390-dark-tabclick.png` })
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'light')
  try { localStorage.setItem('theme', 'light') } catch (e) {}
})

console.log(JSON.stringify(result, null, 1))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: [] })
