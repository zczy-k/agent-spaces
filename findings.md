# Findings & Decisions

## Requirements
- User reports the search node tool differs from WorkFox.
- It cannot search/list the nodes currently allowed in the workflow.
- Target file: `/Users/Zhuanz/Documents/agent_spaces/packages/server/src/services/builtin-tools/workflow-editor-tools.ts`.

## Research Findings
- WorkFox `workflow-tools.ts` describes `list_node_types` as listing "工作流中可用的节点类型列表".
- WorkFox node registry search/list functions combine built-in `allNodeDefinitions` and `pluginNodeDefinitions`.
- Agent Spaces has the same concept in `packages/web/src/lib/workflow-nodes.ts`: built-in `allNodeDefinitions` plus `_pluginNodeDefinitions`.
- Agent Spaces workflow sidebar registers enabled workflow plugin nodes into `_pluginNodeDefinitions`.
- Current workflow agent request in `use-workflow-editor-agent-chat.ts` sends only `allNodeDefinitions`, so workflow editor tools cannot list/search currently enabled plugin nodes.
- Current server `workflow-editor-tools.ts` only searches the `nodeDefinitions` sent by the client, so the missing node list originates from the frontend payload.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Export and use a complete node registry list from `workflow-nodes.ts` | Matches WorkFox behavior and reuses the registry already maintained by the sidebar |
| Keep server tools based on supplied `nodeDefinitions` | The server receives the current workflow/editor state; fixing the payload is the smallest behavioral correction |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Workflow agent sees only built-in nodes | Send built-in + registered plugin node definitions |

## Resources
- Current implementation: `packages/server/src/services/builtin-tools/workflow-editor-tools.ts`
- WorkFox reference: to be located.
