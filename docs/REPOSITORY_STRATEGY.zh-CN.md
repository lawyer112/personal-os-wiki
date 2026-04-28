# 仓库拆分与开源策略

直接结论：当前阶段先保持 monorepo，不要急着把 Wiki 单独拆成一个仓库。等 OS、Wiki、Agent 协议边界稳定，并且真的有人只想独立使用其中一个组件，再拆。

## 当前推荐仓库形态

```text
personal-os-wiki/
  personal-os-app/
  personal-wiki/
  docs/
  README.md
  README.zh-CN.md
  OPEN_SOURCE_RELEASE.md
```

原因很简单：现在这个项目本质上还是一个整体产品，而不是两个成熟独立库。

- Personal OS intake 会写 Wiki。
- Personal OS context 会召回 Wiki 候选笔记。
- 任务认领协议依赖 Wiki 证据链接。
- 浏览器鉴权 handoff 横跨 OS/Wiki。
- 文档必须解释“碎碎念 -> 知识 -> 任务 -> Agent 执行 -> 复核”完整闭环。

对私有评审仓库来说，monorepo 也更好：别人 clone 一次就能看全，测试和 secret scan 也更直接。

## 什么绝对不能变成公开仓库

不要从这些目录或材料直接建公开仓库：

- 真实 Markdown vault
- runtime data 目录
- 服务器台账
- 真实提醒事项和任务历史
- 截图和日志
- 本地 Agent env 目录
- 含私人上下文的导出包

正确心智模型：

```text
公开仓库 = 可复用引擎
私人机器 = 真实记忆和真实执行状态
```

## 发布阶段

### Phase 0：私有评审

当前就是这个阶段。GitHub 仓库保持 private，让其他 Agent 或可信的人审：

- 能不能构建
- 有没有密钥
- 有没有私人数据
- 文档是否能读懂
- quickstart 是否能跑
- license 怎么选

### Phase 1：公开 monorepo

满足这些条件后再公开：

- 选定 license。
- fresh clone 能按 quickstart 跑起来。
- secret scan 干净。
- demo 数据全是虚构的。
- README 明确说明数据边界。
- 生产 compose 必须显式传 secret。

第一版公开时用 monorepo 最合适，因为用户需要理解完整闭环，而不是只看一个服务。

### Phase 2：按需拆仓

后面如果真的需要，可以拆成：

```text
personal-os-app
personal-wiki
personal-os-agent-protocol
personal-os-examples
```

拆仓条件：

- Personal Wiki 可以脱离 Personal OS 独立安装、独立使用。
- Personal OS 可以支持其他知识库后端。
- API 合约稳定，可以版本化。
- 每个仓库的 CI、Docker、quickstart 都能单独跑。
- 外部贡献者主要只改其中一个组件。

过早拆仓会增加文档成本、版本漂移和安装摩擦。

## Agent 的 Wiki 是否要单独成立仓库

当前不需要。

“给 Agent 的 Wiki”现在不是一个单独产品，而是一层合约和手册：

- Wiki 负责长期 Markdown 知识。
- Personal OS 负责任务、状态、复核。
- `docs/AGENT_GUIDE.zh-CN.md` 告诉 Agent 怎么同时用两边。
- `personal-os-app/docs/HERMES_API.md` 给出具体 API。

如果未来这套 Agent 协议被别的项目复用，再把它拆成 `personal-os-agent-protocol` 这种小仓库就合理。

## 打包规则

公开前必须做到：

- 保留 `.env.example`，删除 `.env`。
- 保留虚构 demo，删除真实数据。
- 保留文档，删除私人 handoff。
- 保留测试，删除生成文件。
- 保留 Docker 示例，但生产环境 secret 必填。
- 保留 localhost 示例，避免私人 hostname、私人域名和内网拓扑。

## 命名建议

可选公开仓库名：

- `personal-os-wiki`
- `agentic-personal-os`
- `local-first-agent-wiki`

不要用让人误会“仓库里包含真实私人 vault”或“这是一个云服务”的名字。

## 决策

第一版公开发布用一个仓库。拆仓是未来扩展动作，不是现在发布的前置条件。
