const OUT = "/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/search-design";

const task = await taskSpace("price-search-design-mobile");
const page = task.page("p1");

await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true
});
await page.goto("http://127.0.0.1:5173/price");
await page.waitForTimeout(2000);

await page.evaluate(() => {
  const h2 = [...document.querySelectorAll("h2")].find((h) => (h.textContent || "").includes("完整价目"));
  const s = h2.closest("section");
  window.scrollTo(0, window.scrollY + s.getBoundingClientRect().top - 70);
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/final-390-default.png` });

const m = await page.evaluate(() => {
  const h2 = [...document.querySelectorAll("h2")].find((h) => (h.textContent || "").includes("完整价目"));
  const s = h2.closest("section");
  const wrap = s.querySelector(".ant-input-affix-wrapper") || s.querySelector("input");
  const tabs = s.querySelector("[class*='tabs']");
  const tool = s.querySelector("[class*='tableTools']");
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left) }; };
  const btns = tabs ? [...tabs.querySelectorAll("button")] : [];
  return {
    search: box(wrap),
    searchRadius: wrap ? getComputedStyle(wrap).borderRadius : null,
    tool: box(tool),
    tabs: box(tabs),
    tabRows: btns.length ? new Set(btns.map((b) => Math.round(b.getBoundingClientRect().top))).size : 0,
    viewport: { w: innerWidth }
  };
});
console.log(JSON.stringify(m, null, 2));

// 输入聚焦态（手机）
await page.fill("input[aria-label='搜索模型']", "gpt");
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/final-390-search.png` });

const r2 = await page.evaluate(() => {
  const s = [...document.querySelectorAll("h2")].find((h) => (h.textContent || "").includes("完整价目")).closest("section");
  const meta = s.querySelector("[class*='searchMeta']");
  const rows = [...s.querySelectorAll("tbody tr.ant-table-row")];
  return { meta: meta ? meta.textContent.trim() : null, rows: rows.length };
});
console.log(JSON.stringify(r2, null, 2));

await task.finish({ keep: [] });
