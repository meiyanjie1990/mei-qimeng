# Mei启蒙买家版App · 项目名片

> 最后更新：2026-09-22｜页面版本 v3（version.json）｜缓存名 mei-qimeng-v3

## 项目概述

**Mei启蒙**是「Mei的英语启蒙」定制陪跑课程的**买家交付App**（PWA，手机网页应用）。家长打开带家庭码的链接，看到**自家娃名字**和**定制的48周计划**（每天15分钟做什么、说什么），当天打卡，还能一键复制群打卡文案。Mei 在教师端看所有家庭。

- **线上地址**：https://meiyanjie1990.github.io/mei-qimeng/ （GitHub 仓库 meiyanjie1990/mei-qimeng，master 分支）
- **买家入口**：`?f=<家庭码>`（6位，无易混字符；码只发给对应家长，等于密码）
- **教师端**：`teacher.html?t=<老师码>`（老师码在 families.json 的 teacherCode，防君子级门禁）
- **内容源**：谦灵启蒙App 的 48 周内容库（`E:\AI项目\谦灵启蒙App\content.json`），经 `tools/sync-content.js` 单向拷贝到 `base/content.json`。**谦灵App仓库一行都不能动。**
- **买家版不显示**谦灵课表的固定日历日期；显示「第N周 + 按家庭起始日算出的日期范围」（`logic.js` 的 weekDateRange 本地时间格式化——用 toISOString 会 UTC+8 少一天）。
- **打卡只存手机本地**（localStorage，键 `mei-checkins-<家庭码>`）。**云同步暂未接入**（安全方案设计中）：前端拿 GitHub 写钥匙=公开，正在评估云端中转方案。第1期跟进主渠道=微信群打卡（App 当天页「📋 复制打卡」按钮一键复制文案）。
- 技术母体：页面结构/视觉照 `E:\AI项目\谦灵启蒙App\`（森林手账 v7：文楷手写体+五色纸卡+缝线卡片）；同步代码参照 `E:\AI项目\五人打卡\`（Contents API + SHA 重试，代码已就位但无 token 时静默失败=当前状态）。

## 文件结构

| 文件 | 作用 |
|---|---|
| `index.html` | 买家端外壳 + 全部 CSS + 三视图容器 + 启动/同步接线 + 「点我更新」徽标 |
| `ui.js` | 渲染（本周/当天/全年地图）+ initApp 交互（打卡、复制打卡、历史返回）。UMD |
| `logic.js` | 数据层：家庭码解析、覆盖层合并、周号计算、本地打卡、云同步代码（无token时静默）。UMD |
| `base/content.json` | 48周内容库（sync-content.js 从谦灵App拷贝；只经工具改，不手改） |
| `families.json` | 注册表 `{teacherCode, families:[{code,childName,age?,startDate,package,joinedAt}]}` |
| `checkins.json` | 打卡数据 `{families:{code:{checkins:{周号字符串:[天号]}}}}`（当前由本地工具维护，买家端暂不写） |
| `families/<code>.json` | 家庭覆盖层：`{childName,startDate,overrides,themeSwaps,weeks}`（schema 与 logic.js mergeContent 对齐） |
| `teacher.html` + `dash-logic.js` | 教师端面板：家庭卡片+红黄标记+近4周明细；纯逻辑在 dash-logic.js（UMD，可测） |
| `tools/` | `make-family.js`（问卷JSON→覆盖层+家庭码+注册表）、`sync-content.js`、`gen-report.js`（周报）、`fetch-fonts.js`（字体子集）、`make-icons.py` |
| `tests/` | node:test 46 条：logic / ui / sync / dashboard / tools |
| `sw.js` / `version.json` / `manifest.json` | PWA 套件与版本（页面代码改动时三者同步 bump） |

## Mei 操作手册

### 加新家庭
1. 家长填完问卷（腾讯问卷/HTML）→ Claude 把答案转写成问卷JSON（字段：childName/age/startDate/interests/englishLevel/startWeek/themeSwaps/customWeeks）
2. `node tools/make-family.js 问卷.json --add`（校验：customWeeks 结构与键一致、startWeek 1-48）
3. 把 `https://meiyanjie1990.github.io/mei-qimeng/?f=<家庭码>` 发给家长
4. push

### 每周出课
谦灵App 出第N周细化版后：`node tools/sync-content.js` → 测试 → push（买家内容自动更新，页面版本不用动）

### 看家长打卡
- 第1期：微信群看打卡（家长用 App「复制打卡」发群里）
- 教师端：`teacher.html?t=<老师码>` 看名单与 App 端数据（5分钟自动刷新，无权限页不轮询）

### 周报
`node tools/gen-report.js [--family CODE]` → 按输出发私聊

### 发布规则
1. `node --test` 全绿（Windows 若 spawn EPERM 就逐个 `node tests/x.test.js`）
2. 页面代码改动 → version.json +1、sw.js CACHE_NAME 同步（v3→v4…）、logic.js 里三处缓存名同步
3. push → `gh run list --repo meiyanjie1990/mei-qimeng` 看 workflow → `curl -s -o /dev/null -w "%{http_code}" https://meiyanjie1990.github.io/mei-qimeng/` 返回 200
4. 纯内容更新（base/content.json、families/）不用动版本号

### 隐私说明（对家长/对外口径）
- 线上只有小名、家庭码、年龄、起始日、打卡天数——没有手机号、微信、真名、地址
- 打卡在家长自己手机里，云端同步暂未开启

### 已知待办
- 🔴 云同步安全方案（评估 Cloudflare Worker 中转；上线后买家端自动同步+教师端红黄标记才有真实数据）
- 🟡 App 图标仍是谦灵的「灵」字占位——Mei 定稿后重跑 `python tools/make-icons.py`
- 🟡 教师端周算法与 logic.js 刻意重复（dash-logic 自包含），改动要两边同步
