(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Ui = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const Ui = {};

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // 分区小标签（书卷气「」+ 点线）
  function label(text) {
    return '<p class="label">「' + text + '」</p>';
  }

  function wordChips(words) {
    if (!words || !words.length) return "";
    return label("本周核心词") + '<div class="word-chips">' + words.map(function (w) {
      return '<span class="word-chip"><b>' + escapeHtml(w.en) + '</b><i>' + escapeHtml(w.zh) + '</i></span>';
    }).join("") + '</div>';
  }

  function sentenceCard(sentences) {
    if (!sentences || !sentences.length) return "";
    return label("说给孩子听") + '<div class="sentence-card">' + sentences.map(function (s) {
      return '<p class="sentence">' + escapeHtml(s) + '</p>';
    }).join("") + '</div>';
  }

  // 日期范围文字：只用 state.range（weekDateRange 算出来的），
  // 绝不显示 base 内容里谦灵课表的固定日期 week.dates。
  function formatRange(range) {
    if (!range || !range.start || !range.end) return "";
    return range.start + " ~ " + range.end;
  }

  function dayRow(day, done) {
    var cls = "day-row" + (done ? " is-done" : "");
    var state = day.rest ? '<span class="day-state rest">休息</span>'
      : '<span class="day-state' + (done ? " done" : "") + '">' + (done ? "✓" : "○") + '</span>';
    return '<button class="' + cls + '" data-action="open-day" data-day="' + day.day + '">' +
      '<span class="day-name">第' + day.day + '天 · ' + escapeHtml(day.title) + '</span>' + state + '</button>';
  }

  // 视频两条：主视频苔绿条、进阶湖蓝条，各一行
  function videoBar(detail) {
    if (!detail.video || !detail.video.primary) return "";
    var html = '<div class="vbar primary"><span class="vb-label">🎬 主视频</span>' +
      '<span class="name">' + escapeHtml(detail.video.primary.name) +
      '（' + escapeHtml(detail.video.primary.no) + '）</span></div>';
    if (detail.video.advanced) {
      html += '<div class="vbar advanced"><span class="vb-label">⏫ 进阶</span>' +
        '<span class="name">' + escapeHtml(detail.video.advanced.name) +
        '（' + escapeHtml(detail.video.advanced.no) + '）</span></div>';
    }
    return html;
  }

  // 整周打卡键：一次把本周活动日全勾上（休息日不勾）；全勾了再点是取消
  function weekCheckinButton(weekNum, detail, checkins) {
    var act = detail.days.filter(function (d) { return !d.rest; }).map(function (d) { return d.day; });
    if (!act.length) return "";
    var cur = checkins[String(weekNum)] || [];
    var done = act.filter(function (d) { return cur.indexOf(d) >= 0; }).length;
    var all = done === act.length;
    return '<button class="btn-week' + (all ? " is-done" : "") + '" data-action="toggle-week">' +
      (all ? '✅ 本周已全部完成 · 点一下取消'
           : '✅ 整周打卡 · 已完成 ' + done + '/' + act.length + ' 天') +
      '</button>';
  }

  // 本周页：标题是「{娃名}的启蒙」，头部只显示 第N周 + 日期范围（state.range），
  // 不显示内容里的固定课表日期（买家按自己家的起始日走，课表日期没意义）。
  Ui.renderWeekPage = function (content, state) {
    state = state || {};
    var html;
    if (!state.week) {
      html = '<div class="empty"><p>正在准备…</p></div>';
    } else {
      var week = content.weeks.find(function (w) { return w.week === state.week; });
      if (!week) {
        html = '<div class="empty">没有这一周</div>';
      } else {
        var detail = content.details[String(state.week)] || null;
        var checkins = state.checkins || {};
        var core = (week.coreWords && week.coreWords.length ? wordChips(week.coreWords) : "") +
          (week.coreSentences && week.coreSentences.length ? sentenceCard(week.coreSentences) : "");
        var body;
        if (!detail) {
          body = core + '<div class="notice warn">这一周的内容还没出——先看看前面的周吧。</div>';
        } else {
          var days = detail.days.map(function (d) {
            var done = (checkins[String(state.week)] || []).indexOf(d.day) >= 0;
            return dayRow(d, done);
          }).join("");
          var adv = detail.advanced
            ? '<details class="adv"><summary>进阶内容（选做）</summary><p>' + escapeHtml(detail.advanced) + '</p></details>'
            : "";
          body = core + videoBar(detail) + '<div class="day-list">' + days + '</div>' +
            weekCheckinButton(state.week, detail, checkins) + adv;
        }
        var total = content.weeks.length;
        html = '<header class="page-head">' +
          '<h1>' + escapeHtml(week.emoji) + ' ' + escapeHtml(content.childName || "宝宝") + '的启蒙</h1>' +
          '<div class="head-meta"><p class="sub">第' + week.week + '周 · ' + escapeHtml(week.theme) +
          (week.themeEn ? ' · ' + escapeHtml(week.themeEn) : '') + '</p>' +
          '<span class="tag">' + escapeHtml(formatRange(state.range)) + '</span></div></header>' +
          body +
          '<footer class="dock">' +
          '<button class="arrow" data-action="prev-week">◀</button>' +
          '<span class="pos">第' + week.week + '周 / ' + total + '</span>' +
          '<button class="arrow" data-action="next-week">▶</button>' +
          '<button class="map-btn" data-action="show-map">🗺 全年地图</button>' +
          '</footer>';
      }
    }
    var el = document.getElementById("view-week");
    if (el) el.innerHTML = html;
    return html;
  };

  // 当天页：分时块 + remember + 打卡大按钮；休息日没有打卡键
  Ui.renderDayPage = function (content, state) {
    state = state || {};
    var week = content.weeks.find(function (w) { return w.week === state.week; });
    var detail = content.details[String(state.week)];
    var day = detail && detail.days.find(function (d) { return d.day === state.day; });
    var html;
    if (!week || !day) {
      html = '<div class="empty">没有这一天</div>';
    } else {
      var checkins = state.checkins || {};
      var done = (checkins[String(state.week)] || []).indexOf(state.day) >= 0;
      var blocks;
      if (day.rest) {
        blocks = '<div class="notice tip">休息日——不用安排。顺口说一句本周的词就行。</div>';
      } else {
        blocks = day.sections.filter(function (s) { return s.time && (s.do || (s.say && s.say.length)); })
          .map(function (s) {
            var says = (s.say || []).map(function (line) {
              return '<p class="say">“' + escapeHtml(line) + '”</p>';
            }).join("");
            return '<section class="block"><h2>🕐 ' + escapeHtml(s.time) + '</h2>' +
              (s.do ? '<p class="do">' + escapeHtml(s.do) + '</p>' : '') + says + '</section>';
          }).join("");
      }
      var remember = day.remember
        ? '<div class="notice warn">今天只需记：' + escapeHtml(day.remember) + '</div>' : "";
      var checkin = day.rest ? "" :
        '<button class="btn-checkin' + (done ? " is-done" : "") +
        '" data-action="toggle-checkin" data-day="' + day.day + '">' +
        (done ? '✅ 已完成 · 点一下取消' : '✅ 今天完成啦') + '</button>';
      html = '<header class="day-head">' +
        '<div class="top"><button class="back" data-action="go-back">← 返回</button>' +
        '<h1>第' + day.day + '天 · ' + escapeHtml(day.title) + '</h1></div>' +
        '<p class="sub">第' + week.week + '周 · ' + escapeHtml(week.theme) +
        ' · ' + escapeHtml(formatRange(state.range)) + '</p></header>' +
        blocks + remember + checkin;
    }
    var el = document.getElementById("view-day");
    if (el) el.innerHTML = html;
    return html;
  };

  // 全年地图：细化周可点，未细化周灰化；周格子文案「第N周」+ 自家 range 起始日
  // （起始日按家庭起始日现算，绝不显示 content 里谦灵课表的固定日期）。
  Ui.renderMapPage = function (content, state) {
    state = state || {};
    var cells = content.weeks.map(function (w) {
      var start = state.startDate ? Logic.weekDateRange(state.startDate, w.week).start : "";
      var inner = '<span class="map-week">第' + w.week + '周</span>' +
        '<span class="map-emoji">' + escapeHtml(w.emoji) + '</span>' +
        '<span class="map-theme">' + escapeHtml(w.theme) +
        ' <span class="map-en">' + escapeHtml(w.themeEn || "") + '</span></span>' +
        (start ? '<span class="map-date">' + escapeHtml(start) + ' 起</span>' : "");
      if (w.detailed) {
        return '<button class="map-cell detailed" data-action="goto-week" data-week="' + w.week + '">' +
          inner + '</button>';
      }
      return '<div class="map-cell">' + inner + '<span class="map-tag">内容还没出</span></div>';
    }).join("");
    var html = '<header class="day-head">' +
      '<div class="top"><button class="back" data-action="go-back">← 返回</button>' +
      '<h1>🗺 ' + escapeHtml(content.childName || "宝宝") + '的启蒙·全年地图</h1></div>' +
      '<p class="sub">' + content.weeks.length + '周 · 全年计划</p></header>' +
      '<div class="map-grid">' + cells + '</div>';
    var el = document.getElementById("view-map");
    if (el) el.innerHTML = html;
    return html;
  };

  Ui.showError = function (msg) {
    var el = document.getElementById("view-week");
    if (el) el.innerHTML = '<div class="empty"><p>' + escapeHtml(String(msg)) + '</p>' +
      '<button type="button" onclick="location.reload()">重试</button></div>';
  };

  // 组装买家版 App：三视图 + 打卡交互 + 手机返回键历史（同谦灵App 的做法）
  Ui.initApp = function (content, opts) {
    var code = opts.code;
    var startDate = opts.startDate;
    var state = {
      content: content,
      checkins: Logic.loadLocalCheckins(code),
      week: opts.week,
      range: opts.range || Logic.weekDateRange(startDate, opts.week),
      startDate: startDate
    };
    var views = {
      week: document.getElementById("view-week"),
      day: document.getElementById("view-day"),
      map: document.getElementById("view-map")
    };
    // 当前视图。同一份状态也写进浏览器历史记录——
    // 这样手机的返回键 / 侧滑返回才是「回上一页」，而不是整个退出 App。
    var current = { view: "week", day: null };
    function show(name) {
      Object.keys(views).forEach(function (k) {
        if (views[k]) views[k].hidden = k !== name;
      });
      window.scrollTo(0, 0);
    }
    function render() {
      if (current.view === "day") {
        Ui.renderDayPage(state.content, { week: state.week, day: current.day, range: state.range, checkins: state.checkins });
      } else if (current.view === "map") {
        Ui.renderMapPage(state.content, state);
      } else {
        Ui.renderWeekPage(state.content, { week: state.week, range: state.range, checkins: state.checkins });
      }
      show(current.view);
    }
    function historyDepth() {
      var st = window.history.state;
      return (st && st.mei) ? st.depth : 0;
    }
    // 换页 = 往历史里压一条新记录
    function navigate(view, day) {
      current = { view: view, day: day === undefined || day === null ? null : Number(day) };
      window.history.pushState(
        { mei: true, view: current.view, day: current.day, depth: historyDepth() + 1 }, "");
      render();
    }
    // 同一页内换周：原地改记录，返回键不会一周一周地倒回去
    function replaceHere() {
      window.history.replaceState(
        { mei: true, view: current.view, day: current.day, depth: historyDepth() }, "");
    }
    function setWeek(n) {
      state.week = Math.min(state.content.weeks.length, Math.max(1, n));
      state.range = Logic.weekDateRange(startDate, state.week);
    }
    // 页内「返回」按钮：有上一页就回上一页，没有就回本周页
    function goBack() {
      if (historyDepth() > 0) window.history.back();
      else { current = { view: "week", day: null }; render(); }
    }
    window.addEventListener("popstate", function (e) {
      var st = e.state;
      current = (st && st.mei) ? { view: st.view, day: st.day } : { view: "week", day: null };
      render();
    });
    var app = document.getElementById("app");
    if (app) app.addEventListener("click", function (e) {
      var el = e.target.closest("[data-action]");
      if (!el) return;
      var action = el.getAttribute("data-action");
      if (action === "open-day") {
        navigate("day", el.getAttribute("data-day"));
      } else if (action === "toggle-checkin") {
        state.checkins = Logic.toggleDay(code, state.week, Number(el.getAttribute("data-day")));
        render();
      } else if (action === "toggle-week") {
        var detail = state.content.details[String(state.week)];
        if (detail && Logic.activityDays(detail).length) {
          state.checkins = Logic.toggleWeek(code, state.week, detail);
          render();
        }
      } else if (action === "prev-week") {
        setWeek(state.week - 1); replaceHere(); render();
      } else if (action === "next-week") {
        setWeek(state.week + 1); replaceHere(); render();
      } else if (action === "show-map") {
        navigate("map");
      } else if (action === "go-back") {
        goBack();
      } else if (action === "goto-week") {
        setWeek(Number(el.getAttribute("data-week"))); navigate("week");
      }
    });
    // 起点：把当前这条历史记录标成本周页（depth 0 —— 返回键在这一页才会退出 App）
    window.history.replaceState({ mei: true, view: "week", day: null, depth: 0 }, "");
    render();
  };

  return Ui;
});
