// 字体抓取工具：把 LXGW WenKai（手写体）按需子集下载到 fonts/
// 只保留 app 实际用到的字符段（content.json + 页面/UI 里的字），
// 排除 emoji 段（0x2300-0x2E7F 符号、0x1F000 以上），
// 避免手写字体抢走彩色 emoji 的显示。
// 用法：node tools/fetch-fonts.js （新增内容出现生僻字后重跑一次）
const https = require("https");
const fs = require("fs");
const path = require("path");

const WK_BASE = "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/";
const NUNITO_BASE = "https://cdn.jsdelivr.net/npm/@fontsource/nunito@5.0.18/files/";

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, r => {
      if (r.statusCode !== 200) { rej(new Error(r.statusCode + " " + url)); return; }
      const chunks = [];
      r.on("data", c => chunks.push(c));
      r.on("end", () => res(Buffer.concat(chunks)));
    }).on("error", rej);
  });
}

(async () => {
  const cssText =
    (await get(WK_BASE + "lxgwwenkai-regular.css")).toString("utf8") +
    (await get(WK_BASE + "lxgwwenkai-bold.css")).toString("utf8");

  // 解析全部 @font-face
  const faces = [...cssText.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(m => {
    const b = m[1];
    const ranges = (b.match(/U\+[0-9a-fA-F]+(?:-[0-9a-fA-F]+)?/g) || []).map(t => {
      const [a, c] = t.slice(2).split("-");
      return { start: parseInt(a, 16), end: parseInt(c || a, 16) };
    });
    return {
      weight: /font-weight:\s*(\d+)/.exec(b)[1],
      url: /url\('\.\/([^']+)'\)/.exec(b)[1],
      ranges
    };
  });
  console.log("总 font-face:", faces.length);

  // 用到的字：content.json + ui.js + index.html + 常用标点
  const seed =
    fs.readFileSync(path.join(__dirname, "..", "content.json"), "utf8") +
    fs.readFileSync(path.join(__dirname, "..", "ui.js"), "utf8") +
    fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8") +
    "，。：；？！「」（）《》、·—…“”‘’零一二三四五六七八九十";
  const used = new Set([...seed].map(c => c.codePointAt(0)));

  const keep = faces.map(f => ({
    weight: f.weight,
    url: f.url,
    // 逐段过滤：只留「CJK 段（0x2E80-0xFAFF）且被 app 用到的」具体字符段。
    // 符号段/emoji 段从声明里剔掉，防止手写体抢走彩色 emoji；
    // ASCII 段也剔掉，拉丁字母统一走 Nunito。
    ranges: f.ranges.filter(r =>
      r.start >= 0x2E80 && r.start < 0xFB00 &&
      [...used].some(u => u >= r.start && u <= r.end))
  })).filter(f => f.ranges.length > 0);
  console.log("保留 font-face:", keep.length, "（去重前段数:", keep.reduce((s, f) => s + f.ranges.length, 0) + "）");

  const dir = path.join(__dirname, "..", "fonts");
  fs.mkdirSync(dir, { recursive: true });

  for (const f of keep) {
    const local = path.join(dir, path.basename(f.url));
    if (fs.existsSync(local)) continue;
    fs.writeFileSync(local, await get(WK_BASE + f.url));
  }
  for (const n of ["nunito-latin-700-normal.woff2", "nunito-latin-800-normal.woff2"]) {
    const local = path.join(dir, n);
    if (fs.existsSync(local)) continue;
    fs.writeFileSync(local, await get(NUNITO_BASE + n));
  }

  // 精简后的 css：WenKai 子集 + Nunito（拉丁段）
  let out = "/* 自动生成：tools/fetch-fonts.js。WenKai 只含 app 用到的字符段 */\n";
  for (const f of keep) {
    out += "@font-face {\n  font-family: 'LXGW WenKai';\n  font-style: normal;\n" +
      "  font-weight: " + f.weight + ";\n  font-display: swap;\n" +
      "  src: url('" + path.basename(f.url) + "') format('woff2');\n" +
      "  unicode-range: " + f.ranges.map(r =>
        r.start === r.end ? "U+" + r.start.toString(16)
                          : "U+" + r.start.toString(16) + "-" + r.end.toString(16)
      ).join(", ") + ";\n}\n";
  }
  const nunitoRange = "U+0-FF, U+131, U+152-153, U+2BB-2BC, U+2C6, U+2DA, U+2DC, U+304, U+308, U+329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
  for (const w of [700, 800]) {
    out += "@font-face {\n  font-family: 'Nunito';\n  font-style: normal;\n  font-weight: " + w + ";\n  font-display: swap;\n" +
      "  src: url('nunito-latin-" + w + "-normal.woff2') format('woff2');\n" +
      "  unicode-range: " + nunitoRange + ";\n}\n";
  }
  fs.writeFileSync(path.join(dir, "fonts.css"), out);
  console.log("完成 →", dir);
})();
