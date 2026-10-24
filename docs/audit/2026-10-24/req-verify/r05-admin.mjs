// 定位修正：确认 390 下「完整价目」section 结构；并实测后台留言页 + 后台菜单
const OUT = '/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/req-verify'

const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')

const structure = () =>
  page.evaluate(() => {
    const cards = [...document.querySelectorAll('section')].filter((s) => s.querySelector('h2'))
    return cards.map((s) => ({
      h2: s.querySelector('h2').textContent.replace(/\s+/g, ' ').trim().slice(0, 30),
      cls: s.className,
      tables: s.querySelectorAll('.ant-table').length,
      rows: s.querySelectorAll('tr.ant-table-row').length,
      hasEmpty: Boolean(s.querySelector('.ant-empty')),
      hasSearchEmpty: Boolean(s.querySelector('[class*="searchEmpty"]')),
      w: Math.round(s.getBoundingClientRect().width)
    }))
  })

const out = {}
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(800)
out.m390Structure = await structure()
await page.fill('input[aria-label="搜索模型"]', 'zzzz')
await page.waitForTimeout(400)
out.m390StructureZzzz = await structure()
await page.evaluate(() => {
  const s = [...document.querySelectorAll('section')].find((x) => x.querySelector('h2') && x.querySelector('h2').textContent.includes('完整价目'))
  window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY - 10)
})
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/r05-390-zzzz-card.png` })

await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await page.waitForTimeout(400)

// 后台留言页：真实登录态，直接访问
await page.goto('http://127.0.0.1:5173/admin/feedback', { timeout: 30000 })
await page.waitForTimeout(2500)
const info = await page.evaluate(() => {
  const t = document.body.innerText
  return {
    url: location.pathname,
    has404: /404|不存在|Not Found/i.test(t),
    textSample: t.replace(/\s+/g, ' ').slice(0, 900),
    deleteBtns: [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === '删除').length,
    hideBtns: [...document.querySelectorAll('button')].filter((b) => ['隐藏', '恢复'].includes(b.textContent.trim())).length,
    linkBtns: [...document.querySelectorAll('button.ant-btn-link')].map((b) => b.textContent.trim()).slice(0, 30)
  }
})
out.adminFeedback = info
await page.screenshot({ path: `${OUT}/r05-admin-feedback-1440.png` })

// 点开第一个「删除」的二次确认
if (info.deleteBtns > 0) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '删除')
    if (b) b.click()
  })
  await page.waitForTimeout(600)
  out.popconfirm = await page.evaluate(() => {
    const pop = document.querySelector('.ant-popover-inner')
    if (!pop) return { found: false, html: null }
    return {
      found: true,
      title: pop.querySelector('.ant-popconfirm-title')?.textContent.trim() || null,
      desc: pop.querySelector('.ant-popconfirm-description')?.textContent.trim() || null,
      buttons: [...pop.querySelectorAll('button')].map((b) => b.textContent.trim()),
      dangerOk: Boolean(pop.querySelector('button.ant-btn-dangerous')),
      text: pop.textContent.replace(/\s+/g, ' ').trim()
    }
  })
  await page.screenshot({ path: `${OUT}/r05-admin-feedback-popconfirm.png` })
  // 取消，不留改动
  await page.evaluate(() => {
    const pop = document.querySelector('.ant-popover-inner')
    const cancel = pop && [...pop.querySelectorAll('button')].find((b) => b.textContent.trim() === '取消')
    if (cancel) cancel.click()
  })
  await page.waitForTimeout(400)
}

// 后台左侧/顶部菜单
out.adminMenu = await page.evaluate(() => {
  const navLinks = [...document.querySelectorAll('a')].map((a) => ({
    text: a.textContent.replace(/\s+/g, ' ').trim(),
    href: a.getAttribute('href')
  }))
  const sidebar = document.querySelector('aside, [class*="side"], [class*="adminNav"], [class*="menu"]')
  return {
    sidebarText: sidebar ? sidebar.innerText.replace(/\s+/g, ' ').slice(0, 1500) : null,
    hasProfile: navLinks.some((l) => l.text === '个人资料'),
    hasShopItem: navLinks.some((l) => l.text === '商城'),
    adminLinks: navLinks.filter((l) => l.href && l.href.includes('/admin')).map((l) => `${l.text} -> ${l.href}`)
  }
})
await page.screenshot({ path: `${OUT}/r05-admin-menu-1440.png` })

// 深色下后台留言页
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark')
  try { localStorage.setItem('theme', 'dark') } catch (e) {}
})
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/r05-admin-feedback-1440-dark.png` })
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'light')
  try { localStorage.setItem('theme', 'light') } catch (e) {}
})

console.log(JSON.stringify(out, null, 1))
await task.finish({ keep: [] })
