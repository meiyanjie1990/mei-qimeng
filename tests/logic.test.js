const test = require("node:test");
const assert = require("node:assert");
const Logic = require("../logic.js");

test("loadBase 从缓存兜底（无网络时）", async () => {
  global.fetch = () => { throw new Error("offline"); };
  global.caches = {
    open: async () => ({
      match: async () => ({ ok: true, json: async () => ({ version: 1, weeks: [] }) })
    })
  };
  const c = await Logic.loadBase();
  assert.equal(c.version, 1);
});

test("currentWeekNumber 按起始日算周号并钳制在 1..48", () => {
  assert.equal(Logic.currentWeekNumber("2026-10-05", new Date("2026-10-06T08:00:00")), 1);
  assert.equal(Logic.currentWeekNumber("2026-10-05", new Date("2026-10-12T08:00:00")), 2);
  assert.equal(Logic.currentWeekNumber("2026-10-05", new Date("2026-09-01T08:00:00")), 1); // 起始前钳到1
  assert.equal(Logic.currentWeekNumber("2025-01-01", new Date("2027-01-01T08:00:00")), 48); // 超48钳到48
});

test("mergeContent 应用覆盖层：换主题周 + 加词 + 娃名", () => {
  const base = { version: 5, weeks: [
    { week: 1, theme: "颜色", themeEn: "Colors", emoji: "🔴", coreWords: [{ en: "red", zh: "红色" }], coreSentences: ["I see red."], detailed: true },
    { week: 2, theme: "动物", themeEn: "Animals", emoji: "🐶", coreWords: [{ en: "dog", zh: "狗" }], coreSentences: ["Where's the dog?"], detailed: true }
  ]};
  const overlay = { childName: "豆豆", startDate: "2026-10-05",
    overrides: { "1": { extraWords: [{ en: "car", zh: "汽车" }] } },
    themeSwaps: { "2": "🚗交通工具" } };
  const merged = Logic.mergeContent(base, overlay);
  assert.equal(merged.childName, "豆豆");
  assert.equal(merged.weeks[0].coreWords.length, 2);
  assert.equal(merged.weeks[1].theme, "交通工具");
});

test("mergeContent 覆盖层整周替换（年龄差距大的家庭）", () => {
  const base = { version: 5, weeks: [
    { week: 1, theme: "颜色", themeEn: "Colors", emoji: "🔴", coreWords: [{ en: "red", zh: "红色" }], coreSentences: ["I see red."], detailed: true }
  ]};
  const customWeek = { week: 1, theme: "颜色", themeEn: "Colors", emoji: "🔴",
    coreWords: [{ en: "red", zh: "红色" }], coreSentences: ["Red!"], detailed: true }; // 1.5岁版：短句
  const overlay = { childName: "小满", startDate: "2026-10-05", weeks: { "1": customWeek } };
  const merged = Logic.mergeContent(base, overlay);
  assert.deepEqual(merged.weeks[0], customWeek);
});
