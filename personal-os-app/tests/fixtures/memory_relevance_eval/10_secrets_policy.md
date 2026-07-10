---
title: 生产部署禁止 demo token 兜底
path: eval/secrets_policy.md
status: active
source_type: user-note
tags: deployment,secrets
concepts: no demo fallback
---
生产部署不能使用 demo token、示例 .env 或隐式 fallback 覆盖真实凭据。读取凭据只能来自运行环境或授权的 Hermes 配置。
