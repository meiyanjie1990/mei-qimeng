// 周报工具：families.json + checkins.json（+ base/content.json 的主题名）→ 周报 markdown
// 用法：node tools/gen-report.js [--family CODE]
// 每家一行：### 娃名（家庭码）｜第N周｜本周 n/4｜上次 MM-DD｜🟢/🟡/🔴
// 掉队家（🔴/🟡）附给 Mei 的私聊提示句，用该家当前周主题名填充；末尾汇总掉队家数。
"use strict";
const fs = require("fs");
const path = require("path");
const DashboardLogic = require("../dash-logic.js"); // buildRows/flags 与教师端同一套算法
const Logic = require("../logic.js"); // mergeContent 应用覆盖层后取当前周主题

const DAY = 86400000;

function emojiFor(flag) {
  return flag === "red" ? "🔴" : flag === "yellow" ? "🟡" : "🟢";
}

function shortDate(s) {
  return s ? s.slice(5) : "从未"; // 2026-10-12 → 10-12
}

function daysSince(lastCheckin, today) {
  return Math.floor((today - new Date(lastCheckin + "T00:00:00")) / DAY);
}

function hintFor(row, theme, today) {
  const intro = row.lastCheckin
    ? row.childName + " " + daysSince(row.lastCheckin, today) + " 天没打卡"
    : row.childName + " 还没开始打卡";
  const ask = theme
    ? "这周的主题是" + theme + "，" + row.childName + "喜欢吗？"
    : "这周的新内容，" + row.childName + "喜欢吗？";
  return "💬 " + intro + "，可以私聊一句：「" + ask + "」";
}

// 纯函数：注册表 + 打卡 → 周报 markdown。weekThemes 可选 {家庭码: 当前周主题名}
//（CLI 从 base/content.json + 家庭覆盖层算出；不传时提示句用通用措辞兜底）。
function build(registry, checkins, today, weekThemes) {
  const rows = DashboardLogic.buildRows(registry, checkins, today);
  const lines = [];
  rows.forEach(function (row) {
    lines.push("### " + row.childName + "（" + row.code + "）｜第" + (row.week === null ? "?" : row.week) +
      "周｜本周 " + row.weekCount + "/4｜上次 " + shortDate(row.lastCheckin) + "｜" + emojiFor(row.flag));
    lines.push("");
    if (row.flag) { // 红/黄掉队家：附提示句模板
      lines.push(hintFor(row, weekThemes && weekThemes[row.code], today));
      lines.push("");
    }
  });
  const dropped = rows.filter(r => r.flag);
  lines.push("本周掉队 " + dropped.length + " 家" +
    (dropped.length ? "：" + dropped.map(r => r.childName).join("、") : ""));
  return lines.join("\n");
}

function fmtDate(d) {
  const p = n => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--family");
  const code = i >= 0 ? String(args[i + 1] || "").toUpperCase() : null;
  if (i >= 0 && !code) {
    console.error("用法：node tools/gen-report.js [--family CODE]");
    process.exit(1);
  }
  const repo = path.join(__dirname, "..");
  const registry = JSON.parse(fs.readFileSync(path.join(repo, "families.json"), "utf8"));
  const checkins = JSON.parse(fs.readFileSync(path.join(repo, "checkins.json"), "utf8"));
  const base = JSON.parse(fs.readFileSync(path.join(repo, "base", "content.json"), "utf8"));

  let fams = registry.families || [];
  if (code) {
    fams = fams.filter(f => f.code === code);
    if (!fams.length) {
      console.error("没有这个家庭码：" + code);
      process.exit(1);
    }
  }
  const today = new Date();
  const weekThemes = {};
  fams.forEach(function (f) {
    let overlay = null;
    const p = path.join(repo, "families", f.code + ".json");
    if (fs.existsSync(p)) overlay = JSON.parse(fs.readFileSync(p, "utf8"));
    const content = Logic.mergeContent(base, overlay); // 换主题/整周替换后的内容
    const week = f.startDate ? Logic.currentWeekNumber(f.startDate, today) : null;
    const w = content.weeks.filter(x => x.week === week)[0];
    if (w) weekThemes[f.code] = w.theme;
  });

  console.log("# Mei启蒙周报（" + fmtDate(today) + "）\n");
  console.log(build({ families: fams }, checkins, today, weekThemes));
}

module.exports = { build: build };
