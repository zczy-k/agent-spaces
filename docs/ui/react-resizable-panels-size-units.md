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