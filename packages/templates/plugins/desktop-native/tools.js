module.exports = {
  tools: [
    {
      name: 'read_clipboard',
      description: '读取系统剪贴板的文本内容。',
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'write_clipboard',
      description: '将文本写入系统剪贴板。',
      input_schema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '要写入剪贴板的文本' },
        },
        required: ['text'],
      },
    },
    {
      name: 'read_clipboard_image',
      description: '读取系统剪贴板的图片，返回 base64 data URL。',
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'write_clipboard_image',
      description: '将 base64 data URL 格式的图片写入系统剪贴板。',
      input_schema: {
        type: 'object',
        properties: {
          dataUrl: { type: 'string', description: 'base64 data URL 格式的图片' },
        },
        required: ['dataUrl'],
      },
    },
    {
      name: 'clear_clipboard',
      description: '清空系统剪贴板内容。',
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'show_notification',
      description: '发送系统桌面通知。',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '通知标题' },
          body: { type: 'string', description: '通知正文' },
          silent: { type: 'boolean', description: '是否静默发送（不播放声音）' },
        },
        required: ['title'],
      },
    },
    {
      name: 'show_item_in_folder',
      description: '在文件管理器中显示指定文件。',
      input_schema: {
        type: 'object',
        properties: {
          fullPath: { type: 'string', description: '文件的完整路径' },
        },
        required: ['fullPath'],
      },
    },
    {
      name: 'open_path',
      description: '用系统默认应用打开文件或文件夹。',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件或文件夹路径' },
        },
        required: ['path'],
      },
    },
    {
      name: 'open_external',
      description: '用系统默认浏览器打开 URL。',
      input_schema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '要打开的 URL 地址' },
        },
        required: ['url'],
      },
    },
    {
      name: 'beep',
      description: '播放系统蜂鸣提示音。',
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'show_open_dialog',
      description: '弹出系统文件选择对话框，返回选中的文件路径列表。',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '对话框标题' },
          filters: { type: 'string', description: 'JSON 数组，文件过滤器，如 [{"name":"图片","extensions":["png","jpg"]}]' },
          properties: { type: 'string', description: 'JSON 数组，对话框选项，如 ["openFile","multiSelections"]' },
        },
      },
    },
    {
      name: 'show_save_dialog',
      description: '弹出系统保存文件对话框，返回保存路径。',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '对话框标题' },
          defaultPath: { type: 'string', description: '默认文件名或路径' },
          filters: { type: 'string', description: 'JSON 数组，文件过滤器' },
        },
      },
    },
    {
      name: 'show_message_box',
      description: '弹出系统消息对话框，返回用户点击的按钮索引。',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '对话框标题' },
          message: { type: 'string', description: '消息内容' },
          type: { type: 'string', description: '图标类型: none/info/warning/error/question' },
          buttons: { type: 'string', description: 'JSON 数组，按钮文字，如 ["确定","取消"]' },
        },
        required: ['title', 'message'],
      },
    },
    {
      name: 'show_error_box',
      description: '弹出系统错误提示框。',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '错误标题' },
          content: { type: 'string', description: '错误内容' },
        },
        required: ['title', 'content'],
      },
    },
  ],

  handler: async (name, args, api) => {
    switch (name) {
      case 'read_clipboard': {
        const text = await api.readClipboardText()
        return { success: true, message: '已读取剪贴板', data: { text } }
      }
      case 'write_clipboard':
        await api.writeClipboardText(args.text)
        return { success: true, message: '已写入剪贴板' }
      case 'read_clipboard_image': {
        const dataUrl = await api.readClipboardImage()
        return { success: true, message: '已读取剪贴板图片', data: { dataUrl } }
      }
      case 'write_clipboard_image':
        await api.writeClipboardImage(args.dataUrl)
        return { success: true, message: '已写入剪贴板图片' }
      case 'clear_clipboard':
        await api.clearClipboard()
        return { success: true, message: '已清空剪贴板' }
      case 'show_notification':
        await api.showNotification(args)
        return { success: true, message: `通知已发送: ${args.title}` }
      case 'show_item_in_folder':
        await api.showItemInFolder(args.fullPath)
        return { success: true, message: `已在文件夹中显示: ${args.fullPath}` }
      case 'open_path':
        await api.openPath(args.path)
        return { success: true, message: `已打开: ${args.path}` }
      case 'open_external':
        await api.openExternal(args.url)
        return { success: true, message: `已打开: ${args.url}` }
      case 'beep':
        await api.beep()
        return { success: true, message: '已播放蜂鸣提示音' }
      case 'show_open_dialog': {
        const opts = {}
        if (args.title) opts.title = args.title
        if (args.filters) opts.filters = JSON.parse(args.filters)
        if (args.properties) opts.properties = JSON.parse(args.properties)
        const filePaths = api.showOpenDialogSync(opts)
        return { success: true, message: filePaths?.length ? `已选择 ${filePaths.length} 个文件` : '未选择文件', data: { filePaths: filePaths || [] } }
      }
      case 'show_save_dialog': {
        const opts = {}
        if (args.title) opts.title = args.title
        if (args.defaultPath) opts.defaultPath = args.defaultPath
        if (args.filters) opts.filters = JSON.parse(args.filters)
        const filePath = api.showSaveDialogSync(opts)
        return { success: true, message: filePath ? `保存路径: ${filePath}` : '未选择路径', data: { filePath: filePath || '' } }
      }
      case 'show_message_box': {
        const opts = { title: args.title, message: args.message, type: args.type || 'none' }
        if (args.buttons) opts.buttons = JSON.parse(args.buttons)
        const response = api.showMessageBoxSync(opts)
        return { success: true, message: `用户点击了按钮 ${response}`, data: { response } }
      }
      case 'show_error_box':
        api.showErrorBox(args.title, args.content)
        return { success: true, message: `错误提示框已显示: ${args.title}` }
      default:
        return { success: false, message: `未知工具: ${name}` }
    }
  },
}
