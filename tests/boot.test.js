const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

// index.html 启动链的静态断言（boot 脚本无法在 Node 里直接执行，读源码验证接线）。
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// —— 终审修复 B2：启动不依赖 families.json（loadRegistry 已从 Promise.all 移除） ——

test("启动链不依赖注册表：Promise.all 里没有 loadRegistry，只有覆盖层+基础内容", () => {
  assert.doesNotMatch(html, /Promise\.all\(\s*\[[^\]]*Logic\.loadRegistry/, "启动链仍加载 families.json 注册表");
  assert.match(html, /Promise\.all\(\[Logic\.loadOverlay\(code\), Logic\.loadBase\(\)\]\)/);
});

// —— 终审修复 B4：云同步未接入，状态行隐藏，不向家长显示虚假的已同步/待同步 ——

test("云同步状态行已隐藏（#sync-status 带 hidden）", () => {
  assert.match(html, /id="sync-status"[^>]*hidden/, "sync-status 未隐藏，会显示虚假同步状态");
});

// —— 终审修复 B1：成功启动后记忆家庭码，主屏 PWA 打开（无 ?f=）也能启动 ——

test("成功启动后记忆家庭码到 mei-last-code（与 logic.js 的回退键一致）", () => {
  assert.match(html, /localStorage\.setItem\("mei-last-code", code\)/);
  assert.match(html, /Logic\.parseFamilyCode\(\)/);
});
