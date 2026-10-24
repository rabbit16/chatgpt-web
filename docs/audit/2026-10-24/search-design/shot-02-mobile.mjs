const OUT = "/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/search-design";

const task = await taskSpace("price-search-design-audit");
console.log({ spaceId: task.spaceId });

const page = task.page("p1");

await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true
});
await page.goto("http://127.0.0.1:5173/price");
await page.waitForTimeout(1600);

const scrolled = await page.evaluate(() => {
  const heads = [...document.querySelectorAll("h2")];
  const target = heads.find((h) => (h.textContent || "").includes("完整价目"));
  if (!target) return "not-found";
  const card = target.closest("section") || target.parentElement;
  card.scrollIntoView({ block: "start" });
  const r = card.getBoundingClientRect();
  return { top: Math.round(r.top), h: Math.round(r.height) };
});
console.log({ scrolled });

await page.waitForTimeout(400);
await page.mouse.move(195, 400);
await page.mouse.wheel(0, -100, { label: "微调滚动" });
await page.waitForTimeout(500);

await page.screenshot({ path: `${OUT}/mobile-390-now.png` });

const metrics = await page.evaluate(() => {
  const heads = [...document.querySelectorAll("h2")];
  const h2 = heads.find((h) => (h.textContent || "").includes("完整价目"));
  const section = h2?.closest("section");
  const head = section?.querySelector("[class*='tableHead']");
  const tabsWrap = section?.querySelector("[class*='tabs']");
  const tabBtns = tabsWrap ? [...tabsWrap.querySelectorAll("button")] : [];
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), top: Math.round(r.top) };
  };
  return {
    section: box(section),
    tableHead: box(head),
    headStyle: head ? { flexDirection: getComputedStyle(head).flexDirection, gap: getComputedStyle(head).gap } : null,
    tabsWrap: box(tabsWrap),
    tabRows: tabBtns.length ? new Set(tabBtns.map((b) => Math.round(b.getBoundingClientRect().top))).size : 0,
    tabCount: tabBtns.length,
    viewport: { w: window.innerWidth, h: window.innerHeight }
  };
});
console.log(JSON.stringify(metrics, null, 2));

await task.finish({ keep: [] });
