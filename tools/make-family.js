// 建家庭工具：问卷转写 JSON → 家庭覆盖层 families/<code>.json（--add 时同时登记注册表）
// 用法：node tools/make-family.js <问卷JSON路径> [--add]
// 问卷字段（Claude 转写）：childName / age / startDate / interests / englishLevel /
//   startWeek（额外词贴到第几周，默认1）/ themeSwaps / customWeeks（年龄定制整周替换，键=周号字符串）
// 覆盖层结构与 logic.js mergeContent 对齐：overrides["N"].extraWords=[{en,zh}]、
//   overrides["N"].note、themeSwaps={"N":"🚗主题"}、weeks={"N":整周对象}、startDate（App 算第几周用）。
"use strict";
const fs = require("fs");
const path = require("path");

// 去掉 I/O/0/1：家长手输链接时不易看错
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// 兴趣→词映射表（内置）：车→car/bus、恐龙→dinosaur、公主→princess/dress、
// 海洋→fish/shark、太空→rocket/star；未收录的兴趣不产出词，由入职起草 customWeeks 覆盖。
const INTEREST_WORDS = {
  "车": [{ en: "car", zh: "汽车" }, { en: "bus", zh: "公交车" }],
  "恐龙": [{ en: "dinosaur", zh: "恐龙" }],
  "公主": [{ en: "princess", zh: "公主" }, { en: "dress", zh: "裙子" }],
  "海洋": [{ en: "fish", zh: "鱼" }, { en: "shark", zh: "鲨鱼" }],
  "太空": [{ en: "rocket", zh: "火箭" }, { en: "star", zh: "星星" }]
};

// 兴趣→备课建议（写进 overrides note，Mei 出课时看）
const INTEREST_NOTES = {
  "恐龙": "恐龙歌：《Dinosaur Stomp》适合当热身歌，边跺脚边唱"
};

const CUSTOM_WEEK_FIELDS = ["week", "theme", "coreWords", "coreSentences", "detailed"];

// customWeeks 单周结构校验：缺字段/类型不对 → 点名报错
// （Claude 起草的入职定制内容不允许悄悄带病上线）
function validateCustomWeek(w, key) {
  if (!w || typeof w !== "object") throw new Error('customWeeks["' + key + '"] 必须是周对象');
  CUSTOM_WEEK_FIELDS.forEach(function (f) {
    if (w[f] === undefined || w[f] === null) throw new Error('customWeeks["' + key + '"] 缺字段：' + f);
  });
  if (!Array.isArray(w.coreWords)) throw new Error('customWeeks["' + key + '"].coreWords 必须是数组');
  if (!Array.isArray(w.coreSentences)) throw new Error('customWeeks["' + key + '"].coreSentences 必须是数组');
  // 键与内部 week 必须一致：mergeContent 按对象键替换，不一致会静默换错周
  if (String(w.week) !== key) {
    throw new Error('customWeeks["' + key + '"] 的 week 字段（' + w.week + '）与键不一致，会替换错周');
  }
}

// 纯函数：问卷 → 覆盖层对象（不碰文件系统，CLI 负责读写）
function buildOverlay(q) {
  if (!q || typeof q !== "object") throw new Error("问卷数据为空");
  if (!q.childName) throw new Error("问卷缺 childName");
  const overlay = { childName: q.childName };
  if (q.startDate) overlay.startDate = q.startDate;

  if (q.startWeek !== undefined && q.startWeek !== null) {
    const n = Number(q.startWeek);
    if (!Number.isInteger(n) || n < 1 || n > 48) {
      throw new Error("startWeek 必须是 1-48 的整数，收到：" + q.startWeek);
    }
  }
  const key = String(q.startWeek || 1);
  const extraWords = [];
  const notes = [];
  (q.interests || []).forEach(function (i) {
    if (INTEREST_WORDS[i]) extraWords.push.apply(extraWords, INTEREST_WORDS[i]);
    if (INTEREST_NOTES[i]) notes.push(INTEREST_NOTES[i]);
  });
  if (extraWords.length || notes.length) {
    overlay.overrides = {};
    overlay.overrides[key] = {};
    if (extraWords.length) overlay.overrides[key].extraWords = extraWords;
    if (notes.length) overlay.overrides[key].note = notes.join("；");
  }
  if (q.themeSwaps && typeof q.themeSwaps === "object") {
    overlay.themeSwaps = Object.assign({}, q.themeSwaps);
  }
  if (q.customWeeks) {
    const weeks = {};
    Object.keys(q.customWeeks).forEach(function (k) {
      validateCustomWeek(q.customWeeks[k], k);
      weeks[k] = q.customWeeks[k]; // 原样并入
    });
    overlay.weeks = weeks;
  }
  return overlay;
}

// 家庭码：字母表随机取 6 位，与现有码去重
function generateCode(existingCodes) {
  const used = new Set(existingCodes || []);
  let code;
  do {
    code = "";
    for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  } while (used.has(code));
  return code;
}

function fmtDate(d) {
  const p = n => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

// 注册表条目。age 只在问卷有值时写入（旧问卷无 age 则条目不含该字段，教师端兼容）。
function buildRegistryEntry(q, code, today) {
  const entry = { code: code, childName: q.childName };
  if (q.age !== undefined && q.age !== null) entry.age = q.age;
  entry.startDate = q.startDate;
  entry.package = "monthly";
  entry.joinedAt = fmtDate(today);
  return entry;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const add = args.indexOf("--add") >= 0;
  const qPath = args.find(a => !a.startsWith("--"));
  if (!qPath) {
    console.error("用法：node tools/make-family.js <问卷JSON路径> [--add]");
    process.exit(1);
  }
  const q = JSON.parse(fs.readFileSync(path.resolve(qPath), "utf8"));
  const repo = path.join(__dirname, "..");
  const famDir = path.join(repo, "families");
  const registryPath = path.join(repo, "families.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  registry.families = registry.families || [];

  const existing = registry.families.map(f => f.code);
  fs.mkdirSync(famDir, { recursive: true });
  fs.readdirSync(famDir).forEach(function (f) {
    if (f.endsWith(".json")) existing.push(f.slice(0, -5));
  });

  if (add && !q.startDate) {
    console.error("问卷缺 startDate（开始日期）：登记注册表必须有起始日，App 靠它算第几周");
    process.exit(1);
  }
  if (!q.startDate) console.warn("⚠ 问卷缺 startDate：家长端无法算第几周，建议补上后重跑");

  const code = generateCode(existing);
  const overlay = buildOverlay(q);
  fs.writeFileSync(path.join(famDir, code + ".json"), JSON.stringify(overlay, null, 2) + "\n");

  if (add) {
    registry.families.push(buildRegistryEntry(q, code, new Date()));
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\n");
  }

  console.log("家庭码：" + code);
  console.log("覆盖层：families/" + code + ".json");
  console.log("家长链接：https://meiyanjie1990.github.io/mei-qimeng/?f=" + code);
  if (add) console.log("已写入注册表 families.json（package: monthly）");
}

module.exports = {
  buildOverlay: buildOverlay,
  buildRegistryEntry: buildRegistryEntry,
  generateCode: generateCode,
  ALPHABET: ALPHABET
};
