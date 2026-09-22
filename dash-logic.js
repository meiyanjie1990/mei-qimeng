(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DashboardLogic = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // 教师端面板纯逻辑（teacher.html 引用，Node 测试直接 require）。
  // 不碰 fetch/DOM/localStorage——数据获取与渲染都在 teacher.html 里。
  // 只算 families.json + checkins.json 的摘要行与红黄标记。
  const DashboardLogic = {};

  const DAY = 86400000;

  function parseDate(s) {
    return new Date(s + "T00:00:00"); // 本地时间零点，与 logic.js 的日期运算一致
  }

  function fmtDate(d) {
    const p = n => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  // 与 Logic.currentWeekNumber 同款算法（本地实现，不 import logic.js）
  function currentWeek(startDate, today) {
    const diffDays = Math.floor((today - parseDate(startDate)) / DAY);
    return Math.min(48, Math.max(1, Math.floor(diffDays / 7) + 1));
  }

  // 某周某天（day=1..7）对应的日期；周起始 = startDate + (week-1)*7
  function checkinDate(startDate, week, day) {
    const d = parseDate(startDate);
    d.setDate(d.getDate() + (week - 1) * 7 + (day - 1));
    return d;
  }

  // 与 Logic.weekDateRange 同款（本地时间格式化，UTC 会整体少一天）
  function weekRange(startDate, week) {
    const start = parseDate(startDate);
    start.setDate(start.getDate() + (week - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: fmtDate(start), end: fmtDate(end) };
  }

  // 红黄标记（对齐启动方案第五节规格：3天没打卡标黄，一周没打卡标红）：
  // 距上次打卡 ≥7 天红（含第7天、从未打卡），3~6 天黄，0~2 天无标记。
  DashboardLogic.flags = function (lastCheckinDate, today) {
    if (!lastCheckinDate) return "red";
    const d = Math.floor((today - parseDate(lastCheckinDate)) / DAY);
    if (d >= 7) return "red";
    if (d >= 3) return "yellow";
    return null;
  };

  // registry.families + checkins.families → 每家庭一行摘要。
  // 行字段：code/childName/startDate/week/weekCount(本周打卡天数)/lastCheckin/flag/recent(近4周)。
  // 防御：注册表旧版缺 age 不抛错（本面板本就不显示 age）；缺 startDate、缺打卡条目也能出空行。
  DashboardLogic.buildRows = function (registry, checkins, today) {
    const fams = (registry && registry.families) || [];
    const byCode = (checkins && checkins.families) || {};
    return fams.map(function (f) {
      const code = f.code;
      const startDate = f.startDate;
      const famCheckins = (startDate && byCode[code] && byCode[code].checkins) || {};
      const week = startDate ? currentWeek(startDate, today) : null;

      // 上次打卡：所有周所有天里最晚的一天；没有任何记录 = null
      let lastCheckin = null;
      let lastDate = null;
      Object.keys(famCheckins).forEach(function (wk) {
        (famCheckins[wk] || []).forEach(function (day) {
          const d = checkinDate(startDate, Number(wk), Number(day));
          if (!lastDate || d > lastDate) lastDate = d;
        });
      });
      if (lastDate) lastCheckin = fmtDate(lastDate);

      // 近4周明细（含本周），展开卡片用
      const recent = [];
      if (startDate && week) {
        for (let w = Math.max(1, week - 3); w <= week; w++) {
          const range = weekRange(startDate, w);
          recent.push({
            week: w,
            start: range.start,
            end: range.end,
            count: (famCheckins[String(w)] || []).length
          });
        }
      }

      return {
        code: code,
        childName: f.childName,
        startDate: startDate,
        week: week,
        weekCount: (famCheckins[String(week)] || []).length,
        lastCheckin: lastCheckin,
        flag: DashboardLogic.flags(lastCheckin, today),
        recent: recent
      };
    });
  };

  return DashboardLogic;
});
