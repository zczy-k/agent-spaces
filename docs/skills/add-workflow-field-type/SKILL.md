---
name: add-workflow-field-type
description: Add or change workflow OutputField custom types, input modes, native form configuration, and execution dialog rendering in this repository. Use when updating packages/shared/src/types/workflow.ts, workflow field editors, workflow-properties-utils, or workflow-execution-input-dialog.tsx for a new workflow input/output field type such as select, tag-driven options, file variants, or other native form controls.
---

# Add Workflow Field Type

## Overview

Use this skill to add a workflow field type end to end without leaving schema, editor normalization, configuration UI, runtime input rendering, and i18n out of sync.

Prefer the smallest schema extension that supports the requested behavior. Do not add future-facing field metadata unless the current UI and runtime need it.

## Workflow

1. Identify the target field model.
   - Start at `packages/shared/src/types/workflow.ts`.
   - For workflow start inputs, outputs, and variables, extend `OutputField`.
   - Add a new literal to `OutputField['type']` only when it represents a real runtime value type or input control.
   - Add companion metadata only when the editor/runtime consumes it. Example: `options?: string[]` for a `select` control.

2. Update field type utilities.
   - Update `FIELD_TYPES` in `packages/web/src/components/workflow/workflow-properties-utils.ts`.
   - Update helper predicates only when the new type belongs to an existing family.
   - Preserve new metadata in `getOutputFields`; otherwise saved workflow data will be dropped when the editor normalizes fields.
   - Keep parsing/stringifying behavior narrow. Do not treat a type as array, file, or media unless its runtime value has that shape.

3. Update the field editor.
   - Main file: `packages/web/src/components/workflow/workflow-fields-output.tsx`.
   - Keep the existing compact layout: small controls, stable heights, no large cards.
   - If the field needs a configuration mode, store it on `OutputField`, for example `inputMode?: 'variable' | 'native'`.
   - Put mode buttons beside the value/config control, matching the existing property variable-mode button pattern from `workflow-properties-list.tsx`.
   - When a type switch makes metadata invalid, clear that metadata in `updateField`. Example: clear `options` when the type is no longer `select`.
   - When a type switch requires metadata, initialize it there. Example: set `options = []` when switching to `select`.

4. Use existing common controls.
   - Reuse repo components instead of creating local one-offs.
   - For tag-like option editing, use `packages/web/src/components/common/tag-input.tsx`.
   - If the surrounding editor uses compact sizing, pass a sizing class such as `className="h-6 text-[11px]"` through the reused component rather than duplicating a component.
   - If the reused component does not accept the needed styling prop, extend it minimally and preserve existing defaults.

5. Update execution input rendering.
   - Main file: `packages/web/src/components/workflow/workflow-execution-input-dialog.tsx`.
   - Render native controls from the same `OutputField` metadata used by the editor.
   - Keep parsing in `parseInputValue` consistent with submitted runtime values.
   - For select-like controls, submit the selected string unless requirements specify a different value shape.
   - Preserve file upload handling and saved-value restoration behavior.

6. Update i18n.
   - Add labels/placeholders/tooltips to both:
     - `packages/web/src/locales/zh/workflows.json`
     - `packages/web/src/locales/en/workflows.json`
   - Reuse the nearest existing namespace, usually `workflows.outputFields`.

7. Review affected call sites.
   - Search for `OutputField`, `FIELD_TYPES`, `isArrayOutputFieldType`, `isFileOutputFieldType`, and `ExecutionInputFields`.
   - Check nested field editors, array property editors, and execution dialogs.
   - Do not change unrelated node property types unless the request explicitly includes node property configuration.

## Select Type Pattern

Use this pattern when adding a `select` workflow field:

```ts
export interface OutputField {
  type: 'string' | 'number' | 'boolean' | 'object' | 'file' | 'select' | 'any'
  inputMode?: 'variable' | 'native'
  options?: string[]
}
```

Editor behavior:

- `inputMode !== 'native'`: render the existing variable-aware input.
- `inputMode === 'native' && type === 'select'`: render `TagInput` to edit `options`.
- When switching away from `select`, remove `options`.
- When switching to `select`, initialize `options` to `[]`.

Runtime behavior:

- `inputMode === 'native' && type === 'select'`: render the UI `Select` using `field.options`.
- Submit the selected option string.
- Fall back to the normal text input when the field is not using native select mode.

## Validation Checklist

Before finishing, inspect the diff for these invariants:

- Shared `OutputField` type includes every new persisted field.
- `FIELD_TYPES` includes the new type exactly once.
- `getOutputFields` preserves all new metadata.
- Invalid metadata is cleared on type changes.
- Editor and execution dialog read the same metadata.
- Chinese and English workflow locale files both contain new keys.
- Existing file, array, object, and variable-picker flows remain unchanged.

Report any validation commands not run. If following repository instructions that ask the user to test manually, provide concrete manual steps instead of running the app test suite.
