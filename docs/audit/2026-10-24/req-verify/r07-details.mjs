// 收尾：聚焦态样式、内边距、高亮缺失的最终确认、深色空状态
const OUT = '/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/req-verify'
const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')

const out = {}
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(700)
await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 120)
})
await page.waitForTimeout(250)

// 聚焦
await page.evaluate(() => {
  const el = document.querySelector('input[aria-label="搜索模型"]')
  if (el) el.focus()
})
await page.waitForTimeout(400)
out.focus = await page.evaluate(() => {
  const wrap = document.querySelector('input[aria-label="搜索模型"]').closest('.ant-input-affix-wrapper')
  const cs = getComputedStyle(wrap)
  return {
    borderColor: cs.borderColor,
    boxShadow: cs.boxShadow,
    borderWidth: cs.borderWidth,
    paddingLeft: cs.paddingLeft,
    paddingRight: cs.paddingRight,
    height: Math.round(wrap.getBoundingClientRect().height),
    width: Math.round(wrap.getBoundingClientRect().width),
    borderRadius: cs.borderRadius,
    isFocused: document.activeElement === document.querySelector('input[aria-label="搜索模型"]')
  }
})
await page.screenshot({ path: `${OUT}/r07-1440-focus.png` })

// 输入关键词后确认无 mark / 无 _hl_
await page.fill('input[aria-label="搜索模型"]', 'gpt')
await page.waitForTimeout(400)
out.highlight = await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  const nameEl = card.querySelector('[class*="modelCellName"]')
  const idEl = card.querySelector('[class*="modelCellId"]')
  return {
    marks: card.querySelectorAll('mark').length,
    hlClassNodes: card.querySelectorAll('[class*="_hl_"]').length,
    computedBgOnNameSpan: nameEl ? getComputedStyle(nameEl).backgroundColor : null,
    nameHTML: nameEl ? nameEl.innerHTML : null,
    idHTML: idEl ? idEl.innerHTML : null,
    anyBrandSoftBg: [...card.querySelectorAll('span, b, i')].some((el) => {
      const bg = getComputedStyle(el).backgroundColor
      return bg && bg !== 'rgba(0, 0, 0, 0)' && /rgb\(2\d\d, 2[3-4]\d, 25\d\)/.test(bg)
    })
  }
})

// 清除按钮热区
out.clearBtn = await page.evaluate(() => {
  const wrap = document.querySelector('input[aria-label="搜索模型"]').closest('.ant-input-affix-wrapper')
  const clear = wrap.querySelector('.anticon-close-circle, .ant-input-clear-icon')
  if (!clear) return null
  const cs = getComputedStyle(clear)
  const r = clear.getBoundingClientRect()
  return { w: Math.round(r.width), h: Math.round(r.height), fontSize: cs.fontSize, visible: r.width > 0 }
})

// 深色空状态
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark')
  try { localStorage.setItem('theme', 'dark') } catch (e) {}
})
await page.fill('input[aria-label="搜索模型"]', 'zzzz')
await page.waitForTimeout(500)
await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 12)
})
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/r07-1440-dark-noresult-card.png` })
out.darkEmptyBg = await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  const empty = card.querySelector('[class*="searchEmpty"]')
  const btn = empty ? empty.querySelector('.ant-btn') : null
  return {
    cardBg: getComputedStyle(card).backgroundColor,
    textColor: empty ? getComputedStyle(empty.querySelector('strong')).color : null,
    btnBg: btn ? getComputedStyle(btn).backgroundColor : null
  }
})
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'light')
  try { localStorage.setItem('theme', 'light') } catch (e) {}
})
await page.fill('input[aria-label="搜索模型"]', '')
await page.screenshot({ path: `${OUT}/r07-1440-final-default.png` })

console.log(JSON.stringify(out, null, 1))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: [] })
