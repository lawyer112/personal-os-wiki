# SwarmVault 图谱导航设计对 Personal Wiki 可行性验证报告

## 1. 测试环境
- Python: 3.11+
- Personal Wiki: 现有 build_graph_from_records + 模拟数据
- 测试数据集: 3~100 条模拟笔记
- 测试数量: 8 个单元测试 + 性能基准

## 2. 核心结论

**可行。** SwarmVault 的图谱导航（graph query / path / explain）可以完整映射到 Personal Wiki 的现有 graph 层，性能开销极低。

## 3. 映射方案

| SwarmVault CoreGraph | Personal Wiki 对应字段 | 说明 |
|----------------------|----------------------|------|
| node.id | node.id (path) | 笔记路径作为唯一 ID |
| node.label | node.label / title | 笔记标题 |
| node.type | node.kind (note/concept/tag) | 直接映射 |
| node.pageId | node.id (当 kind==note) | 笔记即页面 |
| edge.source / target | link.source / target | 直接映射 |
| edge.relation | link.type (wikilink/tag/related) | 关系类型 |
| edge.confidence | link.score | 相关链接有分数，wikilink 为 1.0 |
| edge.evidenceClass | "extracted"/"inferred" | wikilink=extracted, related=inferred |
| page.id | node.id | 笔记节点即页面 |
| page.path | node.path | 文件路径 |
| page.title | node.title | 笔记标题 |

## 4. 已实现操作

### 4.1 graph query (BFS / DFS traversal)
- 输入：自然语言问题（如 "capture"）
- 过程：
  1. 模糊匹配 seed nodes（按 label、id、page title 打分）
  2. 从 seeds 出发做 BFS/DFS traversal
  3. 收集 visited nodes / edges / pages
- 输出：排序后的 matches、访问路径、摘要
- 性能：100 节点图 < 1ms

### 4.2 graph path (shortest path)
- 输入：起点标签 + 终点标签（支持模糊解析）
- 过程：无权 BFS
- 输出：node 路径、edge 路径、page 列表
- 性能：100 节点图 < 1ms

### 4.3 graph explain (neighborhood)
- 输入：目标节点标签
- 输出：节点属性、直接邻居（含方向/关系/置信度）、所属页面
- 性能：100 节点图 < 1ms

## 5. 与 SwarmVault 的差异

| 功能 | SwarmVault | Personal Wiki PoC | 影响 |
|------|-----------|-------------------|------|
| hyperedges | 支持 | 未映射（数据无此结构） | 低，可后续添加 |
| communities | 支持 | 未映射（数据无此结构） | 低，可后续添加 |
| filtering | 按 relation/type/language/evidence | 仅按 relation 简单过滤 | 中，可扩展 |
| fuzzy semantic match | 支持 | 仅基于字符串匹配 | 中，可接入 embeddings |
| graph cycles / tree merge | 支持 | 未实现 | 低，当前不需要 |

## 6. 集成建议

### 6.1 最小集成（1-2 天）
在 `personal-wiki/api/server.py` 中新增端点：
- `POST /api/graph/query` — BFS/DFS traversal
- `POST /api/graph/path` — shortest path
- `POST /api/graph/explain` — neighborhood

复用现有 `load_graph()` 数据，无需额外存储。

### 6.2 进阶（3-5 天）
- 引入 hyperedges：把笔记的「概念共现」或「项目归属」建模为 hyperedge
- 引入 communities：用简单的标签聚类或连通分量作为 community
- 增强过滤：在 query 中支持 `?relation=wikilink&evidence=extracted`

## 7. 风险与阻塞

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| graph 规模增大到 10k+ 节点 | BFS 可能变慢 | 引入邻接表缓存、限制 budget、使用 DFS 剪枝 |
| 模糊匹配质量 | 中文笔记标题匹配不准 | 引入拼音/分词或 embeddings |
| 并发访问 | server.py 是单线程 | 加锁或把 graph 查询放到独立进程 |

## 8. 结论

SwarmVault 的图谱导航设计对 Personal Wiki **完全可行**。建议先接入最小版本（query/path/explain），再按需扩展 hyperedges 和 communities。

---
*报告生成时间: 2026-06-24 13:24*
*任务: cmqrhygxf001s0jo8hy523haz*