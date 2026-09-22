# 中文工作台依赖安全升级

检查日期：2026-09-22。初次完整工作台回归已通过，但安装锁文件的生产依赖审计报告列出 14 个受影响的依赖节点，因此不能据此直接发布。

## 升级策略

- Next.js 与对应 ESLint 配置升至 16.3.5 系列，不降级 Prisma 主版本，不使用 `npm audit fix --force`。
- 更新 PostCSS、Hono、Sharp、MySQL2、Valibot、Fast URI、Nano ID 与浏览器映射依赖的安全下限；实际解析结果固定在锁文件中。
- `@prisma/config` 目前依赖的 DeepmergeTS 旧版本受递归对象栈耗尽问题影响，单独覆盖为 8.0.0。
- 这个 DeepmergeTS 覆盖是跨主版本升级，不应描述成无行为变化的补丁。上游 8.0.0 改变 Map 的默认深度合并、部分类型名称和原地合并行为。本项目的 Prisma 配置仅使用普通配置记录，仍必须重新验证配置加载、Prisma 生成、迁移、数据库请求与生产构建。
- 不关闭生产依赖审计门禁。只有最终锁文件的测试和审计结果，才代表该提交的验证状态。

## 上游依据

- Next.js Windows 文件系统远程代码执行修复：<https://github.com/advisories/GHSA-p293-qw3h-jr36>。
- Next.js 图像优化 AVIF 依赖修复：<https://github.com/advisories/GHSA-2xp9-vwfh-vxw4>。
- DeepmergeTS 循环对象合并修复：<https://github.com/advisories/GHSA-ggr8-5vv4-36mx>。
- DeepmergeTS 8.0.0 变更说明：<https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0>。
- PostCSS 来源映射文件读取修复：<https://github.com/advisories/GHSA-fxqj-rqcc-2cmp>。

## 验证要求

重新执行单元测试、类型检查、生产构建、数据库迁移、隔离任务协议测试、浏览器回归和 Docker 构建。审计结果保存到工作流产物 `dependency-audit.json`。零已知审计告警不等于系统没有未知漏洞，也不代替身份权限、部署边界或人工安全审阅。
