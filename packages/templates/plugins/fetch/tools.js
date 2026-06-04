module.exports = {
  tools: [
    {
      name: 'fetch_text',
      description: '请求 URL 并返回文本内容，适用于 HTML 页面、API 响应、纯文本等。',
      input_schema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '目标 URL' },
          headers: { type: 'object', description: '自定义请求头' },
          encoding: { type: 'string', description: '响应编码，默认 utf-8' },
          timeout: { type: 'number', description: '超时时间(ms)，默认 30000' },
        },
        required: ['url'],
      },
    },
    {
      name: 'fetch_buffer',
      description: '下载网络文件返回 Buffer，适用于图片、音频、二进制文件等。',
      input_schema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '文件下载地址' },
          headers: { type: 'object', description: '自定义请求头' },
          timeout: { type: 'number', description: '超时时间(ms)，默认 60000' },
        },
        required: ['url'],
      },
    },
    {
      name: 'fetch_buffers',
      description: '批量下载多个网络文件，返回每个文件的 Buffer 和状态。失败的单个文件不影响其他文件。',
      input_schema: {
        type: 'object',
        properties: {
          urls: {
            type: 'array',
            items: { type: 'string' },
            description: 'URL 数组',
          },
          headers: { type: 'object', description: '自定义请求头' },
          timeout: { type: 'number', description: '单个下载超时(ms)，默认 60000' },
        },
        required: ['urls'],
      },
    },
  ],

  handler: async (name, args, api) => {
    switch (name) {
      case 'fetch_text': {
        const text = await api.fetchText(args.url, {
          headers: args.headers,
          encoding: args.encoding,
          timeout: args.timeout,
        })
        return { success: true, message: `内容已捕获 (${text.length} 字符)`, data: { text, url: args.url } }
      }
      case 'fetch_buffer': {
        const result = await api.fetchBuffer(args.url, {
          headers: args.headers,
          timeout: args.timeout,
        })
        return {
          success: true,
          message: `文件已下载 (${(result.size / 1024).toFixed(1)} KB)`,
          data: { ...result, url: args.url },
        }
      }
      case 'fetch_buffers': {
        const urls = Array.isArray(args.urls) ? args.urls : JSON.parse(args.urls)
        const results = await api.fetchBuffers(urls, {
          headers: args.headers,
          timeout: args.timeout,
        })
        const successCount = results.filter(r => r.success).length
        return {
          success: true,
          message: `批量下载完成: ${successCount}/${results.length} 成功`,
          data: { results, total: results.length, successCount },
        }
      }
      default:
        return { success: false, message: `未知工具: ${name}` }
    }
  },
}
