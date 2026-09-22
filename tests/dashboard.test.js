const test = require("node:test");
const assert = require("node:assert");
const D = require("../dash-logic.js"); // teacher.html 内联逻辑抽出的 UMD（执行时从 teacher.html 里抽到独立文件 dash-logic.js 供测试，页面引用同文件）
// 为可测试性：Task 6 实际产出 dash-logic.js（UMD）+ teacher.html 引用它

test("flags 按距上次打卡天数标红黄", () => {
  const today = new Date("2026-11-02T12:00:00");
  assert.equal(D.flags("2026-10-26", today), "yellow"); // 7天整
  assert.equal(D.flags("2026-10-20", today), "red");
  assert.equal(D.flags("2026-11-01", today), null);
  assert.equal(D.flags(null, today), "red"); // 从未打卡
});

test("buildRows 输出每个家庭一行摘要", () => {
  const registry = { families: [{ code: "K3F8QA", childName: "豆豆", startDate: "2026-10-05" }] };
  const checkins = { families: { K3F8QA: { checkins: { 1: [1, 2] } } } };
  const rows = D.buildRows(registry, checkins, new Date("2026-10-20T12:00:00"));
  assert.equal(rows[0].childName, "豆豆");
  assert.equal(rows[0].week, 3);
  assert.equal(rows[0].lastCheckin, "2026-10-06");
});

test("buildRows 容忍注册表缺 age 字段（旧版注册表，不抛错）", () => {
  const registry = { families: [{ code: "A1B2C3", childName: "小满", startDate: "2026-09-01" }] };
  const checkins = { families: {} };
  let rows;
  assert.doesNotThrow(() => { rows = D.buildRows(registry, checkins, new Date("2026-09-08T12:00:00")); });
  assert.equal(rows[0].week, 2);
  assert.equal(rows[0].lastCheckin, null);
  assert.equal(rows[0].flag, "red"); // 从未打卡 → 红
});
