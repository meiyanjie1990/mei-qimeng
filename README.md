# Mei启蒙 · 买家版App

「Mei的英语启蒙」定制陪跑课程的交付App：家长打开带家庭码的链接，看到自家娃名字和定制周计划，每天15分钟照做、打卡。纯前端 + GitHub Pages，零服务器。

- 线上地址：https://meiyanjie1990.github.io/mei-qimeng/
- 买家入口：`https://meiyanjie1990.github.io/mei-qimeng/?f=<家庭码>`（家庭码由 `tools/make-family.js` 生成，只发给对应家长）
- 教师端：`https://meiyanjie1990.github.io/mei-qimeng/teacher.html?t=<老师码>`（老师码在 families.json 的 teacherCode）

## 打卡与跟进（第1期方案）

- 家长打卡存在自己手机本地（localStorage），换设备不迁移
- **打卡云同步暂未接入**（安全方案设计中——前端拿 GitHub 写钥匙等于公开，正在评估云端中转方案）；当前老师跟进的主渠道是**微信群打卡**：App 当天页有「复制打卡」按钮，点一下复制「豆豆」第3周·第2天打卡✅，粘到群里即可
- 教师端面板当前用于：家庭名单、按起始日算出的当前周、App 端没有的数据（红黄掉队标记基于群打卡由老师自行判断）

## 工具

| 命令 | 作用 |
|---|---|
| `node tools/make-family.js <问卷JSON> [--add]` | 生成家庭覆盖层 families/<code>.json；--add 同时登记注册表 |
| `node tools/sync-content.js` | 从谦灵App 拷贝最新 48 周内容到 base/content.json |
| `node tools/gen-report.js [--family CODE]` | 从 checkins.json 生成周报 markdown |
| `node tools/fetch-fonts.js` | 内容出现新字后重抓字体子集 |
| `node --test` | 全量测试（46 条） |

## 隐私与安全

- 线上数据只有小名、家庭码、年龄、起始日、打卡周与天数——不含手机号、微信、真名、地址
- 老师码门禁是"防君子"级别（静态站点，前端校验可绕过），面板只展示上述低敏数据
- families.json / checkins.json 目前由 Mei 本地工具写入后 push 上线
