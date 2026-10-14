# 合集及统一入口 Implementation Plan

**Goal:** 一次安装所选子技能，可选生成独立、中文、可复制调用的合集入口。
**Architecture:** 保留单项导入 API；增加共享快照的批量 API。统一入口由独立模块生成，以相对路径引用子技能；不修改上游文件，不覆盖同名目录。
**Tech Stack:** Electron、CommonJS、Node test、原生 DOM。

- [x] 测试先行：在 tests/collection.test.cjs 构造两个真实技能快照，验证批量安装、子集、名称冲突、已有目录、失败和入口路径。
- [x] src/github-import.cjs 增加 installBatch(token, directory, paths, options)，逐项 inspect/install，整批结束才释放资源；拒绝无效路径和重复名称。
- [x] src/suite.cjs 生成 SKILL.md 和成员清单，入口名称为仓库名称加 suite 与来源短哈希，避免跨仓库冲突。仅全体选中且成功/已存在的成员生成入口；部分失败不生成入口。已有入口若文件完全一致则复用，否则报告不覆盖。
- [x] src/main.cjs、src/preload.cjs 增加批量 IPC，验证忙碌状态、记录安装收据、恢复扫描来源，发送逐项进度。
- [x] src/import-ui.js 添加合集说明、全选/取消、逐项复选、入口选项；批量结果及入口返回列表；保留单项本地导入。
- [x] 执行 node --test tests/*.test.cjs；Electron UI 检查验证选择状态、结果、原有流程。检查截图及打包启动。
- [x] 更新 README，部署至已确认的 D 盘程序目录；仅在验证通过后同步已授权的 GitHub 仓库。

## 规格补充（用户已确认）
整套安装默认创建统一入口；取消任意成员时禁用入口并说明仅完整合集支持。入口不宣称官方，不强迫运行所有成员，不自动获取缺失依赖或扩大任务授权。源仓库已有技能仍保持原样，不猜测其路由语义；额外入口使用唯一名称防止覆盖。入口只保存元信息与相对文件路径，AI 使用时读取对应真实文件。
