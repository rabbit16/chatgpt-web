const OUT = "/Users/wanru/Documents/deepseek-harness/rabbit 网页设计前端项目/chatgpt-web/docs/audit/2026-10-24/search-design";

const task = await taskSpace("price-search-design-audit2");
const page = task.page("p1");

await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false
});

const logs = [];
page.on?.("console", (m) => logs.push(m));

await page.goto("http://127.0.0.1:5173/price");
await page.waitForTimeout(2000);

// 现状：未加样式的搜索框渲染成什么样
const info = await page.evaluate(() => {
  const heads = [...document.querySelectorAll("h2")];
  const h2 = heads.find((h) => (h.textContent || "").includes("完整价目"));
  if (!h2) return { error: "no h2", body: document.body.innerText.slice(0, 200) };
  h2.closest("section").scrollIntoView({ block: "start" });
  const section = h2.closest("section");
  const input = section.querySelector("input");
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
  };
  return {
    h2Text: (h2.textContent || "").trim(),
    sectionBox: box(section),
    inputBox: box(input),
    inputPlaceholder: input?.placeholder,
    hasClass: [...section.querySelectorAll("div")].map((d) => d.className).filter((c) => typeof c === "string" && c).slice(0, 12)
  };
});
console.log(JSON.stringify(info, null, 2));

await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/desktop-1440-current-wip.png` });

// 再看一眼窄屏
await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true
});
await page.goto("http://127.0.0.1:5173/price");
await page.waitForTimeout(1800);
await page.evaluate(() => {
  const h2 = [...document.querySelectorAll("h2")].find((h) => (h.textContent || "").includes("完整价目"));
  h2?.closest("section")?.scrollIntoView({ block: "start" });
});
await page.waitForTimeout(400);
await page.mouse.move(195, 400);
await page.mouse.wheel(0, -100, { label: "微调" });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/mobile-390-current-wip.png` });

await task.finish({ keep: [] });
