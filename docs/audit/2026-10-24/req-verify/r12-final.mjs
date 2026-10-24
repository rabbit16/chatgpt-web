// 收尾补齐：1280/390 精确行数一致性、× 清除、Esc、enterKeyHint、aria-label
const OUT = '/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/req-verify'
const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')

const exact = () =>
  page.evaluate(() => {
    const card = [...document.querySelectorAll('section')].find(
      (s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.trim().startsWith('完整价目')
    )
    if (!card) return { error: 'no card' }
    const rows = card.querySelectorAll('tr.ant-table-row').length
    const meta = card.querySelector('[class*="searchMeta"]')
    const m = meta ? meta.textContent.match(/找到\s*(\d+)\s*个模型/) : null
    const tabs = [...card.querySelectorAll('button')].filter((b) =>
      ['全部', 'OpenAI', 'Claude', 'Google', 'DeepSeek', '智谱', 'xAI', '其他'].includes(b.textContent.trim())
    )
    const input = card.querySelector('input[aria-label="搜索模型"]')
    const wrap = input.closest('.ant-input-affix-wrapper')
    const doc = document.documentElement
    return {
      rows,
      metaNum: m ? Number(m[1]) : null,
      match: m ? rows === Number(m[1]) : null,
      hasAntEmpty: Boolean(card.querySelector('.ant-empty')),
      hasSearchEmpty: Boolean(card.querySelector('[class*="searchEmpty"]')),
      activeTabs: tabs.filter((b) => /tabActive/.test(b.className)).map((b) => b.textContent.trim()),
      muted: tabs.filter((b) => b.dataset.muted !== undefined).length,
      value: input.value,
      inputH: Math.round(wrap.getBoundingClientRect().height),
      inputW: Math.round(wrap.getBoundingClientRect().width),
      fontSize: getComputedStyle(wrap).fontSize,
      enterKeyHint: input.getAttribute('enterkeyhint'),
      ariaLabel: input.getAttribute('aria-label'),
      overflow: Math.max(0, doc.scrollWidth - doc.clientWidth),
      placeholder: input.placeholder
    }
  })

const setSearch = async (kw) => {
  await page.fill('input[aria-label="搜索模型"]', kw)
  await page.waitForTimeout(320)
}

const out = {}

for (const [w, h, mob, tag] of [[1280, 900, false, 'w1280'], [390, 844, true, 'w390']]) {
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mob ? 2 : 1, mobile: mob })
  await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
  await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
  await page.waitForTimeout(800)
  const bag = {}
  bag.default = await exact()
  for (const kw of ['gpt', 'claude', 'gpt sol', 'zzzz']) {
    await setSearch(kw)
    bag[`kw:${kw}`] = await exact()
  }
  // × 清除按钮：先输入再看清除图标并点击
  await setSearch('gpt')
  const clearInfo = await page.evaluate(() => {
    const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
    const wrap = card.querySelector('input[aria-label="搜索模型"]').closest('.ant-input-affix-wrapper')
    const clear = wrap.querySelector('.ant-input-clear-icon, .anticon-close-circle')
    if (!clear) return { found: false }
    const r = clear.getBoundingClientRect()
    const cs = getComputedStyle(clear)
    return { found: true, w: Math.round(r.width), h: Math.round(r.height), opacity: cs.opacity, font: cs.fontSize }
  })
  bag.clearBtn = clearInfo
  if (clearInfo.found) {
    await page.click('.ant-input-clear-icon')
    await page.waitForTimeout(450)
    bag.afterClearClick = await exact()
    await page.screenshot({ path: `${OUT}/r12-${tag}-after-clear-x.png` })
  }
  // Esc
  await setSearch('claude')
  await page.focus('input[aria-label="搜索模型"]')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  bag.afterEsc = await exact()
  out[tag] = bag
}

console.log(JSON.stringify(out, null, 1))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: [] })
