# ADR-0002：使用能力驱动的 MCP 记忆提供者

## Status

Accepted（2026-08-26）

## Context

用户可能已经在 Codex 或 DSH 中使用 AgentMemory、官方 MCP Memory Server、Neo4j
Agent Memory、文件式 Memory Skill 或其他实现。把桥绑定到一个 Skill 名称会破坏
现有记忆连续性；每轮全量复制既慢又容易产生重复和冲突。

## Decision

- 按 MCP 工具、资源、订阅和修订能力发现提供者，不只匹配服务器名称。
- 优先复用来源端正在使用的兼容提供者。
- 没有兼容提供者时，由 `dshCodexBridge` 暴露内置 JSONL 记忆提供者。
- 首次注册执行一次 bootstrap；随后使用稳定 memory ID、revision cursor 和 tombstone
  同步增量事件。
- 默认在任务或对话轮结束时提交；显式“记住”立即提交。
- 同一提供者只共享引用和游标，不复制存储。
- global scope 必须显式开启。

## Consequences

### Positive

- 不要求用户放弃已有记忆系统。
- 无额外安装时仍有可用的本机持久记忆。
- 增量同步减少重复、延迟和上下文浪费。
- 提供者可以按能力扩展，而不修改核心同步引擎。

### Negative

- 每个第三方提供者需要适配和契约测试。
- 不支持 revision 的提供者只能使用桥生成的外部游标和内容哈希。
- 记忆删除和同 ID 修改仍需要冲突处理。

### Neutral

- 文件式 Skill 只有主动注册 MCP 能力后才自动复用；桥不会扫描其私有目录。

## Alternatives Considered

- **固定依赖 AgentMemory**：能力完整，但运行时和工具面较重，不适合作为必需依赖。
- **固定依赖官方 Memory Server**：轻量可靠，但无法覆盖高级生命周期和语义检索。
- **Neo4j 作为默认**：图能力强，但数据库和凭据运维不适合默认本机插件。
- **只在注册时复制一次**：后续记忆会分叉。
- **每条消息全量同步**：重复多、延迟高，且会把临时内容误当长期记忆。

## References

- https://github.com/rohitg00/agentmemory
- https://github.com/modelcontextprotocol/servers/tree/main/src/memory
- https://github.com/neo4j-labs/agent-memory
- `docs/plans/2026-08-26-bidirectional-conversation-bridge-design.md`

