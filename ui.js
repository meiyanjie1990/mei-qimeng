(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Ui = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const Ui = {};

  // Task 1 骨架：内容加载成功后先渲染占位，
  // 后续任务再换成真实的本周页（娃名标题 + 第N周 + 日期范围）
  Ui.renderWeekPage = function (content, state) {
    var el = document.getElementById("view-week");
    if (el) el.innerHTML = '<div class="empty"><p>正在加载家庭信息…</p></div>';
  };

  Ui.showError = function (msg) {
    var el = document.getElementById("view-week");
    if (el) el.innerHTML = '<div class="empty"><p>' + String(msg) + '</p>' +
      '<button type="button" onclick="location.reload()">重试</button></div>';
  };

  return Ui;
});
