const OUT = "/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/search-design";

const task = await taskSpace("price-search-design-final");
const page = task.page("p1");

// ---------- 桌面 1440：区块完整可见（滚到标题上方留出吸顶条空间）----------
await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false
});
await page.goto("http://127.0.0.1:5173/price");
await page.waitForTimeout(2000);

const pos = await page.evaluate(() => {
  const h2 = [...document.querySelectorAll("h2")].find((h) => (h.textContent || "").includes("完整价目"));
  const section = h2.closest("section");
  const y = window.scrollY + section.getBoundingClientRect().top - 90;
  window.scrollTo(0, y);
  return { scrollY: Math.round(y) };
});
console.log({ pos });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/final-1440-default.png` });

// 量搜索框
const m = await page.evaluate(() => {
  const h2 = [...document.querySelectorAll("h2")].find((h) => (h.textContent || "").includes("完整价目"));
  const section = h2.closest("section");
  const input = section.querySelector(".ant-input-affix-wrapper") || section.querySelector("input");
  const r = input.getBoundingClientRect();
  const cs = getComputedStyle(input);
  const tabs = section.querySelector("[class*='tabs']");
  const tr = tabs.getBoundingClientRect();
  return {
    search: { w: Math.round(r.width), h: Math.round(r.height), radius: cs.borderRadius, fontSize: cs.fontSize },
    tabs: { w: Math.round(tr.width), h: Math.round(tr.height), top: Math.round(tr.top) },
    inputTop: Math.round(r.top)
  };
});
console.log(JSON.stringify(m, null, 2));

// ---------- 搜索 "claude"：验证跨厂商 + 命中数 ----------
await page.fill("input[aria-label='搜索模型']", "claude");
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/final-1440-search-claude.png` });

const searched = await page.evaluate(() => {
  const h2 = [...document.querySelectorAll("h2")].find((h) => (h.textContent || "").includes("完整价目"));
  const section = h2.closest("section");
  const meta = section.querySelector("[class*='searchMeta']");
  const rows = [...section.querySelectorAll("tbody tr.ant-table-row")];
  return {
    h2: (h2.textContent || "").trim(),
    meta: meta ? meta.textContent.trim() : null,
    rowCount: rows.length,
    firstRows: rows.slice(0, 3).map((r) => (r.textContent || "").replace(/\s+/g, " ").slice(0, 70))
  };
});
console.log(JSON.stringify(searched, null, 2));

// ---------- 无结果 ----------
await page.fill("input[aria-label='搜索模型']", "zzzz-not-exist");
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/final-1440-noresult.png` });
const empty = await page.evaluate(() => {
  const section = [...document.querySelectorAll("h2")]
    .find((h) => (h.textContent || "").includes("完整价目"))
    .closest("section");
  const meta = section.querySelector("[class*='searchMeta']");
  const emptyEl = section.querySelector(".ant-empty");
  return {
    meta: meta ? meta.textContent.trim() : null,
    emptyText: emptyEl ? emptyEl.textContent.trim() : null
  };
});
console.log(JSON.stringify(empty, null, 2));

await task.finish({ keep: [] });
