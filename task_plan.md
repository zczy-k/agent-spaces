# Task Plan

Goal: Build a demo plugin from plugin-guide.md that adds a workflow node with customView support, and make the React/HTML Workflow UI renderer reusable by both workflow-ui preview and plugin customView rendering.

## Phases

1. [complete] Inspect current plugin customView and workflow UI rendering implementation.
2. [complete] Extract reusable React/HTML renderer from workflow-ui-preview.
3. [complete] Wire customView rendering to the shared renderer.
4. [complete] Add demo plugin files and documentation.
5. [complete] Run focused verification.

## Decisions

- Prefer existing plugin architecture in resources/plugins unless inspection shows a different demo location.
- Keep renderer extraction scoped to packages/web components.

## Errors Encountered

None yet.
