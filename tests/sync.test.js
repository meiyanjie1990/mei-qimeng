const test = require("node:test");
const assert = require("node:assert");
const Logic = require("../logic.js");

function mockFetchSeq(responses) {
  let i = 0;
  return async (url, opts) => {
    const r = responses[Math.min(i++, responses.length - 1)];
    return { ok: r.ok, status: r.status ?? 200, json: async () => r.body };
  };
}

test("pushCheckins PUT 带 SHA，409 冲突时重读合并重试", async () => {
  const seq = [
    { ok: false, status: 409 },                       // 第一次 PUT 冲突
    { ok: true, body: { sha: "abc", content: "" } },  // 重读远端
    { ok: true, body: { commit: { sha: "def" } } }    // 第二次 PUT 成功
  ];
  global.fetch = mockFetchSeq(seq);
  const ok = await Logic.pushCheckins("K3F8QA", { 1: [1, 2] });
  assert.equal(ok, true);
});

test("mergeCheckins 只改自己家庭，保留其他家庭数据", () => {
  const remote = { families: { "AAA111": { checkins: { 5: [1] } }, "K3F8QA": { checkins: { 1: [1] } } } };
  const merged = Logic.mergeCheckins(remote, "K3F8QA", { 1: [1, 2], 2: [4] });
  assert.deepEqual(merged.families["AAA111"], { checkins: { 5: [1] } });
  assert.deepEqual(merged.families["K3F8QA"].checkins, { 1: [1, 2], 2: [4] });
});

test("fetchRemoteCheckins 网络失败走本地缓存", async () => {
  global.fetch = async () => { throw new Error("offline"); };
  global.caches = { open: async () => ({ match: async () => ({ json: async () => ({ families: {} }) }) }) };
  const r = await Logic.fetchRemoteCheckins();
  assert.deepEqual(r, { families: {} });
});
