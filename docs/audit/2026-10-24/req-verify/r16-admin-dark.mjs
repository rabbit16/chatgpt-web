// 后台深色正确路径：写 theme_storage -> reload，让 React + antd 一起切
const OUT = '/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/req-verify'
const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await page.goto('http://127.0.0.1:5173/admin/feedback', { timeout: 30000 })
await page.waitForTimeout(2000)

await page.evaluate(() => localStorage.setItem('theme_storage', JSON.stringify({ state: { mode: 'dark' }, version: 0 })))
await page.reload({ timeout: 30000 })
await page.waitForTimeout(2500)

const out = {}
out.theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
out.btnColors = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button.ant-btn-link')]
  const pick = (t) => btns.find((b) => b.textContent.trim() === t)
  const cs = (b) => (b ? { color: getComputedStyle(b).color, weight: getComputedStyle(b).fontWeight } : null)
  return { hide: cs(pick('隐藏')), restore: cs(pick('恢复')), del: cs(pick('删除')), reply: cs(pick('回复')) }
})
await page.screenshot({ path: `${OUT}/r16-admin-dark.png` })

// 打开 Popconfirm 看深色下的确认框
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '删除')
  if (b) b.click()
})
await page.waitForTimeout(700)
out.popconfirmDark = await page.evaluate(() => {
  const pop = document.querySelector('.ant-popover-inner')
  if (!pop) return { found: false }
  const cs = getComputedStyle(pop)
  return {
    found: true,
    bg: cs.backgroundColor,
    title: pop.querySelector('.ant-popconfirm-title')?.textContent.trim(),
    desc: pop.querySelector('.ant-popconfirm-description')?.textContent.trim(),
    titleColor: pop.querySelector('.ant-popconfirm-title') ? getComputedStyle(pop.querySelector('.ant-popconfirm-title')).color : null,
    buttons: [...pop.querySelectorAll('button')].map((b) => ({ t: b.textContent.replace(/\s/g, ''), c: getComputedStyle(b).color }))
  }
})
await page.screenshot({ path: `${OUT}/r16-admin-dark-popconfirm.png` })

// 后台菜单在深色下的可读性
out.menu = await page.evaluate(() => {
  const links = [...document.querySelectorAll('a')].filter((a) => (a.getAttribute('href') || '').startsWith('/admin'))
  const one = links[1]
  return {
    count: links.length,
    names: links.map((a) => a.textContent.replace(/\s+/g, ' ').trim()),
    sampleColor: one ? getComputedStyle(one).color : null
  }
})

// 恢复浅色
await page.evaluate(() => localStorage.setItem('theme_storage', JSON.stringify({ state: { mode: 'light' }, version: 0 })))
await page.reload({ timeout: 30000 })
await page.waitForTimeout(1500)
out.backTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))

console.log(JSON.stringify(out, null, 1))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: [] })
