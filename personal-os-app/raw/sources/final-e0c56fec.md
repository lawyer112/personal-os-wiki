AgentRun context pack 自动归档 v0 已完成部署。

完成项目：
1. 新增 scripts/archive-agent-run-context-pack.mjs，可从 .agent-runs/<task-id>/ 自动生成包含 task_id、gate、diff、测试、部署、残余风险的 Wiki note
2. 修复 taskUpdateSchema partial PATCH 默认值回填导致 priority/executionMode 被重置的生产回归
3. 部署到 6.37：Docker build + up 成功，生产健康检查通过
4. 已在 Wiki 中创建测试 note，/api/intake 返回 201

残余风险：无。回滚路径已备份至 /data/archive/personal-os-wiki/releases/8ade72d/.deploy-backups/20260623T172517Z。
