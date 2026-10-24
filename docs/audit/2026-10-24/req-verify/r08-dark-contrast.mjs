// 深色模式对比度量化：模型名列 vs 价格列；默认态与搜索态都测
const OUT = '/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/req-verify'
const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')

const probe = () =>
  page.evaluate(() => {
    const card = [...document.querySelectorAll('section')].find(
      (s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目')
    )
    const themeAttr = document.documentElement.getAttribute('data-theme')
    const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()
    const nameEl = card.querySelector('[class*="modelCellName"]')
    const idEl = card.querySelector('[class*="modelCellId"]')
    const priceEl = card.querySelector('[class*="usdOnly"]')
    const th = card.querySelector('.ant-table-thead th')
    const row = card.querySelector('tr.ant-table-row')
    const td = row ? row.querySelector('td') : null
    const info = (el) => (el ? { color: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor, text: el.textContent.slice(0, 30) } : null)
    return {
      themeAttr,
      varText1: cssVar('--text-1'),
      varText2: cssVar('--text-2'),
      varBg: cssVar('--bg'),
      varSurface: cssVar('--surface'),
      nameColor: info(nameEl),
      idColor: info(idEl),
      priceColor: info(priceEl),
      thColor: info(th),
      tdBg: td ? getComputedStyle(td).backgroundColor : null,
      rowBg: row ? getComputedStyle(row).backgroundColor : null,
      cardBg: getComputedStyle(card).backgroundColor,
      tableBg: getComputedStyle(card.querySelector('.ant-table')).backgroundColor
    }
  })

const out = {}
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(800)
out.lightDefault = await probe()

// 走站点自带的主题切换按钮（不用强制属性）
const themeBtn = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('header button, nav button, [class*="nav"] button, button')]
  const b = btns.find((x) => x.querySelector('.anticon-sun, .anticon-moon') || /深色|浅色/.test(x.getAttribute('aria-label') || ''))
  return b ? { label: b.getAttribute('aria-label'), html: b.innerHTML.slice(0, 120) } : null
})
out.themeBtn = themeBtn
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const b = btns.find((x) => x.querySelector('.anticon-sun, .anticon-moon'))
  if (b) b.click()
})
await page.waitForTimeout(900)
out.afterThemeClick = await probe()
await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 12)
})
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/r08-dark-real-toggle.png` })

// 深色搜索态
await page.fill('input[aria-label="搜索模型"]', 'gpt')
await page.waitForTimeout(450)
out.darkSearchReal = await probe()
await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 12)
})
await page.waitForTimeout(250)
await page.screenshot({ path: `${OUT}/r08-dark-real-search.png` })

// 切回浅色
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const b = btns.find((x) => x.querySelector('.anticon-sun, .anticon-moon'))
  if (b) b.click()
})
await page.waitForTimeout(700)
out.backToLight = await probe()

console.log(JSON.stringify(out, null, 1))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: [] })
