# i18n 实施计划 — 第 1 波：基础设施

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 next-intl Client-Only 国际化基础设施，并在 settings-dialog 中试点验证语言切换功能。

**Architecture:** LocaleProvider 包裹 NextIntlClientProvider，通过 React Context 提供 locale state 和 setLocale 切换函数，语言偏好存储在 localStorage。翻译文件为单文件 en.json / zh.json，按 namespace 分区。

**Tech Stack:** next-intl, React Context, localStorage, TypeScript

**Spec:** `docs/superpowers/specs/2026-05-06-i18n-design.md`

---

## Task 1: 安装 next-intl 依赖

**Files:**
- Modify: `packages/web/package.json`

- [ ] **Step 1: 安装 next-intl**

```bash
cd packages/web && pnpm add next-intl
```

- [ ] **Step 2: 验证安装成功**

```bash
cd packages/web && pnpm ls next-intl
```

Expected: 显示 next-intl 版本号

- [ ] **Step 3: Commit**

```bash
git add packages/web/package.json packages/web/pnpm-lock.yaml
git commit -m "chore(web): add next-intl dependency for i18n support"
```

---

## Task 2: 创建翻译文件骨架（common + settings namespace）

**Files:**
- Create: `packages/web/src/locales/en.json`
- Create: `packages/web/src/locales/zh.json`

先创建基础骨架，仅包含 common 和 settings namespace。后续 Task 会逐个添加其他 namespace。

- [ ] **Step 1: 创建 en.json**

```json
{
  "common": {
    "save": "Save",
    "saved": "Saved",
    "cancel": "Cancel",
    "delete": "Delete",
    "confirm": "Confirm",
    "search": "Search",
    "loading": "Loading...",
    "noData": "No data",
    "upload": "Upload",
    "remove": "Remove",
    "add": "Add",
    "edit": "Edit",
    "open": "Open",
    "close": "Close",
    "back": "Back",
    "next": "Next",
    "retry": "Retry",
    "error": "Error",
    "success": "Success",
    "manage": "Manage",
    "active": "Active",
    "name": "Name",
    "description": "Description",
    "status": "Status",
    "actions": "Actions",
    "copy": "Copy",
    "copied": "Copied",
    "create": "Create"
  },
  "settings": {
    "title": "Settings",
    "description": "Customize your workspace appearance",
    "userAvatar": "User Avatar",
    "theme": "Theme",
    "themeLight": "Light",
    "themeDark": "Dark",
    "themeSystem": "System",
    "language": "Language",
    "languageZh": "中文",
    "languageEn": "English",
    "security": "Security",
    "newSecretPlaceholder": "New secret key (leave empty to remove)",
    "redirecting": "Redirecting to login..."
  }
}
```

- [ ] **Step 2: 创建 zh.json**

```json
{
  "common": {
    "save": "保存",
    "saved": "已保存",
    "cancel": "取消",
    "delete": "删除",
    "confirm": "确认",
    "search": "搜索",
    "loading": "加载中...",
    "noData": "暂无数据",
    "upload": "上传",
    "remove": "移除",
    "add": "添加",
    "edit": "编辑",
    "open": "打开",
    "close": "关闭",
    "back": "返回",
    "next": "下一步",
    "retry": "重试",
    "error": "错误",
    "success": "成功",
    "manage": "管理",
    "active": "活跃",
    "name": "名称",
    "description": "描述",
    "status": "状态",
    "actions": "操作",
    "copy": "复制",
    "copied": "已复制",
    "create": "创建"
  },
  "settings": {
    "title": "设置",
    "description": "自定义工作空间外观",
    "userAvatar": "用户头像",
    "theme": "主题",
    "themeLight": "浅色",
    "themeDark": "深色",
    "themeSystem": "跟随系统",
    "language": "语言",
    "languageZh": "中文",
    "languageEn": "English",
    "security": "安全",
    "newSecretPlaceholder": "新的密钥（留空则移除）",
    "redirecting": "正在跳转到登录页..."
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/locales/
git commit -m "feat(web): add en/zh translation files with common and settings namespaces"
```

---

## Task 3: 创建 LocaleProvider

**Files:**
- Create: `packages/web/src/components/locale-provider.tsx`

参考 ThemeProvider 的 `useSyncExternalStore` 模式实现健壮的 localStorage 读取。

- [ ] **Step 1: 创建 locale-provider.tsx**

```typescript
'use client';

import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/locales/en.json';
import zh from '@/locales/zh.json';

const STORAGE_KEY = 'agent-spaces-locale';
const DEFAULT_LOCALE = 'zh' as const;

const messagesMap = { en, zh } as const;
export type Locale = keyof typeof messagesMap;

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});

export function useLocale() {
  return useContext(LocaleContext);
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getSnapshot(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'en' || saved === 'zh') return saved;
  return DEFAULT_LOCALE;
}

function getServerSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLocale = useCallback((newLocale: Locale) => {
    localStorage.setItem(STORAGE_KEY, newLocale);
    document.documentElement.lang = newLocale === 'zh' ? 'zh-CN' : 'en';
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={messagesMap[locale]}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译通过**

```bash
cd packages/web && pnpm exec tsc --noEmit --pretty 2>&1 | head -20
```

Expected: 无错误（可能有一些不相关的 warning）

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/components/locale-provider.tsx
git commit -m "feat(web): add LocaleProvider with useSyncExternalStore pattern"
```

---

## Task 4: 集成 LocaleProvider 到 layout.tsx

**Files:**
- Modify: `packages/web/src/app/layout.tsx:46-60`

- [ ] **Step 1: 在 ThemeProvider 内侧包裹 LocaleProvider**

在 `layout.tsx` 中：
1. 添加 import: `import { LocaleProvider } from "@/components/locale-provider";`
2. 在 ThemeProvider 内侧、AuthGuard 外侧包裹 LocaleProvider

```typescript
// layout.tsx 修改后的 import 区域新增:
import { LocaleProvider } from "@/components/locale-provider";

// 修改 body 内容为:
<body className="h-full overflow-hidden font-sans">
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <LocaleProvider>
      <AuthGuard>
        <AppShell>{children}</AppShell>
        <Toaster richColors position="bottom-right" />
      </AuthGuard>
    </LocaleProvider>
  </ThemeProvider>
</body>
```

- [ ] **Step 2: 验证 dev 启动正常**

```bash
cd packages/web && timeout 15 pnpm dev 2>&1 | head -20
```

Expected: 编译成功，无 i18n 相关错误

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/app/layout.tsx
git commit -m "feat(web): integrate LocaleProvider into root layout"
```

---

## Task 5: 改造 settings-dialog.tsx（试点验证）

**Files:**
- Modify: `packages/web/src/components/sidebar/settings-dialog.tsx`

这是试点组件，验证整个 i18n 链路正常工作。

- [ ] **Step 1: 添加 import 和 useTranslations 调用**

在文件顶部 import 区域添加：

```typescript
import { useTranslations } from 'next-intl';
import { useLocale, type Locale } from '@/components/locale-provider';
import { Languages } from 'lucide-react';
```

- [ ] **Step 2: 在组件函数内部添加 hooks**

在 `DashboardSidebar` 组件函数内，`const { theme, setTheme } = useTheme();` 之后添加：

```typescript
const t = useTranslations('settings');
const tc = useTranslations('common');
const { locale, setLocale } = useLocale();
```

- [ ] **Step 3: 替换 THEME_OPTIONS 为国际化版本**

将常量 THEME_OPTIONS 替换为组件内的变量（因为需要 t 函数）：

```typescript
// 删除文件顶部的 THEME_OPTIONS 常量
// 在组件函数内部添加:
const themeOptions = [
  { value: "light", label: t("themeLight"), icon: Sun },
  { value: "dark", label: t("themeDark"), icon: Moon },
  { value: "system", label: t("themeSystem"), icon: Monitor },
] as const;
```

- [ ] **Step 4: 替换所有硬编码文本**

将以下硬编码文本替换为 t() 调用：

| 原文 | 替换为 |
|------|--------|
| `Settings` | `{t('title')}` |
| `Customize your workspace appearance` | `{t('description')}` |
| `User Avatar` | `{t('userAvatar')}` |
| `Upload` | `{tc('upload')}` |
| `Remove` | `{tc('remove')}` |
| `Theme` | `{t('theme')}` |
| `THEME_OPTIONS.map` | `themeOptions.map` |
| `Security` | `{t('security')}` |
| `New secret key (leave empty to remove)` | `{t('newSecretPlaceholder')}` |
| `{secretSaved ? "Saved" : "Save"}` | `{secretSaved ? tc('saved') : tc('save')}` |
| `Redirecting to login...` | `{t('redirecting')}` |

- [ ] **Step 5: 在 Theme 选择器后添加 Language 选择器**

在 Theme 的 `</div>` 和 Security 的 `<div>` 之间插入：

```tsx
<div>
  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5 block">
    {t('language')}
  </label>
  <div className="grid grid-cols-2 gap-2">
    {([
      { value: 'zh' as Locale, label: t('languageZh') },
      { value: 'en' as Locale, label: t('languageEn') },
    ]).map(({ value, label }) => (
      <button
        key={value}
        type="button"
        onClick={() => setLocale(value)}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/50",
          locale === value && "border-primary bg-primary/5 text-primary",
        )}
      >
        <Languages className="size-4" />
        <span className="text-xs font-medium">{label}</span>
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 6: 验证构建**

```bash
cd packages/web && pnpm build 2>&1 | tail -20
```

Expected: 构建成功

- [ ] **Step 7: 手动验证功能**

启动 dev 服务器，在浏览器中：
1. 打开 Settings 对话框
2. 确认显示中文（默认 zh）
3. 点击 English 切换到英文
4. 确认所有文本即时切换
5. 刷新页面，确认语言偏好保持
6. 切换回中文，确认正常

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/components/sidebar/settings-dialog.tsx
git commit -m "feat(web): i18n settings-dialog with language switcher pilot"
```

---

## 验证清单

完成所有 Task 后，确认：

- [ ] `pnpm build` 通过
- [ ] settings-dialog 中英文切换正常
- [ ] 刷新页面后语言偏好保持
- [ ] 无 console 错误
- [ ] Theme 切换不受影响
- [ ] 其他页面无回归
