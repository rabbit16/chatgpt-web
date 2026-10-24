const task = await taskSpace("price-search-design-scope");
const page = task.page("p1");

await page.cdp("Emulation.setDeviceMetricsOverride", {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false
});
await page.goto("http://127.0.0.1:5173/price");
await page.waitForTimeout(1800);

const tests = ["CLAUDE", "Claude", "claude ", " gpt sol", "gpt-6-sol", "智谱", "glm", "GPT 6", "gemini", "o3"];
const results = [];
for (const kw of tests) {
  await page.fill("input[aria-label='搜索模型']", kw);
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const s = [...document.querySelectorAll("h2")].find((h) => (h.textContent || "").includes("完整价目")).closest("section");
    const meta = s.querySelector("[class*='searchMeta']");
    const rows = [...s.querySelectorAll("tbody tr.ant-table-row")];
    return {
      meta: meta ? meta.textContent.trim().replace("—— 换个关键词试试，或清空搜索看全部 58 个", "").trim() : null,
      n: rows.length,
      first: rows[0] ? (rows[0].textContent || "").replace(/\s+/g, " ").slice(0, 45) : null
    };
  });
  results.push({ kw, ...r });
}
console.log(JSON.stringify(results, null, 2));

// 顺便统计全部模型名里有多少含中文字符
const stats = await page.evaluate(() => {
  const s = [...document.querySelectorAll("h2")].find((h) => (h.textContent || "").includes("完整价目")).closest("section");
  return { total: document.querySelectorAll("tbody tr.ant-table-row").length };
});
console.log(stats);

await task.finish({ keep: [] });
