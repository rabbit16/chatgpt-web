// 需求1 补测：滚动到「完整价目」卡片取局部截图 + 核实 390 zzzz 的 6 行
const OUT = '/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/req-verify'

const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')

const scrollToCard = async () => {
  await page.evaluate(() => {
    const section = [...document.querySelectorAll('section')].find(
      (s) => s.querySelector('h2') && s.querySelector('h2').textContent.trim().startsWith('完整价目')
    )
    if (section) window.scrollTo(0, section.getBoundingClientRect().top + window.scrollY - 12)
  })
  await page.waitForTimeout(300)
}

const setSearch = async (kw) => {
  await page.fill('input[aria-label="搜索模型"]', kw)
  await page.waitForTimeout(320)
}

const probe = () =>
  page.evaluate(() => {
    const section = [...document.querySelectorAll('section')].find(
      (s) => s.querySelector('h2') && s.querySelector('h2').textContent.trim().startsWith('完整价目')
    )
    const tbody = section.querySelector('.ant-table-tbody')
    const names = tbody
      ? [...tbody.querySelectorAll('tr.ant-table-row')].map((tr) => {
          const id = tr.querySelector('[class*="modelCellId"]')
          return id ? id.textContent.trim() : tr.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)
        })
      : []
    const hl = [...section.querySelectorAll('mark, [class*="_hl_"]')].length
    const markers = [...section.querySelectorAll('mark')].map((m) => m.textContent)
    const nameEls = [...section.querySelectorAll('[class*="modelCellName"]')].slice(0, 4).map((el) => el.innerHTML.slice(0, 260))
    return { rows: names.length, names, hl, markers, nameEls }
  })

const out = {}
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(700)
await scrollToCard()
await page.screenshot({ path: `${OUT}/r04-1440-card-default.png` })
out.default = await probe()

await setSearch('gpt')
await scrollToCard()
out.gpt = await probe()
await page.screenshot({ path: `${OUT}/r04-1440-card-gpt.png` })

await setSearch('claude')
await scrollToCard()
out.claude = await probe()
await page.screenshot({ path: `${OUT}/r04-1440-card-claude.png` })

await setSearch('gpt sol')
await scrollToCard()
out.gptsol = await probe()
await page.screenshot({ path: `${OUT}/r04-1440-card-gpt_sol.png` })

await setSearch('zzzz')
await scrollToCard()
out.zzzz = await probe()
await page.screenshot({ path: `${OUT}/r04-1440-card-zzzz.png` })

// 深色卡片区
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark')
  try { localStorage.setItem('theme', 'dark') } catch (e) {}
})
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/r04-1440-card-dark-zzzz.png` })
await setSearch('gpt')
await scrollToCard()
await page.screenshot({ path: `${OUT}/r04-1440-card-dark-gpt.png` })
out.darkGpt = await probe()
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'light')
  try { localStorage.setItem('theme', 'light') } catch (e) {}
})

// 390 档核实
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(700)
await scrollToCard()
await page.screenshot({ path: `${OUT}/r04-390-card-default.png` })
out.m390default = await probe()
await setSearch('zzzz')
await scrollToCard()
out.m390zzzz = await probe()
await page.screenshot({ path: `${OUT}/r04-390-card-zzzz.png` })
await setSearch('gpt')
await scrollToCard()
out.m390gpt = await probe()
await page.screenshot({ path: `${OUT}/r04-390-card-gpt.png` })

console.log(JSON.stringify(out, null, 1))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: [] })
