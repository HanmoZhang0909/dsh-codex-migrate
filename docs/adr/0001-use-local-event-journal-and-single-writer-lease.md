# ADR-0001：使用本机事件日志和单写租约

## Status

Accepted（2026-08-26）

## Context

Codex 与 DSH 的原生会话格式、加载方式和生命周期不同。共享会话需要双向更新、
离线恢复和幂等重试，但不能让两端同时推进后静默覆盖。项目是本机个人工作流，
不需要引入远程数据库或分布式基础设施。

## Decision

- 使用本机 loopback bridge 作为唯一协调点。
- 使用追加式 JSONL 事件日志保存规范事件，并原子更新物化状态 JSON。
- 每条共享会话使用带心跳和过期时间的单写租约。
- 同步事件携带 baseRevision、eventId 和幂等键。
- baseRevision 分歧时进入 conflict，用户选择唯一规范版本。
- 内部日志保留恢复材料，但主界面只展示一条规范会话。

## Consequences

### Positive

- 不依赖本机编译数据库，符合当前 Node/ESM 插件打包方式。
- 可以从日志重建状态，并安全处理重试、离线和进程退出。
- 单写规则简单明确，避免对异构消息格式做不可靠自动合并。

### Negative

- 需要日志压缩与快照，防止 JSONL 无限增长。
- 用户必须处理极少发生的真实冲突。
- 租约和接管流程必须覆盖进程崩溃与时钟偏差。

### Neutral

- 被放弃版本仍可能存在于内部恢复日志，但不是活跃会话。

## Alternatives Considered

- **直接互相改写两端会话文件**：拒绝，缺少幂等、恢复和冲突边界。
- **last-write-wins**：拒绝，会静默丢失较慢一端的工作。
- **CRDT/自动语义合并**：拒绝，消息、工具调用和重新生成语义难以安全合并。
- **SQLite/Neo4j 作为强制存储**：拒绝，增加安装和本机依赖；可在未来作为可选后端。

## References

- `docs/plans/2026-08-26-bidirectional-conversation-bridge-design.md`

