# Findings & Decisions

## Requirements
- User reports a migration defect from WorkFox in workflow agent execution capability.
- Defective feature: adding input/output fields to nodes.
- Current target: `/Users/Zhuanz/Documents/agent_spaces/packages/server/src/services/builtin-tools/workflow-editor-tools.ts`.
- Failure log: `/Users/Zhuanz/.agent-spaces-data/workflows/743fdc89-3489-4d04-82cd-2f818abec122/chat.json`.
- WorkFox reference: `/Users/Zhuanz/Documents/work_fox/src/lib/agent/tools.ts`.

## Research Findings
- Current `workflow-editor-tools.ts` exposes generic workflow tools: `create_node`, `update_node`, edge operations, batch update, layout, and node definition search/list.
- Current `update_node` shallow-merges `data` only: `data: { ...node.data, ...objectInput(record, 'data') }`.
- There is no dedicated current tool named around adding input/output fields.
- Initial inspection of `/Users/Zhuanz/Documents/work_fox/src/lib/agent/tools.ts` shows browser-agent discovery tooling and `delay`; literal search in that file did not show workflow node input/output field operations.
- Chat log is a JSON array with 2 top-level messages.
- Failure log showed `get_current_workflow` was called with `{ "summarize": "false" }`; previous boolean parsing treated this as default true, so the agent saw only `dataKeys` and not actual `data.inputFields`.
- Agent Spaces and WorkFox variable pickers both use `{{ __inputs__["节点ID"].字段 }}` for node input fields and `{{ __data__["节点ID"].字段 }}` for node outputs.
- Current system prompt only mentioned `__data__` and `context`, which made the start-node input-field path ambiguous for the workflow agent.
- The execution manager resolves `__inputs__` references, so documenting and producing them is runtime-compatible.
- Latest failed log shows `search_node_usage` was called with `{ "name": "minimax_tts" }`; current search ignored `name`, returning all 44 nodes.
- Latest failed log shows `update_node` was first called with `id` instead of `nodeId`, then with `nodeId` but `data` as a JSON string. Current `objectInput` ignored string data, so the tool returned success while dropping the intended `text` update.
- Latest failed log used `{{ __inputs__["node"]["text"] }}` bracket syntax for field access. Runtime currently supports `__inputs__["node"].text` but not bracket field path after the node id.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add `set_node_io_fields` | Gives the agent a focused operation for `data.inputFields` and `data.outputs` instead of relying on generic shallow `update_node` |
| Include summarized input/output fields in summarized workflow | Lets the agent see existing field keys without always fetching full data |
| Teach prompt `__inputs__` syntax | Matches UI and execution runtime behavior |
| Accept common model-generated parameter variants | Avoids silent no-op updates from JSON string data and bracket field paths |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `summarize: "false"` did not return full workflow data | `booleanInput` now accepts string `"true"`/`"false"` |
| No direct field-edit tool | Added `set_node_io_fields` with append/merge/replace modes |
| `update_node` success with no data change | Patch `objectInput` to parse JSON-string objects and accept `id` as node id alias |
| `search_node_usage` ignored `name` | Treat `name` as a keyword/type/label search alias |
| Runtime may not resolve `__inputs__["node"]["text"]` | Normalize bracket field paths in variable resolution |

## Resources
- Current implementation: `packages/server/src/services/builtin-tools/workflow-editor-tools.ts`
- WorkFox reference: `/Users/Zhuanz/Documents/work_fox/src/lib/agent/tools.ts`
- Chat log: `/Users/Zhuanz/.agent-spaces-data/workflows/743fdc89-3489-4d04-82cd-2f818abec122/chat.json`
