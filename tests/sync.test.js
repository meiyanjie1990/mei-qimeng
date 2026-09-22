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

// —— 补充回归（评审裁定）：逐字测试的 mock 序列落在首次 GET 上，从未触发 409 重试分支 ——
// 以下测试直接覆盖：SHA 冲突重读合并重试、非冲突错误不重试、≤5 次重试上限。

// 记录每次 fetch 的 url/opts 供断言（PUT body 里带 sha 与合并后的 content）
function mockFetchSeqRecord(responses) {
  let i = 0;
  const fn = async (url, opts) => {
    const r = responses[Math.min(i++, responses.length - 1)];
    fn.calls.push({ url: url, opts: opts || {} });
    return { ok: r.ok, status: r.status ?? 200, json: async () => r.body };
  };
  fn.calls = [];
  return fn;
}

// 与实现同款的中文安全 base64（btoa 先经 encodeURIComponent 转 ASCII）
function b64(str) { return btoa(unescape(encodeURIComponent(str))); }

test("pushCheckins PUT 409 冲突：重读新 SHA 后第二次 PUT 带合并数据", async () => {
  const remote = JSON.stringify({ families: { "AAA111": { checkins: { 5: [1] } } } });
  const seq = [
    { ok: true, body: { sha: "sha-1", content: b64(remote) } },  // 第一次 GET 拿 SHA
    { ok: false, status: 409 },                                   // 第一次 PUT 冲突
    { ok: true, body: { sha: "sha-2", content: b64(remote) } },  // 重读远端（新 SHA）
    { ok: true, body: { commit: { sha: "sha-3" } } }             // 第二次 PUT 成功
  ];
  const mock = mockFetchSeqRecord(seq);
  global.fetch = mock;
  const ok = await Logic.pushCheckins("K3F8QA", { 1: [1, 2] });
  assert.equal(ok, true);
  assert.equal(mock.calls.length, 4); // GET → PUT(409) → GET → PUT
  assert.equal(mock.calls[1].opts.method, "PUT");
  assert.equal(JSON.parse(mock.calls[1].opts.body).sha, "sha-1"); // 第一次 PUT 带了首次读到的 SHA
  const put2 = JSON.parse(mock.calls[3].opts.body);
  assert.equal(put2.sha, "sha-2"); // 重试 PUT 带上重读到的新 SHA
  const merged = JSON.parse(decodeURIComponent(escape(atob(put2.content))));
  assert.deepEqual(merged.families["AAA111"], { checkins: { 5: [1] } }); // 其他家庭原样保留
  assert.deepEqual(merged.families["K3F8QA"].checkins, { 1: [1, 2] });   // 本家庭被本地数据替换
});

test("pushCheckins 非冲突错误（401）不重试，直接 false", async () => {
  const seq = [
    { ok: true, body: { sha: "sha-1", content: b64('{ "families": {} }') } },
    { ok: false, status: 401 }
  ];
  const mock = mockFetchSeqRecord(seq);
  global.fetch = mock;
  const ok = await Logic.pushCheckins("K3F8QA", { 1: [2] });
  assert.equal(ok, false);
  assert.equal(mock.calls.length, 2); // 一次 GET + 一次 PUT，无重试
});

test("pushCheckins SHA 持续冲突时重试 5 次后放弃", async () => {
  const seq = [];
  for (let i = 0; i < 5; i++) {
    seq.push({ ok: true, body: { sha: "sha-" + i, content: b64('{ "families": {} }') } });
    seq.push({ ok: false, status: 422 }); // sha 不匹配，会进重试循环
  }
  const mock = mockFetchSeqRecord(seq);
  global.fetch = mock;
  const ok = await Logic.pushCheckins("K3F8QA", { 1: [1] });
  assert.equal(ok, false);
  assert.equal(mock.calls.filter(c => c.opts.method === "PUT").length, 5); // PUT 只试 5 次
});
