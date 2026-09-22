const test = require("node:test");
const assert = require("node:assert");
const Logic = require("../logic.js");

test("loadBase 从缓存兜底（无网络时）", async () => {
  global.fetch = () => { throw new Error("offline"); };
  global.caches = {
    open: async () => ({
      match: async () => ({ ok: true, json: async () => ({ version: 1, weeks: [] }) })
    })
  };
  const c = await Logic.loadBase();
  assert.equal(c.version, 1);
});
