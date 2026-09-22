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

// —— Task 3: 买家端本地打卡 ——

test("toggleDay 打卡/取消并落 localStorage", () => {
  const store = {};
  global.localStorage = {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; }
  };
  let s = Logic.toggleDay("K3F8QA", 1, 1);
  assert.deepEqual(s, { 1: [1] });
  s = Logic.toggleDay("K3F8QA", 1, 1); // 再点取消
  assert.deepEqual(s, { 1: [] });
  s = Logic.toggleDay("K3F8QA", 2, 4);
  assert.deepEqual(s, { 1: [], 2: [4] });
});

test("activityDays 活动日是 1/2/4/5，休息日 3/6/7 不打卡", () => {
  const details = { days: [1,2,3,4,5,6,7].map(d => ({ day: d, rest: d % 3 === 0 || d > 5 })) };
  assert.deepEqual(Logic.activityDays(details), [1, 2, 4, 5]);
});

test("toggleWeek 整周打卡只勾活动日，已满则全取消", () => {
  const store = {};
  global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
  const details = { days: [1,2,3,4,5,6,7].map(d => ({ day: d, rest: d % 3 === 0 || d > 5 })) };
  let s = Logic.toggleWeek("K3F8QA", 1, details);
  assert.deepEqual(s, { 1: [1, 2, 4, 5] });
  s = Logic.toggleWeek("K3F8QA", 1, details);
  assert.deepEqual(s, { 1: [] });
});

test("weekDateRange 按本地时间算日期范围（UTC 换算会少一天）", () => {
  assert.deepEqual(Logic.weekDateRange("2026-10-05", 1), { start: "2026-10-05", end: "2026-10-11" });
});

test("mergeContent 主题替换拆包 emoji 并清空英文主题", () => {
  const base = { version: 5, weeks: [
    { week: 2, theme: "动物", themeEn: "Animals", emoji: "🐶", coreWords: [], coreSentences: [], detailed: true }
  ]};
  const overlay = { childName: "豆豆", startDate: "2026-10-05", themeSwaps: { "2": "🚗交通工具" } };
  const merged = Logic.mergeContent(base, overlay);
  assert.equal(merged.weeks[0].theme, "交通工具");
  assert.equal(merged.weeks[0].emoji, "🚗");
  assert.equal(merged.weeks[0].themeEn, "");
});

test("parseFamilyCode 从链接取家庭码，无码或小写也能处理", () => {
  global.localStorage = { getItem: () => null, setItem: () => {} }; // 没有记忆码时
  global.location = { search: "?f=K3F8QA" };
  assert.equal(Logic.parseFamilyCode(), "K3F8QA");
  global.location = { search: "" };
  assert.equal(Logic.parseFamilyCode(), null);
  global.location = { search: "?f=k3f8qa" };
  assert.equal(Logic.parseFamilyCode(), "K3F8QA");
  delete global.location;
  delete global.localStorage;
});

// —— 终审修复 B1：PWA 装到主屏后打开没有 ?f=，回退到记忆的家庭码 ——

test("parseFamilyCode 无链接参数时回退到记忆的家庭码（mei-last-code）", () => {
  const store = { "mei-last-code": "K3F8QA" };
  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }
  };
  global.location = { search: "" };
  assert.equal(Logic.parseFamilyCode(), "K3F8QA");
  // ?f= 优先于记忆码；记忆码小写/带杂质也照常取
  global.location = { search: "?f=Z9Q2XB" };
  assert.equal(Logic.parseFamilyCode(), "Z9Q2XB");
  store["mei-last-code"] = "k3f8qa";
  global.location = { search: "" };
  assert.equal(Logic.parseFamilyCode(), "K3F8QA");
  delete global.location;
  delete global.localStorage;
});

// —— 终审修复 B2：loadOverlay 网络优先 → 缓存兜底 → null（null=没有覆盖层文件，不抛错） ——

test("loadOverlay 断网时走缓存兜底，缓存也没有返回 null", async () => {
  global.fetch = () => { throw new Error("offline"); };
  global.caches = {
    open: async () => ({
      match: async () => ({ ok: true, json: async () => ({ childName: "豆豆", startDate: "2026-10-05" }) })
    })
  };
  const o = await Logic.loadOverlay("K3F8QA");
  assert.equal(o.childName, "豆豆");
  global.caches = { open: async () => ({ match: async () => undefined }) };
  assert.equal(await Logic.loadOverlay("K3F8QA"), null);
});

test("loadOverlay 家庭文件不存在（404）返回 null 不抛错", async () => {
  global.fetch = async () => ({ ok: false });
  global.caches = { open: async () => ({ match: async () => undefined }) };
  assert.equal(await Logic.loadOverlay("NOPE99"), null);
});

test("buildCheckinText 生成群打卡文案（复制打卡按钮用）", () => {
  assert.equal(Logic.buildCheckinText("豆豆", 3, 2), "「豆豆」第3周·第2天打卡✅");
  assert.equal(Logic.buildCheckinText(null, 1, 4), "「宝宝」第1周·第4天打卡✅");
});
