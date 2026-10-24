const task = await taskSpace("price-search-design-probe");
const page = task.page("p1");

await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true
});
await page.goto("http://127.0.0.1:5173/price");
await page.waitForTimeout(1800);

const probe = await page.evaluate(() => {
  const s = [...document.querySelectorAll("h2")].find((h) => (h.textContent || "").includes("完整价目")).closest("section");
  const wrap = s.querySelector(".ant-input-affix-wrapper");
  const inner = wrap?.querySelector("input");
  const cs = wrap ? getComputedStyle(wrap) : null;
  const ci = inner ? getComputedStyle(inner) : null;
  const wrapCls = wrap ? wrap.className : null;
  return {
    wrapClass: wrapCls,
    wrap: cs ? {
      height: cs.height, minHeight: cs.minHeight, radius: cs.borderRadius,
      padding: cs.padding, border: cs.borderColor, bg: cs.backgroundColor, boxShadow: cs.boxShadow
    } : null,
    inner: ci ? { height: ci.height, fontSize: ci.fontSize, lineHeight: ci.lineHeight } : null
  };
});
console.log(JSON.stringify(probe, null, 2));

await page.evaluate(() => {
  const s = [...document.querySelectorAll("h2")].find((h) => (h.textContent || "").includes("完整价目")).closest("section");
  window.scrollTo(0, window.scrollY + s.getBoundingClientRect().top - 70);
});
await page.waitForTimeout(300);

// 聚焦态特写
await page.focus("input[aria-label='搜索模型']");
await page.waitForTimeout(500);
await page.screenshot({ path: "/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/search-design/final-390-focus.png" });

const focused = await page.evaluate(() => {
  const s = [...document.querySelectorAll("h2")].find((h) => (h.textContent || "").includes("完整价目")).closest("section");
  const wrap = s.querySelector(".ant-input-affix-wrapper");
  const cs = getComputedStyle(wrap);
  return { isFocused: wrap.classList.contains("ant-input-affix-wrapper-focused"), border: cs.borderColor, boxShadow: cs.boxShadow };
});
console.log(JSON.stringify(focused, null, 2));

await task.finish({ keep: [] });
