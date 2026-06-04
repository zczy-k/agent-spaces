let _epubParser
async function getEpubParser() {
  if (!_epubParser) _epubParser = await import('@lingo-reader/epub-parser')
  return _epubParser
}

module.exports = {
  nodes: [
    {
      type: 'epub_info',
      label: 'EPUB书籍信息',
      category: 'EPUB解析',
      icon: 'BookOpen',
      description: '解析EPUB文件，提取书籍元信息（标题、作者、语言、出版社等）和目录结构',
      properties: [
        { key: 'filePath', label: 'EPUB文件路径', type: 'text', required: true, tooltip: 'EPUB文件的绝对路径' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'fileInfo', type: 'object', children: [] },
          { key: 'metadata', type: 'object', children: [] },
          { key: 'toc', type: 'object', children: [] },
          { key: 'spineCount', type: 'number' },
          { key: 'guide', type: 'object', children: [] },
        ] },
      ],
      handler: async (ctx, args) => {
        const { filePath } = args
        if (!filePath) throw new Error('filePath 不能为空')

        ctx.logger.info(`解析EPUB文件: ${filePath}`)
        const { initEpubFile } = await getEpubParser()
        const epub = await initEpubFile(filePath)

        try {
          const fileInfo = epub.getFileInfo()
          const metadata = epub.getMetadata()
          const toc = epub.getToc()
          const spine = epub.getSpine()
          const guide = epub.getGuide()

          const result = {
            fileInfo,
            metadata: {
              title: metadata.title,
              language: metadata.language,
              description: metadata.description,
              publisher: metadata.publisher,
              rights: metadata.rights,
              date: metadata.date,
              creator: metadata.creator?.map(c => c.contributor),
              subject: metadata.subject?.map(s => s.subject),
            },
            toc: toc.map(item => ({
              label: item.label,
              href: item.href,
              id: item.id,
              playOrder: item.playOrder,
              children: item.children,
            })),
            spineCount: spine.length,
            spine: spine.map(item => ({
              id: item.id,
              href: item.href,
              linear: item.linear,
            })),
            guide,
          }

          ctx.logger.info(`解析完成: "${result.metadata.title}", 共 ${result.spineCount} 章`)
          return { success: true, message: `解析完成: ${result.metadata.title}`, data: result }
        } finally {
          epub.destroy()
        }
      },
    },
    {
      type: 'epub_chapters',
      label: 'EPUB章节内容',
      category: 'EPUB解析',
      icon: 'FileText',
      description: '解析EPUB文件，返回指定范围的章节内容（HTML文本和CSS）',
      properties: [
        { key: 'filePath', label: 'EPUB文件路径', type: 'text', required: true, tooltip: 'EPUB文件的绝对路径' },
        { key: 'start', label: '起始章节', type: 'number', default: 0, tooltip: '从0开始的章节索引' },
        { key: 'count', label: '章节数量', type: 'number', default: 1, tooltip: '要加载的章节数量，0表示全部' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'total', type: 'number' },
          { key: 'chapters', type: 'object', children: [] },
        ] },
      ],
      handler: async (ctx, args) => {
        const { filePath, start = 0, count = 1 } = args
        if (!filePath) throw new Error('filePath 不能为空')

        ctx.logger.info(`加载章节: ${filePath}, start=${start}, count=${count}`)
        const { initEpubFile } = await getEpubParser()
        const epub = await initEpubFile(filePath)

        try {
          const spine = epub.getSpine()
          const total = spine.length

          const from = Math.max(0, start)
          const to = count === 0 ? total : Math.min(from + count, total)

          const chapters = []
          for (let i = from; i < to; i++) {
            const item = spine[i]
            ctx.logger.info(`加载第 ${i} 章: ${item.id}`)
            const chapter = await epub.loadChapter(item.id)
            chapters.push({
              index: i,
              id: item.id,
              href: item.href,
              linear: item.linear,
              html: chapter?.html || '',
              css: chapter?.css || [],
            })
          }

          ctx.logger.info(`加载完成: ${chapters.length}/${total} 章`)
          return {
            success: true,
            message: `加载 ${chapters.length} 章（共 ${total} 章）`,
            data: { total, chapters },
          }
        } finally {
          epub.destroy()
        }
      },
    },
  ],
}
