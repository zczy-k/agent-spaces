module.exports = {
  tools: [
    {
      name: 'create_window',
      description: '创建独立浏览器窗口并加载指定 URL。返回窗口 ID 和 webContentsId。',
      input_schema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '要打开的 URL' },
          title: { type: 'string', description: '窗口标题' },
          width: { type: 'number', description: '窗口宽度，默认 1280' },
          height: { type: 'number', description: '窗口高度，默认 800' },
        },
        required: ['url'],
      },
    },
    {
      name: 'inject_js',
      description: '向指定窗口注入并执行 JavaScript 代码，返回执行结果。',
      input_schema: {
        type: 'object',
        properties: {
          windowId: { type: 'number', description: '目标窗口 ID' },
          code: { type: 'string', description: '要注入的 JavaScript 代码' },
        },
        required: ['windowId', 'code'],
      },
    },
    {
      name: 'navigate_window',
      description: '导航指定窗口到新 URL。',
      input_schema: {
        type: 'object',
        properties: {
          windowId: { type: 'number', description: '目标窗口 ID' },
          url: { type: 'string', description: '目标 URL' },
        },
        required: ['windowId', 'url'],
      },
    },
    {
      name: 'close_window',
      description: '关闭指定的浏览器窗口。',
      input_schema: {
        type: 'object',
        properties: {
          windowId: { type: 'number', description: '要关闭的窗口 ID' },
        },
        required: ['windowId'],
      },
    },
    {
      name: 'list_windows',
      description: '列出所有打开的浏览器窗口及其 ID、标题、URL。',
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'focus_window',
      description: '将指定窗口聚焦到前台。',
      input_schema: {
        type: 'object',
        properties: {
          windowId: { type: 'number', description: '目标窗口 ID' },
        },
        required: ['windowId'],
      },
    },
    {
      name: 'screenshot_window',
      description: '截取指定窗口的页面截图，返回 base64 data URL。',
      input_schema: {
        type: 'object',
        properties: {
          windowId: { type: 'number', description: '目标窗口 ID' },
        },
        required: ['windowId'],
      },
    },
    {
      name: 'get_window_detail',
      description: '获取窗口详细信息，包括标题、URL、尺寸、位置等。',
      input_schema: {
        type: 'object',
        properties: {
          windowId: { type: 'number', description: '目标窗口 ID' },
        },
        required: ['windowId'],
      },
    },
  ],

  handler: async (name, args, api) => {
    switch (name) {
      case 'create_window': {
        const result = await api.createWindow(args)
        return { success: true, message: `窗口已创建: ${result.id}`, data: result }
      }
      case 'inject_js': {
        const result = await api.injectJS(args.windowId, args.code)
        return { success: true, message: 'JS代码已执行', data: { result } }
      }
      case 'navigate_window':
        await api.navigateWindow(args.windowId, args.url)
        return { success: true, message: `窗口已导航到 ${args.url}` }
      case 'close_window':
        await api.closeWindow(args.windowId)
        return { success: true, message: `窗口 ${args.windowId} 已关闭` }
      case 'list_windows': {
        const windows = await api.listWindows()
        return { success: true, message: `共 ${windows.length} 个窗口`, data: { windows } }
      }
      case 'focus_window':
        await api.focusWindow(args.windowId)
        return { success: true, message: `窗口 ${args.windowId} 已聚焦` }
      case 'screenshot_window': {
        const screenshot = await api.screenshotWindow(args.windowId)
        return { success: true, message: '截图完成', data: { screenshot } }
      }
      case 'get_window_detail': {
        const detail = await api.getWindowDetail(args.windowId)
        return { success: true, message: '窗口详情已获取', data: detail }
      }
      default:
        return { success: false, message: `未知工具: ${name}` }
    }
  },
}
