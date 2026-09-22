(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Logic = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const Logic = {};
  Logic.loadBase = async function () {
    // 网络优先拉 base/content.json，失败走缓存，再失败抛错
    try {
      const r = await fetch("base/content.json?ts=" + Date.now(), { cache: "no-store" });
      if (r.ok) return await r.json();
    } catch (e) {}
    const c = await caches.open("mei-qimeng-v1");
    const cached = await c.match("base/content.json");
    if (cached) return await cached.json();
    throw new Error("content unavailable");
  };

  Logic.parseFamilyCode = function () {
    const m = (location.search || "").match(/[?&]f=([A-Z0-9]{6})/i);
    return m ? m[1].toUpperCase() : null;
  };

  Logic.loadRegistry = async function () {
    const r = await fetch("families.json?ts=" + Date.now());
    if (!r.ok) throw new Error("registry load failed");
    return r.json();
  };

  Logic.loadOverlay = async function (code) {
    const r = await fetch("families/" + code + ".json?ts=" + Date.now());
    return r.ok ? r.json() : null;
  };

  Logic.mergeContent = function (base, overlay) {
    if (!overlay) return base;
    const weeks = base.weeks.map(function (w) {
      const key = String(w.week);
      if (overlay.weeks && overlay.weeks[key]) return overlay.weeks[key]; // 整周替换优先
      const o = overlay.overrides && overlay.overrides[key];
      let wk = w;
      if (o && o.extraWords) wk = Object.assign({}, wk, { coreWords: wk.coreWords.concat(o.extraWords) });
      if (overlay.themeSwaps && overlay.themeSwaps[key]) {
        // 覆盖值是「emoji+主题」打包格式（如「🚗交通工具」），拆开分别覆盖 emoji 与 theme。
        // brief 原实现把整串塞进 theme，与其自带测试（期望 theme 为「交通工具」）相矛盾；
        // 且周数据结构里 emoji 与 theme 是分开的字段（谦灵App 渲染两处分别取用），整串塞入会重复显示 emoji。
        const t = overlay.themeSwaps[key];
        const emoji = (t.match(/^[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]+/u) || [""])[0];
        wk = Object.assign({}, wk, { theme: t.slice(emoji.length) });
        if (emoji) wk = Object.assign({}, wk, { emoji: emoji });
      }
      return wk;
    });
    return Object.assign({}, base, { weeks: weeks, childName: overlay.childName });
  };

  Logic.currentWeekNumber = function (startDate, today) {
    const start = new Date(startDate + "T00:00:00");
    const diffDays = Math.floor((today - start) / 86400000);
    return Math.min(48, Math.max(1, Math.floor(diffDays / 7) + 1));
  };

  Logic.weekDateRange = function (startDate, weekNumber) {
    const start = new Date(startDate + "T00:00:00");
    start.setDate(start.getDate() + (weekNumber - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    // brief 原实现用 toISOString().slice(0,10)：toISOString 按 UTC 输出，在 UTC+8 会整体少一天
    // （实测 weekDateRange("2026-10-05",1) 返回 10-04~10-10，应为 10-05~10-11）。
    // 改为本地时间格式化，与 currentWeekNumber 的本地日期运算保持一致。
    const fmt = d => {
      const p = n => String(n).padStart(2, "0");
      return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
    };
    return { start: fmt(start), end: fmt(end) };
  };

  return Logic;
});
