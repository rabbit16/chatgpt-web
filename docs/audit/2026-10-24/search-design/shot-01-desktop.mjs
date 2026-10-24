const OUT = "/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/search-design";

const task = await taskSpace("price-search-design-audit");
console.log({ spaceId: task.spaceId });

const page = task.page("p1");

// 设备模拟必须与截图在同一脚本内
await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false
});
await page.goto("http://127.0.0.1:5173/price");
await page.waitForTimeout(1500);

// 定位「完整价目」区块，滚动到它
const scrolled = await page.evaluate(() => {
  const heads = [...document.querySelectorAll("h2")];
  const target = heads.find((h) => (h.textContent || "").includes("完整价目"));
  if (!target) return "not-found";
  const card = target.closest("section") || target.parentElement;
  card.scrollIntoView({ block: "start" });
  const r = card.getBoundingClientRect();
  return { text: (target.textContent || "").trim(), top: Math.round(r.top), h: Math.round(r.height) };
});
console.log({ scrolled });

await page.waitForTimeout(400);
await page.mouse.move(700, 300);
await page.mouse.wheel(0, -120, { label: "微调滚动" });
await page.waitForTimeout(500);

await page.screenshot({ path: `${OUT}/desktop-1440-now.png` });

// 量一下关键元素的真实尺寸
const metrics = await page.evaluate(() => {
  const heads = [...document.querySelectorAll("h2")];
  const h2 = heads.find((h) => (h.textContent || "").includes("完整价目"));
  const section = h2?.closest("section");
  const tabsWrap = section?.querySelector("[class*='tabs']");
  const tabBtns = tabsWrap ? [...tabsWrap.querySelectorAll("button")] : [];
  const table = section?.querySelector("table");
  const head = section?.querySelector("[class*='tableHead']");
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), top: Math.round(r.top) };
  };
  const btn = tabBtns[0];
  const cs = btn ? getComputedStyle(btn) : null;
  return {
    section: box(section),
    tableHead: box(head),
    tabsWrap: box(tabsWrap),
    tabCount: tabBtns.length,
    tabLabels: tabBtns.map((b) => b.textContent.trim()),
    firstTab: box(btn),
    firstTabStyle: cs ? { fontSize: cs.fontSize, radius: cs.borderRadius, padding: cs.padding } : null,
    table: box(table),
    viewport: { w: window.innerWidth, h: window.innerHeight }
  };
});
console.log(JSON.stringify(metrics, null, 2));

await task.finish({ keep: [] });
