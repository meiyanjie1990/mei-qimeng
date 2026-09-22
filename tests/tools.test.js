const test = require("node:test");
const assert = require("node:assert");

// —— Task 7 内容管线工具：sync-content / make-family / gen-report ——
// 上方三条为 brief 逐字测试；其余覆盖控制器裁定（customWeeks 结构校验、
// 注册表 age 字段、周报字段+主题提示句、家庭码去重、同步逐字拷贝）。

test("makeFamily 从问卷JSON生成覆盖层", () => {
  const q = { childName: "豆豆", age: 3, interests: ["车"], englishLevel: "听过儿歌", startWeek: 1, themeSwaps: { "2": "🚗交通工具" } };
  const overlay = require("../tools/make-family.js").buildOverlay(q);
  assert.equal(overlay.childName, "豆豆");
  assert.deepEqual(overlay.overrides["1"].extraWords, [{ en: "car", zh: "汽车" }, { en: "bus", zh: "公交车" }]); // 兴趣"车"自动映射词
  assert.equal(overlay.themeSwaps["2"], "🚗交通工具");
});

test("makeFamily 带 customWeeks 的问卷生成整周替换覆盖层（年龄差距大）", () => {
  const q = { childName: "小满", age: 1.5, interests: [], englishLevel: "零基础", customWeeks: { "1": { week: 1, theme: "颜色", coreWords: [{ en: "red", zh: "红色" }], coreSentences: ["Red!"], detailed: true } } };
  const overlay = require("../tools/make-family.js").buildOverlay(q);
  assert.equal(overlay.childName, "小满");
  assert.deepEqual(overlay.weeks["1"], q.customWeeks["1"]);
});

test("genReport 生成含标记的周报行", () => {
  const registry = { families: [{ code: "K3F8QA", childName: "豆豆", startDate: "2026-10-05" }] };
  const checkins = { families: { K3F8QA: { checkins: { 1: [1] } } } };
  const md = require("../tools/gen-report.js").build(registry, checkins, new Date("2026-10-30T12:00:00"));
  assert.match(md, /豆豆/);
  assert.match(md, /🔴/); // 10-06 之后 24 天没打卡 → 红
});

// —— 控制器裁定 3：customWeeks 结构校验，缺字段/类型错要点名报错 ——

test("customWeeks 校验：缺字段报错并点名字段", () => {
  const M = require("../tools/make-family.js");
  const ok = { week: 1, theme: "颜色", coreWords: [{ en: "red", zh: "红色" }], coreSentences: ["Red!"], detailed: true };
  const missingDetailed = { childName: "小满", customWeeks: { "1": { week: 1, theme: "颜色", coreWords: ok.coreWords, coreSentences: ["Red!"] } } };
  assert.throws(() => M.buildOverlay(missingDetailed), /customWeeks\["1"\] 缺字段：detailed/);
  const missingTheme = { childName: "小满", customWeeks: { "2": { week: 2, coreWords: ok.coreWords, coreSentences: ["Red!"], detailed: true } } };
  assert.throws(() => M.buildOverlay(missingTheme), /customWeeks\["2"\] 缺字段：theme/);
});

test("customWeeks 校验：coreWords/coreSentences 必须是数组", () => {
  const M = require("../tools/make-family.js");
  const badWords = { childName: "小满", customWeeks: { "2": { week: 2, theme: "动物", coreWords: "dog", coreSentences: ["Dog!"], detailed: true } } };
  assert.throws(() => M.buildOverlay(badWords), /customWeeks\["2"\]\.coreWords 必须是数组/);
  const badSentences = { childName: "小满", customWeeks: { "2": { week: 2, theme: "动物", coreWords: [], coreSentences: "Dog!", detailed: true } } };
  assert.throws(() => M.buildOverlay(badSentences), /customWeeks\["2"\]\.coreSentences 必须是数组/);
});

test("customWeeks 校验：键与内部 week 不一致会替换错周，必须报错（T7 评审补）", () => {
  const M = require("../tools/make-family.js");
  const mismatch = { childName: "小满", customWeeks: { "1": { week: 2, theme: "颜色", coreWords: [], coreSentences: ["Red!"], detailed: true } } };
  assert.throws(() => M.buildOverlay(mismatch), /week 字段（2）与键不一致/);
});

test("startWeek 必须是 1-48 的整数，否则报错（T7 评审补）", () => {
  const M = require("../tools/make-family.js");
  assert.throws(() => M.buildOverlay({ childName: "豆豆", startWeek: "abc" }), /startWeek 必须是 1-48 的整数/);
  assert.throws(() => M.buildOverlay({ childName: "豆豆", startWeek: 0 }), /startWeek 必须是 1-48 的整数/);
  assert.throws(() => M.buildOverlay({ childName: "豆豆", startWeek: 49 }), /startWeek 必须是 1-48 的整数/);
  // 合法值不受影响
  const ok = M.buildOverlay({ childName: "豆豆", startWeek: 5, interests: ["车"] });
  assert.deepEqual(ok.overrides["5"].extraWords, [{ en: "car", zh: "汽车" }, { en: "bus", zh: "公交车" }]);
});

// —— 控制器裁定 4：注册表条目带 age，旧问卷无 age 则不写该字段 ——

test("buildRegistryEntry 有 age 写 age，无 age 不写（兼容旧问卷）", () => {
  const M = require("../tools/make-family.js");
  const withAge = M.buildRegistryEntry({ childName: "豆豆", age: 3, startDate: "2026-10-05" }, "K3F8QA", new Date("2026-09-22T12:00:00"));
  assert.equal(withAge.code, "K3F8QA");
  assert.equal(withAge.childName, "豆豆");
  assert.equal(withAge.age, 3);
  assert.equal(withAge.startDate, "2026-10-05");
  assert.equal(withAge.package, "monthly");
  assert.equal(withAge.joinedAt, "2026-09-22");
  const noAge = M.buildRegistryEntry({ childName: "豆豆", startDate: "2026-10-05" }, "K3F8QA", new Date("2026-09-22T12:00:00"));
  assert.equal("age" in noAge, false);
});

// —— 家庭码：6 位、字符集不含易混字符、与现有码去重 ——

test("generateCode 六位且只含无易混字符集，与现有码去重", () => {
  const M = require("../tools/make-family.js");
  assert.match(M.generateCode([]), /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  const orig = Math.random;
  let calls = 0;
  Math.random = () => (++calls <= 6 ? 0 : 0.1); // 前6次全 A → AAAAAA，之后全 D
  try {
    assert.equal(M.generateCode(["AAAAAA"]), "DDDDDD");
  } finally {
    Math.random = orig;
  }
});

// —— 兴趣映射补充：恐龙词 + 恐龙歌写进 overrides note；startDate 透传 ——

test("兴趣映射：恐龙词入 extraWords，恐龙歌写进 overrides note", () => {
  const q = { childName: "豆豆", interests: ["恐龙"] };
  const overlay = require("../tools/make-family.js").buildOverlay(q);
  assert.deepEqual(overlay.overrides["1"].extraWords, [{ en: "dinosaur", zh: "恐龙" }]);
  assert.match(overlay.overrides["1"].note, /恐龙歌/);
});

test("buildOverlay 透传 startDate（App 靠它算第几周）", () => {
  const q = { childName: "豆豆", startDate: "2026-10-05" };
  const overlay = require("../tools/make-family.js").buildOverlay(q);
  assert.equal(overlay.startDate, "2026-10-05");
});

// —— 控制器裁定 5：周报每家一行含全部字段，掉队家附主题提示句，末尾汇总 ——

test("genReport 每家一行含周号/打卡/上次/emoji，掉队家附主题提示句", () => {
  const registry = { families: [
    { code: "K3F8QA", childName: "豆豆", startDate: "2026-10-05" },
    { code: "A1B2C3", childName: "小满", startDate: "2026-10-05" }
  ] };
  const checkins = { families: { K3F8QA: { checkins: { 1: [1, 2] } } } };
  const md = require("../tools/gen-report.js").build(registry, checkins, new Date("2026-10-30T12:00:00"), { K3F8QA: "颜色①" });
  assert.match(md, /### 豆豆（K3F8QA）｜第4周｜本周 0\/4｜上次 10-06｜🔴/);
  assert.match(md, /这周的主题是颜色①，豆豆喜欢吗/); // 提示句用该家当前周主题名填充
  assert.match(md, /小满 还没开始打卡/); // 从未打卡的掉队提示
  assert.match(md, /本周掉队 2 家：豆豆、小满/);
});

test("genReport 正常家庭绿标且不带提示句", () => {
  const registry = { families: [{ code: "K3F8QA", childName: "豆豆", startDate: "2026-10-05" }] };
  const checkins = { families: { K3F8QA: { checkins: { 4: [2] } } } };
  const md = require("../tools/gen-report.js").build(registry, checkins, new Date("2026-10-28T12:00:00"));
  assert.match(md, /｜🟢/);
  assert.doesNotMatch(md, /💬/);
  assert.match(md, /本周掉队 0 家/);
});

// —— sync-content：文本级拷贝保留排版，返回版本对比 ——

test("syncContent 逐字拷贝保留排版并返回版本对比", () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mei-sync-"));
  try {
    const src = path.join(dir, "src.json");
    const dest = path.join(dir, "dest.json");
    const text = '{\n  "version": 6,\n  "weeks": [\n    {"week": 1}\n  ]\n}'; // 无尾换行+2空格缩进，验证原排版
    fs.writeFileSync(src, text);
    fs.writeFileSync(dest, '{"version":5,"weeks":[]}');
    const r = require("../tools/sync-content.js").run(src, dest);
    assert.equal(fs.readFileSync(dest, "utf8"), text);
    assert.equal(r.oldVersion, 5);
    assert.equal(r.newVersion, 6);
    const r2 = require("../tools/sync-content.js").run(src, path.join(dir, "missing.json"));
    assert.equal(r2.oldVersion, null);
    assert.equal(r2.newVersion, 6);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
