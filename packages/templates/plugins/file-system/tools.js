module.exports = {
  tools: [
    {
      name: 'write_text_file',
      description: '将文本内容写入文件，文件不存在时自动创建。',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '目标文件路径' },
          content: { type: 'string', description: '要写入的文本内容' },
          encoding: { type: 'string', description: '文件编码，默认 utf-8' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'write_binary_file',
      description: '将二进制数据写入文件，适用于图片、音频等非文本文件。',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '目标文件路径' },
          data: { type: 'buffer', description: '要写入的二进制数据' },
        },
        required: ['path', 'data'],
      },
    },
    {
      name: 'read_file',
      description: '读取文件内容并返回文本。',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '目标文件路径' },
          encoding: { type: 'string', description: '文件编码，默认 utf-8' },
        },
        required: ['path'],
      },
    },
    {
      name: 'edit_file',
      description: '替换文件中的指定文本内容。',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '目标文件路径' },
          oldContent: { type: 'string', description: '要被替换的原内容' },
          newContent: { type: 'string', description: '替换后的新内容' },
        },
        required: ['path', 'oldContent', 'newContent'],
      },
    },
    {
      name: 'delete_file',
      description: '删除指定文件。',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '要删除的文件路径' },
        },
        required: ['path'],
      },
    },
    {
      name: 'list_files',
      description: '列出目录下的文件和子目录，支持递归和模式匹配。',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '目标目录路径' },
          recursive: { type: 'boolean', description: '是否递归列出子目录' },
          pattern: { type: 'string', description: '文件名匹配模式，如 *.txt' },
        },
        required: ['path'],
      },
    },
    {
      name: 'create_dir',
      description: '创建目录，支持递归创建父目录。',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '要创建的目录路径' },
          recursive: { type: 'boolean', description: '是否递归创建父目录，默认 true' },
        },
        required: ['path'],
      },
    },
    {
      name: 'remove_dir',
      description: '删除目录，可选择递归删除。',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '要删除的目录路径' },
          recursive: { type: 'boolean', description: '是否递归删除所有内容' },
          force: { type: 'boolean', description: '目录不存在时不报错' },
        },
        required: ['path'],
      },
    },
    {
      name: 'file_stat',
      description: '获取文件或目录的详细信息（大小、创建时间、修改时间等）。',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件或目录路径' },
        },
        required: ['path'],
      },
    },
    {
      name: 'rename_file',
      description: '重命名或移动文件/目录。',
      input_schema: {
        type: 'object',
        properties: {
          oldPath: { type: 'string', description: '原路径' },
          newPath: { type: 'string', description: '新路径' },
        },
        required: ['oldPath', 'newPath'],
      },
    },
    {
      name: 'copy_file',
      description: '复制文件到新路径。',
      input_schema: {
        type: 'object',
        properties: {
          src: { type: 'string', description: '源文件路径' },
          dest: { type: 'string', description: '目标文件路径' },
        },
        required: ['src', 'dest'],
      },
    },
  ],

  handler: async (name, args, api) => {
    switch (name) {
      case 'write_text_file':
        await api.writeFile(args.path, args.content, args.encoding)
        return { success: true, message: `文件已写入: ${args.path}`, data: { path: args.path } }
      case 'write_binary_file':
        await api.writeBinaryFile(args.path, args.data)
        return { success: true, message: `二进制文件已写入: ${args.path}`, data: { path: args.path } }
      case 'read_file': {
        const content = await api.readFile(args.path, args.encoding)
        return { success: true, message: `文件已读取: ${args.path}`, data: { content, path: args.path } }
      }
      case 'edit_file':
        await api.editFile(args.path, args.oldContent, args.newContent)
        return { success: true, message: `文件已编辑: ${args.path}`, data: { path: args.path } }
      case 'delete_file':
        await api.deleteFile(args.path)
        return { success: true, message: `文件已删除: ${args.path}` }
      case 'list_files': {
        const files = await api.listFiles(args.path, { recursive: args.recursive, pattern: args.pattern })
        return { success: true, message: `共 ${files.length} 个条目`, data: { files } }
      }
      case 'create_dir':
        await api.createDir(args.path, { recursive: args.recursive })
        return { success: true, message: `目录已创建: ${args.path}` }
      case 'remove_dir':
        await api.removeDir(args.path, { recursive: args.recursive, force: args.force })
        return { success: true, message: `目录已删除: ${args.path}` }
      case 'file_stat': {
        const stat = await api.stat(args.path)
        return { success: true, message: '文件信息已获取', data: stat }
      }
      case 'rename_file':
        await api.rename(args.oldPath, args.newPath)
        return { success: true, message: `已重命名: ${args.oldPath} → ${args.newPath}` }
      case 'copy_file':
        await api.copyFile(args.src, args.dest)
        return { success: true, message: `文件已复制: ${args.src} → ${args.dest}` }
      default:
        return { success: false, message: `未知工具: ${name}` }
    }
  },
}
