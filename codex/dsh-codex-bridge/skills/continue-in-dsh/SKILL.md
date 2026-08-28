---
name: continue-in-dsh
description: Import the current Codex task into DeepSeek Harness once and open it there. Use only for explicit requests such as “在 DSH 继续”, “在dsh继续”, or “Continue in DSH”.
---

# Continue in DSH

When the user explicitly asks to continue the current task in DSH, call `continue_in_dsh` immediately.

1. Pass the current Codex task ID as `codexConversationId`. Also pass the current title and workspace path when available. Never substitute another recent task ID.
2. The tool performs a one-way structured import of the current conversation into DSH and asks the DSH client to open the imported conversation.
3. After the tool succeeds, reply with exactly: `已同步对话到 DSH。`
4. Do not create or render an inline panel. Do not register shared state, monitor DSH, route later user messages, or keep the two conversations synchronized.
5. If the tool reports that the DSH bridge is unavailable, tell the user to start or restart DSH with the migration plugin enabled.

Do not call this tool for ordinary discussion about DSH that is not a handoff request.
