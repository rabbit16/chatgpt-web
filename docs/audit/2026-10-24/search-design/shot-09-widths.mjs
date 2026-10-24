const task = await taskSpace("price-search-design-widths");
const page = task.page("p1");

const widths = [1200, 1280, 1440, 1600, 1920];
const out = [];
for (const w of widths) {
  await page.cdp("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: false });
  await page.goto("http://127.0.0.1:5173/price");
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const h2 = [...document.querySelectorAll("h2")].find((x) => (x.textContent || "").includes("完整价目"));
    const s = h2.closest("section");
    const head = s.querySelector("[class*='tableHead']");
    const tools = s.querySelector("[class*='tableTools']");
    const titleBox = h2.getBoundingClientRect();
    const tabs = s.querySelector("[class*='tabs']");
    const input = s.querySelector(".ant-input-affix-wrapper") || s.querySelector("input");
    const rows = new Set();
    // 判断 tableHead 是否发生换行：标题底 与 工具区顶 的关系
    const tb = tools.getBoundingClientRect();
    return {
      cardInner: Math.round(head.getBoundingClientRect().width),
      titleW: Math.round(titleBox.width),
      toolsW: Math.round(tb.width),
      tabsW: Math.round(tabs.getBoundingClientRect().width),
      inputW: Math.round(input.getBoundingClientRect().width),
      headH: Math.round(head.getBoundingClientRect().height),
      wrapped: tb.top > titleBox.bottom - 4
    };
  });
  out.push({ w, ...r });
}
console.log(JSON.stringify(out, null, 2));
await task.finish({ keep: [] });
