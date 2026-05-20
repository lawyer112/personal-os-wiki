# Final Bug List

日期：2026-05-13

## 已修复

### 1. `npm --prefix personal-os-app run build`：intake Wiki note union 无法收窄

- 现象：Next.js TypeScript 阶段报错，`src/app/api/intake/route.ts` 传给
  `ingestWikiNote()` 的对象无法赋给 `WikiIngestInput`。
- 根因：`wikiIngestSchema` 用 runtime refine 保证 `frontmatter` 或 legacy
  `title` 至少存在，但 TypeScript 只能看到两者都是 optional；route 里直接
  spread 后 union 无法证明合法。
- 修复：在 route 边界新增 `withPersonalOsWikiMetadata()`，按 `frontmatter`
  payload 与 legacy payload 显式收窄后再调用 `ingestWikiNote()`。
- 验证：相关前端测试通过；最终 build 通过。

### 2. `npm --prefix personal-os-app run build`：`submitTask()` 返回 task 为 `unknown`

- 现象：Next.js TypeScript 阶段报错，`src/app/api/tasks/[id]/submit/route.ts`
  无法把 `submitTask()` 的返回值传给 summary 写入 helper。
- 根因：`submitTask()` 内部的 `taskDelegate.update()` 类型声明为
  `Promise<unknown>`，导致调用方丢失提交后 task 的 include 字段形状。
- 修复：在 `personal-os-app/src/lib/agent-tasks.ts` 增加
  `SubmittedTaskRecord`，并让 submit 路径的 `taskDelegate.update()` 返回该类型。
- 验证：相关前端测试通过；最终 build 通过。

## 当前状态

最终完整验证已通过，无剩余 Harden 期阻塞 bug。
