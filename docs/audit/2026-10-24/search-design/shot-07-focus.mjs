const OUT = "/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/search-design";
const task = await taskSpace("price-search-design-focus");
const page = task.page("p1");

await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false
});
await page.goto("http://127.0.0.1:5173/price");
await page.waitForTimeout(1800);

await page.evaluate(() => {
  const s = [...document.querySelectorAll("h2")].find((h) => (h.textContent || "").includes("完整价目")).closest("section");
  window.scrollTo(0, window.scrollY + s.getBoundingClientRect().top - 90);
});
await page.waitForTimeout(300);

// 点进输入框（真实点击而不是 focus()，才能触发 wrapper 的 focused 类）
await page.click("input[aria-label='搜索模型']", { label: "点搜索框" });
await page.waitForTimeout(600);

const state = await page.evaluate(() => {
  const s = [...document.querySelectorAll("h2")].find((h) => (h.textContent || "").includes("完整价目")).closest("section");
  const wrap = s.querySelector(".ant-input-affix-wrapper");
  const cs = getComputedStyle(wrap);
  return {
    hasFocusedClass: wrap.classList.contains("ant-input-affix-wrapper-focused"),
    border: cs.borderColor,
    boxShadow: cs.boxShadow,
    radius: cs.borderRadius,
    height: cs.height
  };
});
console.log(JSON.stringify(state, null, 2));

await page.screenshot({ path: `${OUT}/final-1440-focus.png` });
await task.finish({ keep: [] });
