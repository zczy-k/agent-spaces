module.exports = {
  nodes: [
    {
      type: 'create_window',
      label: '创建窗口',
      category: '窗口管理',
      icon: 'AppWindow',
      description: '创建独立浏览器窗口',
      properties: [
        { key: 'url', label: 'URL', type: 'text', required: true, tooltip: '要打开的 URL' },
        { key: 'title', label: '窗口标题', type: 'text', tooltip: '窗口标题' },
        { key: 'width', label: '宽度', type: 'number', default: 1280, tooltip: '窗口宽度' },
        { key: 'height', label: '高度', type: 'number', default: 800, tooltip: '窗口高度' },
      ],
      outputs: [
        { key: 'windowId', type: 'number' },
        { key: 'webContentsId', type: 'number' },
        { key: 'url', type: 'string' },
        { key: 'title', type: 'string' },
      ],
      handler: async (ctx, args) => {
        const result = await ctx.api.createWindow(args)
        return { success: true, message: `窗口已创建: ${result.id}`, data: result }
      },
    },
    {
      type: 'inject_js',
      label: '注入JS代码',
      category: '窗口管理',
      icon: 'Code',
      description: '向指定窗口注入并执行JavaScript代码',
      properties: [
        { key: 'windowId', label: '窗口 ID', type: 'number', required: true, tooltip: '目标窗口 ID' },
        { key: 'code', label: 'JS代码', type: 'code', required: true, tooltip: '要注入的 JavaScript 代码' },
      ],
      outputs: [
        { key: 'result', type: 'string' },
      ],
      handler: async (ctx, args) => {
        const result = await ctx.api.injectJS(args.windowId, args.code)
        return { success: true, message: 'JS代码已执行', data: { result } }
      },
    },
    {
      type: 'navigate_window',
      label: '导航窗口',
      category: '窗口管理',
      icon: 'Navigation',
      description: '导航独立窗口到指定 URL',
      properties: [
        { key: 'windowId', label: '窗口 ID', type: 'number', required: true, tooltip: '目标窗口 ID' },
        { key: 'url', label: 'URL', type: 'text', required: true, tooltip: '目标 URL' },
      ],
      outputs: [
        { key: 'windowId', type: 'number' },
        { key: 'url', type: 'string' },
      ],
      handler: async (ctx, args) => {
        await ctx.api.navigateWindow(args.windowId, args.url)
        return { success: true, message: `窗口 ${args.windowId} 已导航到 ${args.url}` }
      },
    },
    {
      type: 'close_window',
      label: '关闭窗口',
      category: '窗口管理',
      icon: 'X',
      description: '关闭指定的独立浏览器窗口',
      properties: [
        { key: 'windowId', label: '窗口 ID', type: 'number', required: true, tooltip: '要关闭的窗口 ID' },
      ],
      outputs: [
        { key: 'windowId', type: 'number' },
      ],
      handler: async (ctx, args) => {
        await ctx.api.closeWindow(args.windowId)
        return { success: true, message: `窗口 ${args.windowId} 已关闭` }
      },
    },
    {
      type: 'list_windows',
      label: '列出窗口',
      category: '窗口管理',
      icon: 'LayoutList',
      description: '列出所有打开的浏览器窗口',
      properties: [],
      outputs: [
        { key: 'windows', type: 'object', children: [
          { key: 'id', type: 'number' },
          { key: 'title', type: 'string' },
          { key: 'url', type: 'string' },
        ] },
        { key: 'count', type: 'number' },
      ],
      handler: async (ctx) => {
        const windows = await ctx.api.listWindows()
        return { success: true, message: `共 ${windows.length} 个窗口`, data: { windows } }
      },
    },
    {
      type: 'focus_window',
      label: '聚焦窗口',
      category: '窗口管理',
      icon: 'Maximize',
      description: '将指定窗口聚焦到前台',
      properties: [
        { key: 'windowId', label: '窗口 ID', type: 'number', required: true, tooltip: '目标窗口 ID' },
      ],
      outputs: [
        { key: 'windowId', type: 'number' },
      ],
      handler: async (ctx, args) => {
        await ctx.api.focusWindow(args.windowId)
        return { success: true, message: `窗口 ${args.windowId} 已聚焦` }
      },
    },
    {
      type: 'screenshot_window',
      label: '窗口截图',
      category: '窗口管理',
      icon: 'Camera',
      description: '截取独立窗口的页面截图',
      properties: [
        { key: 'windowId', label: '窗口 ID', type: 'number', required: true, tooltip: '目标窗口 ID' },
      ],
      outputs: [
        { key: 'screenshot', type: 'string' },
      ],
      handler: async (ctx, args) => {
        const dataUrl = await ctx.api.screenshotWindow(args.windowId)
        return { success: true, message: '截图完成', data: { screenshot: dataUrl } }
      },
    },
    {
      type: 'get_window_detail',
      label: '窗口详情',
      category: '窗口管理',
      icon: 'Info',
      description: '获取窗口详细信息',
      properties: [
        { key: 'windowId', label: '窗口 ID', type: 'number', required: true, tooltip: '目标窗口 ID' },
      ],
      outputs: [
        { key: 'id', type: 'number' },
        { key: 'title', type: 'string' },
        { key: 'url', type: 'string' },
        { key: 'width', type: 'number' },
        { key: 'height', type: 'number' },
      ],
      handler: async (ctx, args) => {
        const detail = await ctx.api.getWindowDetail(args.windowId)
        return { success: true, message: '窗口详情已获取', data: detail }
      },
    },
  ],
}
