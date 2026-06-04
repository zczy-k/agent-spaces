module.exports = {
  nodes: [
    {
      type: 'read_clipboard',
      label: '读取剪贴板',
      category: '桌面原生',
      icon: 'Clipboard',
      description: '读取系统剪贴板的文本内容',
      properties: [],
      outputs: [
        { key: 'text', type: 'string' },
      ],
      handler: async (ctx) => {
        const text = await ctx.api.readClipboardText()
        return { success: true, message: '已读取剪贴板', data: { text } }
      },
    },
    {
      type: 'write_clipboard',
      label: '写入剪贴板',
      category: '桌面原生',
      icon: 'ClipboardCopy',
      description: '将文本写入系统剪贴板',
      properties: [
        { key: 'text', label: '文本内容', type: 'text', required: true, tooltip: '要写入剪贴板的文本' },
      ],
      outputs: [],
      handler: async (ctx, args) => {
        await ctx.api.writeClipboardText(args.text)
        return { success: true, message: '已写入剪贴板' }
      },
    },
    {
      type: 'read_clipboard_image',
      label: '读取剪贴板图片',
      category: '桌面原生',
      icon: 'Image',
      description: '读取系统剪贴板的图片，返回 base64 data URL',
      properties: [],
      outputs: [
        { key: 'dataUrl', type: 'string' },
      ],
      handler: async (ctx) => {
        const dataUrl = await ctx.api.readClipboardImage()
        return { success: true, message: '已读取剪贴板图片', data: { dataUrl } }
      },
    },
    {
      type: 'write_clipboard_image',
      label: '写入剪贴板图片',
      category: '桌面原生',
      icon: 'ImagePlus',
      description: '将图片写入系统剪贴板',
      properties: [
        { key: 'dataUrl', label: '图片数据', type: 'text', required: true, tooltip: 'base64 data URL 格式的图片' },
      ],
      outputs: [],
      handler: async (ctx, args) => {
        await ctx.api.writeClipboardImage(args.dataUrl)
        return { success: true, message: '已写入剪贴板图片' }
      },
    },
    {
      type: 'clear_clipboard',
      label: '清空剪贴板',
      category: '桌面原生',
      icon: 'ClipboardX',
      description: '清空系统剪贴板内容',
      properties: [],
      outputs: [],
      handler: async (ctx) => {
        await ctx.api.clearClipboard()
        return { success: true, message: '已清空剪贴板' }
      },
    },
    {
      type: 'show_notification',
      label: '发送通知',
      category: '桌面原生',
      icon: 'Bell',
      description: '发送系统桌面通知',
      properties: [
        { key: 'title', label: '标题', type: 'text', required: true, tooltip: '通知标题' },
        { key: 'body', label: '内容', type: 'text', tooltip: '通知正文' },
        { key: 'silent', label: '静默', type: 'checkbox', default: false, tooltip: '是否静默发送（不播放声音）' },
      ],
      outputs: [],
      handler: async (ctx, args) => {
        await ctx.api.showNotification(args)
        return { success: true, message: `通知已发送: ${args.title}` }
      },
    },
    {
      type: 'show_item_in_folder',
      label: '在文件夹中显示',
      category: '桌面原生',
      icon: 'FolderSearch',
      description: '在文件管理器中显示指定文件',
      properties: [
        { key: 'fullPath', label: '文件路径', type: 'text', required: true, tooltip: '文件的完整路径' },
      ],
      outputs: [],
      handler: async (ctx, args) => {
        await ctx.api.showItemInFolder(args.fullPath)
        return { success: true, message: `已在文件夹中显示: ${args.fullPath}` }
      },
    },
    {
      type: 'open_path',
      label: '打开路径',
      category: '桌面原生',
      icon: 'FolderOpen',
      description: '用系统默认应用打开文件或文件夹',
      properties: [
        { key: 'path', label: '路径', type: 'text', required: true, tooltip: '文件或文件夹路径' },
      ],
      outputs: [],
      handler: async (ctx, args) => {
        await ctx.api.openPath(args.path)
        return { success: true, message: `已打开: ${args.path}` }
      },
    },
    {
      type: 'open_external',
      label: '打开外部链接',
      category: '桌面原生',
      icon: 'ExternalLink',
      description: '用系统默认浏览器打开 URL',
      properties: [
        { key: 'url', label: 'URL', type: 'text', required: true, tooltip: '要打开的 URL 地址' },
      ],
      outputs: [],
      handler: async (ctx, args) => {
        await ctx.api.openExternal(args.url)
        return { success: true, message: `已打开: ${args.url}` }
      },
    },
    {
      type: 'beep',
      label: '系统蜂鸣',
      category: '桌面原生',
      icon: 'Volume2',
      description: '播放系统蜂鸣提示音',
      properties: [],
      outputs: [],
      handler: async (ctx) => {
        await ctx.api.beep()
        return { success: true, message: '已播放蜂鸣提示音' }
      },
    },
    {
      type: 'show_open_dialog',
      label: '打开文件对话框',
      category: '桌面原生',
      icon: 'FileSearch',
      description: '弹出系统文件选择对话框，返回选中的文件路径',
      properties: [
        { key: 'title', label: '标题', type: 'text', tooltip: '对话框标题' },
        { key: 'filters', label: '文件过滤器', type: 'text', tooltip: 'JSON 数组，如 [{"name":"图片","extensions":["png","jpg"]}]' },
        { key: 'properties', label: '选项', type: 'text', tooltip: 'JSON 数组，如 ["openFile","multiSelections"]' },
      ],
      outputs: [
        { key: 'filePaths', type: 'object' },
      ],
      handler: async (ctx, args) => {
        const opts = {}
        if (args.title) opts.title = args.title
        if (args.filters) opts.filters = JSON.parse(args.filters)
        if (args.properties) opts.properties = JSON.parse(args.properties)
        const filePaths = ctx.api.showOpenDialogSync(opts)
        return { success: true, message: filePaths?.length ? `已选择 ${filePaths.length} 个文件` : '未选择文件', data: { filePaths: filePaths || [] } }
      },
    },
    {
      type: 'show_save_dialog',
      label: '保存文件对话框',
      category: '桌面原生',
      icon: 'FileDown',
      description: '弹出系统保存文件对话框，返回保存路径',
      properties: [
        { key: 'title', label: '标题', type: 'text', tooltip: '对话框标题' },
        { key: 'defaultPath', label: '默认路径', type: 'text', tooltip: '默认文件名或路径' },
        { key: 'filters', label: '文件过滤器', type: 'text', tooltip: 'JSON 数组，如 [{"name":"文本","extensions":["txt"]}]' },
      ],
      outputs: [
        { key: 'filePath', type: 'string' },
      ],
      handler: async (ctx, args) => {
        const opts = {}
        if (args.title) opts.title = args.title
        if (args.defaultPath) opts.defaultPath = args.defaultPath
        if (args.filters) opts.filters = JSON.parse(args.filters)
        const filePath = ctx.api.showSaveDialogSync(opts)
        return { success: true, message: filePath ? `保存路径: ${filePath}` : '未选择路径', data: { filePath: filePath || '' } }
      },
    },
    {
      type: 'show_message_box',
      label: '消息对话框',
      category: '桌面原生',
      icon: 'MessageSquare',
      description: '弹出系统消息对话框',
      properties: [
        { key: 'title', label: '标题', type: 'text', required: true, tooltip: '对话框标题' },
        { key: 'message', label: '消息', type: 'text', required: true, tooltip: '消息内容' },
        { key: 'type', label: '类型', type: 'select', default: 'none', tooltip: '对话框图标类型', options: ['none', 'info', 'warning', 'error', 'question'] },
        { key: 'buttons', label: '按钮', type: 'text', tooltip: 'JSON 数组，如 ["确定","取消"]' },
      ],
      outputs: [
        { key: 'response', type: 'number' },
      ],
      handler: async (ctx, args) => {
        const opts = { title: args.title, message: args.message, type: args.type || 'none' }
        if (args.buttons) opts.buttons = JSON.parse(args.buttons)
        const response = ctx.api.showMessageBoxSync(opts)
        return { success: true, message: `用户点击了按钮 ${response}`, data: { response } }
      },
    },
    {
      type: 'show_error_box',
      label: '错误提示框',
      category: '桌面原生',
      icon: 'AlertTriangle',
      description: '弹出系统错误提示框',
      properties: [
        { key: 'title', label: '标题', type: 'text', required: true, tooltip: '错误标题' },
        { key: 'content', label: '内容', type: 'text', required: true, tooltip: '错误内容' },
      ],
      outputs: [],
      handler: async (ctx, args) => {
        ctx.api.showErrorBox(args.title, args.content)
        return { success: true, message: `错误提示框已显示: ${args.title}` }
      },
    },
  ],
}
