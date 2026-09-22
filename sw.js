var CACHE_NAME = "mei-qimeng-v4";
var PRECACHE = [
  "./", "index.html", "logic.js", "ui.js", "base/content.json",
  "manifest.json", "version.json", "fonts/fonts.css",
  "icon-192.png", "icon-512.png", "apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (c) { return c.addAll(PRECACHE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  var pathname = url.pathname;
  var isFresh = pathname.endsWith("/content.json") || pathname.endsWith("/version.json");
  // 缓存键统一去掉 query：?ts= 每次都不一样，按原样缓存永远打不中（写进去读不出来）。
  var cleanReq = url.search
    ? new Request(url.origin + url.pathname, { method: "GET" })
    : e.request;
  if (isFresh || url.search) {
    // 网络优先（content/version 和带 ?ts= 的动态数据，如家庭覆盖层）：
    // 成功就按去掉 query 的键缓存，断网时从缓存兜底。
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(cleanReq, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(cleanReq).then(function (m) { return m || caches.match(e.request).then(function (m2) { return m2 || caches.match("./"); }); });
      })
    );
    return;
  }
  // 无 query 的静态资源：缓存优先；没缓存时联网取，并顺手存进缓存——
  // 字体的子集文件（fonts/*.woff2）是浏览器按需才下载的，
  // 不存的话每次打开都重下、断网就打不开字体
  e.respondWith(
    caches.match(e.request).then(function (m) {
      return m || fetch(e.request).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      });
    })
  );
});

self.addEventListener("message", function (e) {
  if (e.data === "CLEAR_CACHE") {
    e.waitUntil(
      caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      })
    );
  }
});
