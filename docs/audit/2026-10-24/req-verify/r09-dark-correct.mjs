// 深色正确路径：写 theme_storage -> 刷新，让 React 同时切 CSS 变量与 antd 主题
const OUT = '/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/req-verify'
const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')

const probe = () =>
  page.evaluate(() => {
    const card = [...document.querySelectorAll('section')].find(
      (s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目')
    )
    const nameEl = card.querySelector('[class*="modelCellName"]')
    const idEl = card.querySelector('[class*="modelCellId"]')
    const priceEl = card.querySelector('[class*="usdOnly"]')
    const row = card.querySelector('tr.ant-table-row')
    const td = row ? row.querySelector('td') : null
    const tabs = [...card.querySelectorAll('button')].filter((b) =>
      ['全部', 'OpenAI', 'Claude', 'Google', 'DeepSeek', '智谱', 'xAI', '其他'].includes(b.textContent.trim())
    )
    const activeTab = tabs.find((b) => /tabActive/.test(b.className))
    const wrap = card.querySelector('input[aria-label="搜索模型"]').closest('.ant-input-affix-wrapper')
    const cs = getComputedStyle(wrap)
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      htmlClass: document.documentElement.className,
      rowBg: row ? getComputedStyle(row).backgroundColor : null,
      tdBg: td ? getComputedStyle(td).backgroundColor : null,
      nameColor: nameEl ? getComputedStyle(nameEl).color : null,
      idColor: idEl ? getComputedStyle(idEl).color : null,
      priceColor: priceEl ? getComputedStyle(priceEl).color : null,
      activeTabBg: activeTab ? getComputedStyle(activeTab).backgroundColor : null,
      activeTabColor: activeTab ? getComputedStyle(activeTab).color : null,
      searchBg: cs.backgroundColor,
      searchBorder: cs.borderColor,
      rows: card.querySelectorAll('tr.ant-table-row').length
    }
  })

const setTheme = async (mode) => {
  await page.evaluate((m) => {
    localStorage.setItem('theme_storage', JSON.stringify({ state: { mode: m }, version: 0 }))
  }, mode)
  await page.reload({ timeout: 30000 })
  await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
  await page.waitForTimeout(900)
}

const out = {}
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })

await setTheme('dark')
out.dark = await probe()
await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 12)
})
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/r09-1440-dark-default.png` })

await page.fill('input[aria-label="搜索模型"]', 'gpt')
await page.waitForTimeout(500)
out.darkSearch = await probe()
await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 12)
})
await page.waitForTimeout(250)
await page.screenshot({ path: `${OUT}/r09-1440-dark-search.png` })

await page.fill('input[aria-label="搜索模型"]', 'zzzz')
await page.waitForTimeout(500)
out.darkEmpty = await probe()
await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 12)
})
await page.waitForTimeout(250)
await page.screenshot({ path: `${OUT}/r09-1440-dark-empty.png` })

// 390 深色
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await setTheme('dark')
await page.fill('input[aria-label="搜索模型"]', 'gpt')
await page.waitForTimeout(500)
await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 10)
})
await page.waitForTimeout(300)
out.dark390 = await probe()
await page.screenshot({ path: `${OUT}/r09-390-dark-search.png` })

// 恢复浅色
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await setTheme('light')
out.lightBack = await probe()

console.log(JSON.stringify(out, null, 1))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: [] })
