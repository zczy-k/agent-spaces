# Flex 布局中 truncate 不生效的解决方案

## 问题

flex 容器内，子元素 `truncate`（`overflow-hidden text-overflow-ellipsis whitespace-nowrap`）不生效，长文本撑开容器。

## 原因

flex 子项默认 `min-width: auto`，不会收缩到内容宽度以下。即使设了 `min-w-0`，如果父级链上任何一层没有严格约束宽度，文本仍会溢出。

## 解决方案

给包含 truncate 文本的 flex 子项加 `w-0 flex-1`：

```tsx
<div className="flex items-center gap-3">
  <Icon />
  <div className="w-0 flex-1">
    <p className="truncate">{longText}</p>
  </div>
  <Button />
</div>
```

**为什么有效**：`w-0` 强制初始宽度为 0，`flex-1` 再分配剩余空间。flex 算法从 0 开始计算而非从内容宽度开始，truncate 自然生效。

## 无效方案

| 方案 | 为什么不行 |
|------|-----------|
| `min-w-0` + `flex-1` | 依赖父级宽度约束，grid/block 混合布局下不可靠 |
| `overflow-hidden` 加在父容器 | 治标不治本，内容仍然超出只是被裁剪 |
| `overflow-hidden` 加在文本容器 | 同上，且可能裁剪子元素 |

## 规则

flex 行内需要 truncate 的文本区域，一律用 `w-0 flex-1`。
