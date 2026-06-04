let _epubParser
async function getEpubParser() {
  if (!_epubParser) _epubParser = await import('@lingo-reader/epub-parser')
  return _epubParser
}

module.exports = {
  tools: [
    {
      name: 'epub_info',
      description: '解析EPUB电子书文件，提取书籍元信息（标题、作者、语言、出版社、描述等）、目录结构（TOC）、章节总数。返回结构化的书籍信息。',
      input_schema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'EPUB文件的绝对路径' },
        },
        required: ['filePath'],
      },
    },
    {
      name: 'epub_chapters',
      description: '解析EPUB电子书文件，加载指定范围的章节内容。返回章节的HTML文本和CSS资源路径。支持分页加载，避免一次性加载过多内容。',
      input_schema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'EPUB文件的绝对路径' },
          start: { type: 'number', description: '起始章节索引（从0开始），默认0' },
          count: { type: 'number', description: '要加载的章节数量，0表示全部，默认1' },
        },
        required: ['filePath'],
      },
    },
  ],

  handler: async (name, args, api) => {
    const { filePath } = args
    if (!filePath) return { success: false, message: 'filePath 不能为空' }

    const { initEpubFile } = await getEpubParser()
    const epub = await initEpubFile(filePath)

    try {
      switch (name) {
        case 'epub_info': {
          const fileInfo = epub.getFileInfo()
          const metadata = epub.getMetadata()
          const toc = epub.getToc()
          const spine = epub.getSpine()
          const guide = epub.getGuide()

          return {
            success: true,
            message: `解析完成: ${metadata.title}`,
            data: {
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
            },
          }
        }

        case 'epub_chapters': {
          const { start = 0, count = 1 } = args
          const spine = epub.getSpine()
          const total = spine.length
          const from = Math.max(0, start)
          const to = count === 0 ? total : Math.min(from + count, total)

          const chapters = []
          for (let i = from; i < to; i++) {
            const item = spine[i]
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

          return {
            success: true,
            message: `加载 ${chapters.length} 章（共 ${total} 章）`,
            data: { total, chapters },
          }
        }

        default:
          return { success: false, message: `未知工具: ${name}` }
      }
    } finally {
      epub.destroy()
    }
  },
}
