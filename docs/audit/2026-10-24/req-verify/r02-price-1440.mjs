// 需求1 验收 · 1440：修正容器定位（只测「完整价目」卡片）
const OUT = '/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/req-verify'

const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')

const metrics = () =>
  page.evaluate(() => {
    const section = [...document.querySelectorAll('section')].find(
      (s) => s.querySelector('h2') && s.querySelector('h2').textContent.trim().startsWith('完整价目')
    )
    if (!section) return { error: 'no 完整价目 section' }
    const tbody = section.querySelector('.ant-table-tbody')
    const trs = tbody ? [...tbody.querySelectorAll('tr.ant-table-row')] : []
    const emptyEl = section.querySelector('.ant-empty')
    const searchEmpty = section.querySelector('[class*="searchEmpty"]')
    const meta = section.querySelector('[class*="searchMeta"]')
    const input = section.querySelector('input[aria-label="搜索模型"]')
    const wrap = input ? input.closest('.ant-input-affix-wrapper') : null
    const allBtns = [...section.querySelectorAll('button')]
    const tabBox = section.querySelector('[class*="_tabs_"]') || null
    const tabBtns = allBtns.filter((b) => ['全部','OpenAI','Claude','Google','DeepSeek','智谱','xAI','其他'].includes(b.textContent.trim()))
    const head = section.querySelector('[class*="tableHead"]')
    const doc = document.documentElement
    const r = (el) => (el ? el.getBoundingClientRect() : null)
    const inputRect = r(wrap)
    const tabsRect = r(tabBtns[0] ? tabBtns[0].parentElement : null)
    const headRect = r(head)
    const secRect = r(section)
    const cs = wrap ? getComputedStyle(wrap) : null
    // 页签行数：按 top 值聚类
    const tops = [...new Set(tabBtns.map((b) => Math.round(b.getBoundingClientRect().top)))]
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
      searchEmptyIcon: searchEmpty ? Boolean(searchEmpty.querySelector('[class*="badge"],.anticon')) : null,
      metaText: meta ? meta.textContent.replace(/\s+/g, ' ').trim() : null,
      inputValue: input ? input.value : null,
      wrapperH: inputRect ? Math.round(inputRect.height) : null,
      wrapperW: inputRect ? Math.round(inputRect.width) : null,
      radius: cs ? cs.borderRadius : null,
      fontSize: cs ? cs.fontSize : null,
      headH: headRect ? Math.round(headRect.height) : null,
      inputTop: inputRect ? Math.round(inputRect.top) : null,
      inputBottom: inputRect ? Math.round(inputRect.bottom) : null,
      tabsTop: tabsRect ? Math.round(tabsRect.top) : null,
      tabsBottom: tabsRect ? Math.round(tabsRect.bottom) : null,
      tabsW: tabsRect ? Math.round(tabsRect.width) : null,
      tabsH: tabsRect ? Math.round(tabsRect.height) : null,
      tabLineCount: tops.length,
      tabCount: tabBtns.length,
      activeTabs: tabBtns.filter((b) => /tabActive/.test(b.className)).map((b) => b.textContent.trim()),
      mutedTabs: tabBtns.filter((b) => b.dataset.muted !== undefined).map((b) => b.textContent.trim()),
      mutedOpacity: (() => {
        const m = tabBtns.find((b) => b.dataset.muted !== undefined)
        return m ? getComputedStyle(m).opacity : null
      })(),
      overlapInputTabs: inputRect && tabsRect ? inputRect.bottom > tabsRect.top : null,
      markCount: section.querySelectorAll('mark').length,
      subtitle: section.querySelector('h2 small') ? section.querySelector('h2 small').textContent.trim() : null,
      metaBelowTabs: (() => {
        const mr = r(meta)
        return mr && tabsRect ? mr.top >= tabsRect.bottom - 2 : null
      })()
    }
  })

const setSearch = async (kw) => {
  await page.fill('input[aria-label="搜索模型"]', kw)
  await page.waitForTimeout(350)
}

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(900)

const out = {}
out.default = await metrics()
await page.screenshot({ path: `${OUT}/r02-1440-default-light.png` })

for (const kw of ['gpt', 'claude', 'gpt sol', 'zzzz', 'glm', '  gpt  ']) {
  await setSearch(kw)
  const key = `kw:${JSON.stringify(kw)}`
  out[key] = await metrics()
  const safe = kw.trim().replace(/[^a-z0-9]+/gi, '_') || 'blank'
  await page.screenshot({ path: `${OUT}/r02-1440-${safe}-light.png` })
}

await setSearch('')
await page.waitForTimeout(400)
out.afterClear = await metrics()

// 搜索态点 Claude 页签
await setSearch('gpt')
out.beforeTabClick = await metrics()
await page.evaluate(() => {
  const section = [...document.querySelectorAll('section')].find(
    (s) => s.querySelector('h2') && s.querySelector('h2').textContent.trim().startsWith('完整价目')
  )
  const b = [...section.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Claude')
  if (b) b.click()
})
await page.waitForTimeout(500)
out.afterTabClickClaude = await metrics()
await page.screenshot({ path: `${OUT}/r02-1440-after-tabclick-claude-light.png` })

// 深色
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark')
  try { localStorage.setItem('theme', 'dark') } catch (e) {}
})
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/r02-1440-dark-default.png` })
await setSearch('gpt')
out.darkSearch = await metrics()
await page.screenshot({ path: `${OUT}/r02-1440-dark-gpt.png` })
await setSearch('zzzz')
out.darkNoResult = await metrics()
await page.screenshot({ path: `${OUT}/r02-1440-dark-zzzz.png` })
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'light')
  try { localStorage.setItem('theme', 'light') } catch (e) {}
})
await setSearch('')

console.log(JSON.stringify(out, null, 1))
await task.finish({ keep: [] })
