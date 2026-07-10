---
title: Content Workbench 服务边界
path: eval/workbench_boundary.md
status: active
source_type: agent-output
tags: content-workbench,operations
concepts: port 3220,read only mount
---
Content Workbench 独立运行在 3220 端口。Personal OS 只能把 /home/lawyer112/content-workbench-data 只读挂载到 /data/content-workbench，不能把两个 compose 项目合并。
