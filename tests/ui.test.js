const test = require("node:test");
const assert = require("node:assert");
const Ui = require("../ui.js");
const content = require("../base/content.json");

// 最小 DOM 桩（沿用谦灵App tests/nav.test.js 的做法）：
// 只提供三个视图容器，render 函数往里写 innerHTML，测试读回来断言。
// 返回 view-week 容器，方便断言本周页；其余视图经 global.document 取。
function documentStub() {
  const views = {};
  for (const id of ["view-week", "view-day", "view-map"]) {
    views[id] = { id, innerHTML: "", hidden: false };
  }
  global.document = {
    getElementById: id => (id === "app" ? { addEventListener() {} } : views[id] || null)
  };
  return views["view-week"];
}

function buyerContent(childName) {
  return Object.assign({}, content, { childName: childName || "豆豆" });
}

const RANGE = { start: "2026-10-12", end: "2026-10-18" };

test("renderWeekPage 用娃名做标题，显示第N周而非课表日期", () => {
  const root = documentStub();
  const state = { content: Object.assign({}, content, { childName: "豆豆" }), week: 2, range: { start: "2026-10-12", end: "2026-10-18" } };
  Ui.renderWeekPage(state.content, state);
  assert.match(root.innerHTML, /豆豆的启蒙/);
  assert.match(root.innerHTML, /第2周/);
  assert.match(root.innerHTML, /2026-10-12/);
  assert.doesNotMatch(root.innerHTML, /6\/29/); // 谦灵课表日期不出现
});

test("本周页有 7 天列表、核心内容和整周打卡键", () => {
  documentStub();
  Ui.renderWeekPage(buyerContent(), { week: 2, range: RANGE, checkins: {} });
  const html = global.document.getElementById("view-week").innerHTML;
  for (const needle of ["动物①", "dog", "狗", "The dog says woof woof!",
    "Old MacDonald", "data-action=\"open-day\"", "data-action=\"toggle-week\"",
    "已完成 0/4 天", "进阶内容（选做）"]) {
    assert.ok(html.includes(needle), "缺: " + needle);
  }
  assert.ok(!html.includes("6/29"), "固定课表日期不该出现");
});

test("打卡状态影响本周页和当天页渲染", () => {
  documentStub();
  const state = { week: 2, range: RANGE, checkins: { "2": [1] } };
  Ui.renderWeekPage(buyerContent(), state);
  const weekHtml = global.document.getElementById("view-week").innerHTML;
  assert.ok(weekHtml.includes("is-done"));
  assert.ok(weekHtml.includes("已完成 1/4 天"));
  Ui.renderDayPage(buyerContent(), Object.assign({}, state, { day: 1 }));
  assert.ok(global.document.getElementById("view-day").innerHTML.includes("is-done"));
});

test("当天页活动日有打卡键和分时块，休息日（3/6/7）没有打卡键", () => {
  documentStub();
  const base = { week: 2, range: RANGE, checkins: {} };
  Ui.renderDayPage(buyerContent(), Object.assign({}, base, { day: 1 }));
  const dayHtml = global.document.getElementById("view-day").innerHTML;
  for (const needle of ["Dog 日", "穿衣服", "Look! A dog on your shirt!", "狗=dog",
    "data-action=\"toggle-checkin\"", "data-day=\"1\"", "data-action=\"go-back\""]) {
    assert.ok(dayHtml.includes(needle), "缺: " + needle);
  }
  assert.ok(!dayHtml.includes("6/29"), "当天页也不该出现固定课表日期");
  Ui.renderDayPage(buyerContent(), Object.assign({}, base, { day: 3 }));
  const restHtml = global.document.getElementById("view-day").innerHTML;
  assert.ok(restHtml.includes("休息"));
  assert.ok(!restHtml.includes("data-action=\"toggle-checkin\""), "休息日不该有打卡键");
});

test("全年地图渲染全部周，细化周可点、未细化周灰化", () => {
  documentStub();
  Ui.renderMapPage(buyerContent());
  const html = global.document.getElementById("view-map").innerHTML;
  assert.ok(html.includes("data-action=\"goto-week\""));
  assert.ok(html.includes("data-week=\"2\""));
  assert.ok(html.includes("第48周"));
  assert.ok(html.includes("内容还没出"));
});
