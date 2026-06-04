module.exports = {
  nodes: [
    {
      type: 'write_file',
      label: '写入文本文件',
      category: '文件操作',
      icon: 'FilePen',
      description: '将文本内容写入文件（不存在则创建）',
      properties: [
        { key: 'path', label: '文件路径', type: 'text', required: true, tooltip: '目标文件路径' },
        { key: 'content', label: '文件内容', type: 'textarea', required: true, tooltip: '要写入的文本内容' },
        { key: 'encoding', label: '编码', type: 'text', default: 'utf-8', tooltip: '文件编码，默认 utf-8' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'path', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        await ctx.api.writeFile(args.path, args.content, args.encoding)
        return { success: true, message: `文件已写入: ${args.path}`, data: { path: args.path } }
      },
    },
    {
      type: 'write_binary_file',
      label: '写入二进制文件',
      category: '文件操作',
      icon: 'Binary',
      description: '将二进制数据写入文件，适用于图片、音频等非文本文件',
      properties: [
        { key: 'path', label: '文件路径', type: 'text', required: true, tooltip: '目标文件路径' },
        { key: 'data', label: '二进制数据', type: 'buffer', required: true, tooltip: '要写入的二进制数据' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'path', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        await ctx.api.writeBinaryFile(args.path, args.data)
        return { success: true, message: `二进制文件已写入: ${args.path}`, data: { path: args.path } }
      },
    },
    {
      type: 'read_file',
      label: '读取文件',
      category: '文件操作',
      icon: 'FileText',
      description: '读取文件内容',
      properties: [
        { key: 'path', label: '文件路径', type: 'text', required: true, tooltip: '目标文件路径' },
        { key: 'encoding', label: '编码', type: 'text', default: 'utf-8', tooltip: '文件编码' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'content', type: 'string' },
          { key: 'path', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const content = await ctx.api.readFile(args.path, args.encoding)
        return { success: true, message: `文件已读取: ${args.path}`, data: { content, path: args.path } }
      },
    },
    {
      type: 'edit_file',
      label: '编辑文件',
      category: '文件操作',
      icon: 'FileEdit',
      description: '替换文件中的指定内容',
      properties: [
        { key: 'path', label: '文件路径', type: 'text', required: true, tooltip: '目标文件路径' },
        { key: 'oldContent', label: '原内容', type: 'textarea', required: true, tooltip: '要被替换的原内容' },
        { key: 'newContent', label: '新内容', type: 'textarea', required: true, tooltip: '替换后的新内容' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'path', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        await ctx.api.editFile(args.path, args.oldContent, args.newContent)
        return { success: true, message: `文件已编辑: ${args.path}`, data: { path: args.path } }
      },
    },
    {
      type: 'delete_file',
      label: '删除文件',
      category: '文件操作',
      icon: 'Trash2',
      description: '删除指定文件',
      properties: [
        { key: 'path', label: '文件路径', type: 'text', required: true, tooltip: '要删除的文件路径' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'path', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        await ctx.api.deleteFile(args.path)
        return { success: true, message: `文件已删除: ${args.path}`, data: { path: args.path } }
      },
    },
    {
      type: 'list_files',
      label: '枚举文件',
      category: '文件操作',
      icon: 'FolderSearch',
      description: '列出目录下的文件和子目录',
      properties: [
        { key: 'path', label: '目录路径', type: 'text', required: true, tooltip: '目标目录路径' },
        { key: 'recursive', label: '递归', type: 'boolean', default: false, tooltip: '是否递归列出子目录' },
        { key: 'pattern', label: '匹配模式', type: 'text', tooltip: '文件名匹配模式，如 *.txt' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'files', type: 'object', children: [
            { key: 'name', type: 'string' },
            { key: 'path', type: 'string' },
            { key: 'type', type: 'string' },
          ] },
        ] },
      ],
      handler: async (ctx, args) => {
        const files = await ctx.api.listFiles(args.path, { recursive: args.recursive, pattern: args.pattern })
        return { success: true, message: `共 ${files.length} 个条目`, data: { files } }
      },
    },
    {
      type: 'create_dir',
      label: '创建目录',
      category: '目录操作',
      icon: 'FolderPlus',
      description: '创建目录（支持递归创建）',
      properties: [
        { key: 'path', label: '目录路径', type: 'text', required: true, tooltip: '要创建的目录路径' },
        { key: 'recursive', label: '递归创建', type: 'boolean', default: true, tooltip: '是否递归创建父目录' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'path', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        await ctx.api.createDir(args.path, { recursive: args.recursive })
        return { success: true, message: `目录已创建: ${args.path}`, data: { path: args.path } }
      },
    },
    {
      type: 'remove_dir',
      label: '删除目录',
      category: '目录操作',
      icon: 'FolderX',
      description: '删除目录',
      properties: [
        { key: 'path', label: '目录路径', type: 'text', required: true, tooltip: '要删除的目录路径' },
        { key: 'recursive', label: '递归删除', type: 'boolean', default: false, tooltip: '是否递归删除所有内容' },
        { key: 'force', label: '强制删除', type: 'boolean', default: false, tooltip: '目录不存在时不报错' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'path', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        await ctx.api.removeDir(args.path, { recursive: args.recursive, force: args.force })
        return { success: true, message: `目录已删除: ${args.path}`, data: { path: args.path } }
      },
    },
    {
      type: 'file_stat',
      label: '文件信息',
      category: '文件操作',
      icon: 'Info',
      description: '获取文件或目录的详细信息',
      properties: [
        { key: 'path', label: '路径', type: 'text', required: true, tooltip: '文件或目录路径' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'isFile', type: 'boolean' },
          { key: 'isDirectory', type: 'boolean' },
          { key: 'size', type: 'number' },
          { key: 'createdAt', type: 'string' },
          { key: 'modifiedAt', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const stat = await ctx.api.stat(args.path)
        return { success: true, message: `文件信息已获取`, data: stat }
      },
    },
    {
      type: 'rename_file',
      label: '重命名',
      category: '文件操作',
      icon: 'PenLine',
      description: '重命名或移动文件/目录',
      properties: [
        { key: 'oldPath', label: '原路径', type: 'text', required: true, tooltip: '原文件/目录路径' },
        { key: 'newPath', label: '新路径', type: 'text', required: true, tooltip: '新文件/目录路径' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'oldPath', type: 'string' },
          { key: 'newPath', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        await ctx.api.rename(args.oldPath, args.newPath)
        return { success: true, message: `已重命名: ${args.oldPath} → ${args.newPath}`, data: { oldPath: args.oldPath, newPath: args.newPath } }
      },
    },
    {
      type: 'copy_file',
      label: '复制文件',
      category: '文件操作',
      icon: 'Copy',
      description: '复制文件到新路径',
      properties: [
        { key: 'src', label: '源路径', type: 'text', required: true, tooltip: '源文件路径' },
        { key: 'dest', label: '目标路径', type: 'text', required: true, tooltip: '目标文件路径' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'src', type: 'string' },
          { key: 'dest', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        await ctx.api.copyFile(args.src, args.dest)
        return { success: true, message: `文件已复制: ${args.src} → ${args.dest}`, data: { src: args.src, dest: args.dest } }
      },
    },
  ],
}
