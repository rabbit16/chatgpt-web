// 聚焦态复核：真实点击+键入 vs 直接 focus()，看品牌描边/光晕是否出现
const OUT = '/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/req-verify'
const task = await taskSpace('req-verify-2026-10-24')
const page = task.page('p1')

const read = () =>
  page.evaluate(() => {
    const el = document.querySelector('input[aria-label="搜索模型"]')
    const wrap = el.closest('.ant-input-affix-wrapper')
    const cs = getComputedStyle(wrap)
    const inner = getComputedStyle(el)
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      focused: document.activeElement === el,
      wrapBorder: cs.borderColor,
      wrapShadow: cs.boxShadow,
      wrapOutline: cs.outline,
      innerBorder: inner.borderColor,
      innerShadow: inner.boxShadow,
      wrapClass: wrap.className,
      wrapH: Math.round(wrap.getBoundingClientRect().height)
    }
  })

const out = {}
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(800)
out.blur = await read()

// 真实点击
await page.click('input[aria-label="搜索模型"]')
await page.waitForTimeout(400)
out.afterClick = await read()
await page.screenshot({ path: `${OUT}/r10-focus-after-click.png` })

// 键入
await page.keyboard.type('gpt')
await page.waitForTimeout(400)
out.afterType = await read()
await page.screenshot({ path: `${OUT}/r10-focus-typing.png` })

// 失焦
await page.evaluate(() => document.querySelector('input[aria-label="搜索模型"]').blur())
await page.waitForTimeout(350)
out.afterBlur = await read()

// 移动端聚焦
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.goto('http://127.0.0.1:5173/price', { timeout: 30000 })
await page.waitForSelector('input[aria-label="搜索模型"]', { timeout: 20000 })
await page.waitForTimeout(700)
await page.click('input[aria-label="搜索模型"]')
await page.waitForTimeout(500)
out.mobileFocus = await read()
await page.evaluate(() => {
  const card = [...document.querySelectorAll('section')].find((s) => /tableCard/.test(s.className) && s.querySelector('h2') && s.querySelector('h2').textContent.includes('完整价目'))
  window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 10)
})
await page.waitForTimeout(250)
await page.screenshot({ path: `${OUT}/r10-390-focus.png` })

console.log(JSON.stringify(out, null, 1))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: [] })
