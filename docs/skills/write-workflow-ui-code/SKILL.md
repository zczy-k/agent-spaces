---
name: write-workflow-ui-code
description: Write, edit, or review Agent Spaces Workflow UI project code from a user-provided project path. Use when an external agent needs to work on Workflow UI React or HTML preview projects, including manifest/mainFile handling, src/ file layout, window.AgentSpacesUI host components, plugin tool calls, config/data helpers, and light/dark theme-safe Tailwind styling.
---

# Write Workflow UI Code

## Goal

Use this skill to make an external agent behave like the built-in Workflow UI agent when editing a Workflow UI project on disk.

The user should provide a path to the Workflow UI project. The project root normally contains:

```text
manifest.json
src/
configs/       # optional runtime JSON config files
data/          # optional generated or downloaded data files
```

If the user provides `src/` or a file inside `src/`, normalize to the project root before editing.

## First Steps

1. Resolve and quote the user-provided path.
2. Confirm the root contains `manifest.json` and `src/`.
3. Read `manifest.json` to find `mainFile`; default to `index.jsx` when missing.
4. Read the entry file under `src/`.
5. For non-trivial changes, inspect directly imported local files before editing.
6. If `src/CLAUDE.md` exists, read it before changes and update it after changes when files, architecture, or important decisions changed.

Do not modify files outside the Workflow UI project root unless the user explicitly asks.

## Runtime Model

Workflow UI code runs in the browser preview renderer, not in a normal Vite, Next.js, or Node build.

React mode flow:

```text
JSX source
  -> Babel standalone
  -> CommonJS transform
  -> new Function('React', 'ReactDOM', 'exports', 'require', compiled)
  -> default export rendered with ReactDOM.createRoot()
```

Implications:

- The entry file must export a default React component.
- Local ES module imports are supported between files under `src/`.
- Bare imports only work when the renderer explicitly allowlists them.
- Browser globals such as `window.AgentSpacesUI`, `window.AgentSpaces`, and `window.AgentSpacesAPI` are available in every file.
- Do not assume Node APIs, filesystem APIs, environment variables, or bundler plugins are available in preview code.

## File Layout

Split large Workflow UI projects into multiple files. Avoid putting a whole app into `src/index.jsx`.

Recommended layout:

```text
src/
  index.jsx                  # entry point; export default App
  components/
    Header.jsx
    ParameterPanel.jsx
    ResultsTable.jsx
  hooks/
    usePluginData.js
  utils/
    config.js
    formatters.js
```

Rules:

- Keep each file single-purpose.
- Split components that exceed about 200 lines.
- Use standard local imports: `import Header from "./components/Header"` or `import { formatDate } from "./utils/formatters"`.
- The renderer resolves `.jsx`, `.js`, `.tsx`, `.ts`, and directory `index` files.
- Do not create barrel re-export files that only re-export other files.
- Do not import `window.AgentSpacesUI`, `window.AgentSpaces`, or `window.AgentSpacesAPI`; use them as globals.

## Host UI Components

In React mode, prefer host components from `window.AgentSpacesUI` over hand-written equivalents.

```jsx
const { Button, Card, CardContent, Search, Loader2 } = window.AgentSpacesUI;
```

Lucide React icons are exposed on `window.AgentSpacesUI` by their standard names.

Do not import host components or icons from repository source paths such as `@/components/...`.

If the internal tool `list_agent_spaces_ui_components` is available, call it with the closest category before writing a custom component. Omit `category` only when the full categorized inventory is needed.

Known categories:

- `actions`: buttons, toggles, direct action controls.
- `forms`: inputs, selectors, labels, uploaders, editable fields.
- `layout`: containers, panels, separators, scroll areas, structural primitives.
- `navigation`: tabs, breadcrumbs, menus, pagination, navigation controls.
- `overlays`: dialogs, popovers, tooltips, sheets, drawers, contextual menus.
- `feedback`: alerts, badges, loading states, progress, empty states, status indicators.
- `data-display`: tables, charts, markdown, avatars, structured display components.
- `media`: images, galleries, carousel, media previews.
- `utilities`: miscellaneous helpers exposed by the host UI bundle.
- `uncategorized`: components not mapped to a category.

If `window.AgentSpacesUI` component props or composition are unclear, inspect the host implementation in the Agent Spaces repository, especially `packages/web/src/components/ui` and `packages/web/src/lib/ui-exports.ts`.

`@agent-spaces/ui` is also mapped by the renderer for allowed host UI exports, but destructuring from `window.AgentSpacesUI` is the safest default in preview code.

## Styling Rules

Use Tailwind utility classes through `className` for ordinary styling.

Prefer theme-aware tokens:

- `bg-background`
- `text-foreground`
- `text-muted-foreground`
- `border-border`
- `bg-card`
- `text-card-foreground`
- `bg-primary`
- `text-primary-foreground`

The Workflow UI host already provides the current light/dark theme through the renderer container.

Do not:

- Add an internal theme switcher.
- Force `dark` or `light` classes.
- Override global theme CSS variables such as `--background`, `--foreground`, `--card-*`, or `--popover-*`.
- Hard-code text colors like `text-white`, `text-black`, `text-slate-*`, `text-gray-*`, or one-off hex colors unless they are explicit semantic status states with matching `dark:` variants.
- Hard-code only a background color while letting text inherit unrelated theme tokens.
- Use inline `style` objects or `<style>` blocks for normal UI styling.
- Create a separate CSS file for simple Tailwind styling.

When custom surface, border, or muted text styling is necessary, verify it is readable in both light and dark themes. Prefer semantic tokens; use paired `dark:` utilities only when semantic tokens are insufficient.

When adjusting `window.AgentSpacesUI` components, pass visual changes through `className`.

Small repeated class groups may be local constants when they improve readability.

## Plugin Tools

Preview code should execute enabled plugin tools with:

```js
const result = await window.AgentSpaces.callPluginTool(pluginId, toolName, args);
```

Compatibility aliases exist:

- `window.AgentSpacesAPI.callPluginTool`
- `window.AgentSpacesAPI.executePluginTool`

Prefer `window.AgentSpaces.callPluginTool` in new code.

When internal workflow tools are available:

1. Call `list_plugin_tools` to find enabled plugin tools.
2. Call `get_plugin_tool_detail` before execution to inspect the input schema and output shape.
3. Use `execute_plugin_tool` only for agent-side probing when needed.

In preview code:

- Do not assume business data is on the top-level wrapper.
- If the response is `{ success, result }`, read plugin data from the inner `result`.
- If an input schema property has a `default`, omit that field unless the user needs an override.
- Do not build UI for API keys, tokens, account credentials, or secrets.
- Do not pass credential arguments when plugin default credentials can be injected from plugin config.

## Config And Data Helpers

Use async helpers for project-local persistence.

Config files live under the project `configs/` directory:

```js
const config = await window.AgentSpacesUI.readConfigJson("settings.json");
await window.AgentSpacesUI.writeConfigJson("settings.json", config);
```

For the last submitted selection, prefer:

```js
const last = await window.AgentSpacesUI.readLastSelection();
await window.AgentSpacesUI.writeLastSelection(value);
```

Data files live under the project `data/` directory:

```js
await window.AgentSpacesUI.saveDataFile("result.txt", text);
await window.AgentSpacesUI.downloadFile(url, "remote-file.bin");
```

The same helpers are also available on `window.AgentSpaces` and `window.AgentSpacesAPI` for compatibility.

## HTML Mode

In HTML mode, plain HTML, CSS, and JavaScript are acceptable.

`window.AgentSpacesUI` and `window.AgentSpaces` are still available, but React host components are primarily intended for React mode. Keep HTML mode self-contained and avoid React-only assumptions.

## External Dependencies

Bare imports only work when mapped by the renderer.

Currently supported examples include:

- `react`
- `react-dom`
- `react-dom/client`
- `embla-carousel-react`
- `@agent-spaces/ui`

Do not copy local shims for host dependencies such as carousel, date, or chart libraries into a Workflow UI project. If a dependency is needed and not renderer-allowlisted, ask to update the host renderer or `ui-exports.ts` instead of hiding compatibility code inside the project.

For Embla carousel projects, call `emblaApi.reInit()` after React commits dynamic slide changes, then call `scrollTo()` or read navigation state.

## Implementation Pattern

For a React project:

```jsx
import Header from "./components/Header";

const { Card, CardContent } = window.AgentSpacesUI;

export default function App() {
  return (
    <main className="min-h-full bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
        <Header />
        <Card>
          <CardContent className="p-4">
            {/* UI */}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
```

For plugin calls:

```js
async function runTool() {
  const response = await window.AgentSpaces.callPluginTool(pluginId, toolName, args);
  const data = response && typeof response === "object" && "result" in response
    ? response.result
    : response;
  return data;
}
```

## Validation Checklist

Before finishing, inspect the changed files for these invariants:

- `manifest.json` still points to the intended entry file.
- The entry file exports a default React component in React mode.
- Large code was split into focused files under `components/`, `hooks/`, or `utils/`.
- Local imports are relative and resolve inside `src/`.
- Host UI components and lucide icons come from `window.AgentSpacesUI` or `@agent-spaces/ui`, not host source paths.
- Styling uses Tailwind `className` and theme tokens where practical.
- Light and dark themes remain readable.
- Plugin tool responses are read according to their documented output shape.
- Credentials are not collected, stored, or passed from preview UI unless explicitly required.
- Config writes go to `configs/`; generated/downloaded data goes to `data/`.
- `src/CLAUDE.md` was updated if project structure or decisions changed.

Return concrete manual verification steps for the user, including which page to open, which controls to click, and what result confirms success.
