# react-resizable-panels 尺寸单位问题

## 背景

项目使用 `react-resizable-panels@4.11.1`。该版本中，`Panel` 的 `defaultSize`、`minSize`、`maxSize` 支持多种单位，但数字值会被解释为 `px`，不是百分比。

```tsx
<ResizablePanel defaultSize={25} minSize={15} />
```

上面的写法表示 `25px` 和 `15px`，会导致面板初始比例或最小尺寸异常。

## 正确写法

如果目标是百分比，应使用字符串百分比：

```tsx
<ResizablePanel defaultSize="25%" minSize="15%" />
```

`ResizablePanelGroup` 的 `defaultLayout` 和 `onLayoutChange` 仍使用 `Layout` 对象，值是数字百分比：

```json
{"sidebar":18,"terminal":82}
```

## 本次修复

- Git 面板：将左右面板尺寸 props 改为百分比字符串，并为面板添加稳定 `id`。
- Terminal 面板：将命令侧栏和终端面板尺寸 props 改为百分比字符串，并为终端内容面板添加稳定 `id`。
- 持久化布局读取时校验范围，过滤旧版本或异常的 `_r_*` 自动生成 key。

## 后续约定

使用 `react-resizable-panels` 时：

- `Panel` 尺寸 props 需要百分比时使用 `"25%"` 这种字符串。
- `Layout` 持久化值保持数字百分比对象。
- 每个可持久化面板都应提供稳定 `id`。
