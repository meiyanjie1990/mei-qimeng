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
  return Logic;
});
