# Skills 导入增强、分组过滤、ZIP 导入、Toggle Switch

## Context

当前 Skills 系统使用扁平 `.md` 文件存储（`~/.agent-spaces-data/skills/foo.md`），需要改为文件夹结构（`skills/foo/SKILL.md`），增加 group 字段、ZIP 导入、导入预览对话框、分组过滤、全局开关。

## 变更概览

| 层 | 文件 | 变更 |
|---|---|---|
| server service | `packages/server/src/services/skill.ts` | 存储格式改为文件夹、加 group/enabled 字段、批量导入、自动迁移 |
| server route | `packages/server/src/routes/skill.ts` | 新增 import-batch 和 toggle 端点 |
| frontend types | `.../skills-dialog/types.ts` | SkillInfo 加 group/enabled |
| new component | `.../skills-dialog/skill-import-dialog.tsx` | 导入预览对话框（checkbox/name/group/折叠预览） |
| frontend list | `.../skills-dialog/skill-list.tsx` | 导入按钮改造（md/文件夹/ZIP）、分组过滤、全局开关 |
| frontend hook | `.../skills-dialog/use-skills-data.ts` | 新增 importBatch/toggleEnabled |
| frontend dialog | `.../skills-dialog.tsx` | 串联新对话框和新 actions |
| i18n | `packages/web/src/locales/{zh,en}.json` | 新增翻译 key |
| dependency | `packages/web/package.json` | 添加 jszip |

---

## 1. 后端：存储格式变更

**文件**: `packages/server/src/services/skill.ts`

### 1.1 类型更新

```typescript
export interface SkillInfo {
  name: string;
  description: string;
  filename: string;   // 保留兼容，指向 SKILL.md
  content: string;
  favorited: boolean;
  enabled: boolean;    // 新增
  group: string;       // 新增
  boundAgents: Array<{ id: string; name: string; avatarUrl?: string }>;
}

interface SkillMeta {
  favorites: string[];
  groups: Record<string, string>;   // skillName -> group
  disabled: string[];                // disabled skill names
}
```

### 1.2 存储格式

```
~/.agent-spaces-data/skills/
  _meta.json          # { favorites, groups, disabled }
  fix-flex-overflow/   # 文件夹名 = skill name
    SKILL.md          # 必须
  tdd-workflow/
    SKILL.md
```

### 1.3 迁移策略

`listSkills()` 首次调用时检测扁平 `.md` 文件，自动迁移为文件夹：
- 读取 `foo.md` -> 创建 `foo/SKILL.md` -> 删除 `foo.md`
- 静默迁移，无需用户操作

### 1.4 新增/修改函数

- `listSkills()` — 扫描文件夹，读取 `SKILL.md`，合并 meta
- `importSkill(filename, content, group?)` — 单文件导入，创建文件夹+SKILL.md
- `importSkillsBatch(items: Array<{name, content, group}>)` — 批量导入
- `toggleEnabled(name)` — 切换 enabled 状态
- `updateSkillContent(name, content)` — 写入 `{name}/SKILL.md`
- `deleteSkill(name)` — 删除整个文件夹 `rmSync(dir, {recursive:true})`
- `checkSkillSync()` / `syncSkills()` — 全局路径改为 `{name}/SKILL.md`，agent 副本路径不变（仍为 `{name}.md`）

### 1.5 Agent 副本兼容

Agent 专属副本保持扁平 `.md` 格式不变（`agent-templates/{agentId}/skills/{name}.md`），sync 时从 `{name}/SKILL.md` 复制到 `{name}.md`。运行时代码无需修改。

---

## 2. 后端：路由更新

**文件**: `packages/server/src/routes/skill.ts`

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/skills/import-batch` | POST | `{ items: [{name, content, group}] }` -> 批量导入 |
| `/api/skills/:name/toggle` | POST | 切换 enabled 状态 |

保留现有 `/api/skills/import`（单文件），兼容旧调用。

---

## 3. 前端：类型更新

**文件**: `packages/web/src/components/sidebar/skills-dialog/types.ts`

```typescript
export interface SkillInfo {
  // ...existing fields
  group: string;
  enabled: boolean;
}

export interface ImportSkillItem {
  id: string;            // 临时 ID
  name: string;          // 编辑后的名称
  group: string;         // 分组名
  content: string;       // md 内容
  selected: boolean;     // 是否导入
  sourceName: string;    // 原始文件名/文件夹名
}
```

---

## 4. 前端：导入预览对话框

**新文件**: `packages/web/src/components/sidebar/skills-dialog/skill-import-dialog.tsx`

使用已有 UI 组件：`Dialog`, `Collapsible`, `Input`, `Button`, `ScrollArea`, `Checkbox`(native)

布局：
```
┌─ 导入技能 ──────────────────────────────┐
│ [分组名称输入框] (默认 = ZIP名或空)       │
│                                          │
│ ☑ [skill-name-1    ] [分组1] ▸           │
│   ┌─ 折叠内容预览 ──────────────────┐    │
│   │ # Skill Title...               │    │
│   └────────────────────────────────┘    │
│ ☑ [skill-name-2    ] [分组2] ▸           │
│                                          │
│              [取消] [确认导入 (3/5)]       │
└──────────────────────────────────────────┘
```

功能：
- 每项可编辑 skill name（默认 = 文件夹名 或 .md 文件名去掉扩展名）
- 每项可编辑 group（默认 = 对话框顶部全局 group 或空）
- checkbox 控制是否导入
- Collapsible 展开查看 md 内容
- 确认时发送 selected items 到后端 import-batch

---

## 5. 前端：skill-list.tsx 改造

**文件**: `packages/web/src/components/sidebar/skills-dialog/skill-list.tsx`

### 5.1 导入按钮改造

Import 按钮改为 DropdownMenu，三个选项：
1. **导入 .md 文件** — `<input accept=".md" multiple>`
2. **导入文件夹** — `<input webkitdirectory>` (仅 Chrome/Edge，其他浏览器隐藏此选项)
3. **导入 ZIP** — `<input accept=".zip">`

选择后：
- .md 文件：`file.text()` -> 构建 ImportSkillItem[]
- 文件夹：读取 `webkitRelativePath` -> 找 SKILL.md 或 .md -> 构建 ImportSkillItem[]
- ZIP：`JSZip.loadAsync(file)` -> 遍历 entries -> 找 SKILL.md 或 .md -> 构建 ImportSkillItem[]，group 默认 = ZIP 文件名

然后打开 SkillImportDialog。

### 5.2 左侧分组过滤

在现有过滤器（全部/收藏/按智能体）下方增加分组过滤区：
```
全部技能
收藏
按智能体
─────────
分组
  ● superpowers
  ● debugging
  ● (无分组)
```

过滤逻辑：`filterGroup` state，为空则不过滤。

### 5.3 右侧全局开关

搜索栏右侧增加 Switch 组件：
```
[🔍 搜索技能...]              [全局开关 ○]
```

Switch 切换所有当前可见 skills 的 enabled 状态：
- ON -> 全部 enabled
- OFF -> 全部 disabled
- 显示当前 enabled/total 计数

### 5.4 技能卡片

在技能卡片中显示 group badge 和 enabled 状态（灰色表示 disabled）。

---

## 6. 前端：Hook 更新

**文件**: `packages/web/src/components/sidebar/skills-dialog/use-skills-data.ts`

新增 actions：
- `importBatch(items: ImportSkillItem[])` — 调用 `/api/skills/import-batch`
- `toggleEnabled(skill)` — 调用 `/api/skills/:name/toggle`
- `toggleAllEnabled(skills, enabled)` — 批量调用 toggleEnabled

---

## 7. 前端：主对话框串联

**文件**: `packages/web/src/components/sidebar/skills-dialog.tsx`

- 新增 `importItems` / `importDialogOpen` state
- Import 按钮选择文件后设置 importItems 并打开 SkillImportDialog
- 确认后调用 actions.importBatch()

---

## 8. i18n 翻译

**文件**: `packages/web/src/locales/{zh,en}.json`

新增 key：
```json
{
  "importFromMd": "导入 .md 文件",
  "importFromFolder": "导入文件夹",
  "importFromZip": "导入 ZIP",
  "importPreviewTitle": "导入预览",
  "importPreviewGroupPlaceholder": "分组名称（可选）",
  "importPreviewNamePlaceholder": "技能名称",
  "importPreviewSelected": "确认导入 ({selected}/{total})",
  "importPreviewEmpty": "没有可导入的内容",
  "filterGroups": "分组",
  "filterNoGroup": "无分组",
  "toggleAll": "全部启用/禁用",
  "enabled": "已启用",
  "disabled": "已禁用"
}
```

---

## 9. 依赖

```bash
cd packages/web && pnpm add jszip
```

---

## 实施顺序

1. 后端 service + route（存储格式、迁移、新端点）
2. 前端 types
3. 前端 SkillImportDialog 组件
4. 前端 skill-list.tsx（导入按钮、分组过滤、开关）
5. 前端 use-skills-data.ts（新 actions）
6. 前端 skills-dialog.tsx（串联）
7. i18n 翻译
8. 安装 jszip 依赖

## 验证

1. 启动 `pnpm dev`，确认现有扁平 .md 技能自动迁移为文件夹
2. 测试导入单个 .md -> 创建文件夹 + SKILL.md
3. 测试导入文件夹 -> 识别 SKILL.md / .md 文件
4. 测试导入 ZIP -> 解压展示预览，ZIP 名默认为 group
5. 确认分组过滤正常工作
6. 确认全局开关可切换所有 skills 的 enabled 状态
7. 确认 Agent sync 仍正常（全局 SKILL.md -> agent {name}.md）
