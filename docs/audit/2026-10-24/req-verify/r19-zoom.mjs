const OUT = '/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/req-verify'
const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')
const shot = async (theme, name) => {
  await page.evaluate((t) => localStorage.setItem('theme_storage', JSON.stringify({ state: { mode: t }, version: 0 })), theme)
  await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
  await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
  await page.waitForTimeout(900)
  await page.fill('input[aria-label="搜索模型"]', 'gpt')
  await page.waitForTimeout(450)
  const box = await page.evaluate(() => {
    const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
    const tabBox = [...card.querySelectorAll('button')].find(b=>b.textContent.trim()==='全部').parentElement
    const r = tabBox.getBoundingClientRect()
    return { x: Math.round(r.x) - 8, y: Math.round(r.y) - 8, w: Math.round(r.width) + 16, h: Math.round(r.height) + 46 }
  })
  await page.evaluate((y) => window.scrollTo(0, window.scrollY + y - 200), box.y)
  await page.waitForTimeout(250)
  const box2 = await page.evaluate(() => {
    const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
    const tabBox = [...card.querySelectorAll('button')].find(b=>b.textContent.trim()==='全部').parentElement
    const r = tabBox.getBoundingClientRect()
    return { x: Math.round(r.x) - 10, y: Math.round(r.y) - 10, w: Math.round(r.width) + 20, h: Math.round(r.height) + 50 }
  })
  const clip = { x: box2.x, y: box2.y, width: box2.w, height: box2.h }
  await page.screenshot({ path: `${OUT}/${name}.png`, clip, scale: 'css' })
  return clip
}
const out = {}
out.light = await shot('light', 'r19-zoom-tabs-meta-light')
out.dark = await shot('dark', 'r19-zoom-tabs-meta-dark')
await page.evaluate(() => localStorage.setItem('theme_storage', JSON.stringify({ state: { mode: 'light' }, version: 0 })))
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForTimeout(800)
console.log(JSON.stringify(out))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: [] })
