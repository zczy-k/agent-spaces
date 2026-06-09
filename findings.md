# Findings

- packages/web/src/components/workflows-ui/workflow-ui-preview.tsx currently owns React Babel rendering and HTML script extraction/rendering internally.
- packages/server/src/services/builtin-tools/workflow-ui-tools.ts exposes list_agent_spaces_ui_components plus plugin tool helpers; it lists UI components from packages/web/src/lib/ui-exports.ts when available.
- packages/web/docs/plugin-guide.md documents server/client plugins and action-based workflow/tool reuse, but current viewed sections do not document customView yet.

- packages/server/src/services/plugin.ts createPluginActions currently maps action fields into workflow nodes but did not show customView/customViewMinSize in the viewed mapping; plugin customView likely needs explicit pass-through.
- Full web lint currently fails on pre-existing errors such as packages/web/src/app/login/rotating-text.tsx:56 dependency expression.
- Web tsc --noEmit currently fails before checking this change because packages/web/src/components/workflow/display-node-views/utils.ts contains JSX-like syntax in a .ts file around lines 145-149.
