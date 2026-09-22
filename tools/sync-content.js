// 内容同步工具：谦灵App content.json → base/content.json（单向拷贝，谦灵App 一行不动）
// 用法：node tools/sync-content.js
// 文本级拷贝（保留 2 空格缩进原排版），打印版本号对比。
"use strict";
const fs = require("fs");
const path = require("path");

const SOURCE = "E:/AI项目/谦灵启蒙App/content.json";
const DEST = path.join(__dirname, "..", "base", "content.json");

// src → dest 文本级拷贝；返回 {oldVersion, newVersion}（dest 不存在时 oldVersion=null）
function run(src, dest) {
  const text = fs.readFileSync(src, "utf8");
  let oldVersion = null;
  if (fs.existsSync(dest)) {
    try { oldVersion = JSON.parse(fs.readFileSync(dest, "utf8")).version; } catch (e) {}
  }
  const newVersion = JSON.parse(text).version;
  fs.writeFileSync(dest, text); // 不做 JSON 重排，排版原样
  return { oldVersion: oldVersion, newVersion: newVersion };
}

if (require.main === module) {
  const r = run(SOURCE, DEST);
  const from = r.oldVersion === null ? "（首次）" : r.oldVersion;
  console.log("base/content.json 已同步：版本 " + from + " → " + r.newVersion);
  if (r.oldVersion !== null && r.newVersion !== r.oldVersion) {
    console.log("内容有更新：若新增了生僻字，记得重跑 tools/fetch-fonts.js 补字体子集");
  }
  if (r.oldVersion !== null && r.newVersion < r.oldVersion) {
    console.log("⚠ 注意：新版本号低于当前（可能拷错了方向）");
  }
}

module.exports = { run: run, SOURCE: SOURCE };
