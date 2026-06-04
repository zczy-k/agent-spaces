module.exports = {
  nodes: [
    {
      type: 'fetch_text',
      label: '捕获网页内容',
      category: '网络请求',
      icon: 'Globe',
      description: '请求 URL 并返回文本内容（HTML/JSON/纯文本等）',
      properties: [
        { key: 'url', label: 'URL', type: 'text', required: true, tooltip: '目标 URL' },
        { key: 'headers', label: '请求头', type: 'object', tooltip: '自定义请求头（JSON对象）' },
        { key: 'encoding', label: '编码', type: 'text', default: 'utf-8', tooltip: '响应编码' },
        { key: 'timeout', label: '超时(ms)', type: 'number', default: 30000, tooltip: '请求超时时间' },
      ],
      outputs: [
        { key: 'text', type: 'string' },
        { key: 'url', type: 'string' },
      ],
      handler: async (ctx, args) => {
        const text = await ctx.api.fetchText(args.url, {
          headers: args.headers,
          encoding: args.encoding,
          timeout: args.timeout,
        })
        return { success: true, message: `内容已捕获 (${text.length} 字符)`, data: { text, url: args.url } }
      },
    },
    {
      type: 'fetch_buffer',
      label: '下载文件',
      category: '网络请求',
      icon: 'Download',
      description: '下载网络文件并返回 Buffer（图片/音频/二进制等）',
      properties: [
        { key: 'url', label: 'URL', type: 'text', required: true, tooltip: '文件下载地址' },
        { key: 'headers', label: '请求头', type: 'object', tooltip: '自定义请求头（JSON对象）' },
        { key: 'timeout', label: '超时(ms)', type: 'number', default: 60000, tooltip: '下载超时时间' },
      ],
      outputs: [
        { key: 'buffer', type: 'buffer' },
        { key: 'size', type: 'number' },
        { key: 'mimeType', type: 'string' },
        { key: 'url', type: 'string' },
      ],
      handler: async (ctx, args) => {
        const result = await ctx.api.fetchBuffer(args.url, {
          headers: args.headers,
          timeout: args.timeout,
        })
        return {
          success: true,
          message: `文件已下载 (${(result.size / 1024).toFixed(1)} KB)`,
          data: { ...result, url: args.url },
        }
      },
    },
    {
      type: 'fetch_buffers',
      label: '批量下载文件',
      category: '网络请求',
      icon: 'Files',
      description: '批量下载多个网络文件，返回 Buffer 集合',
      properties: [
        { key: 'urls', label: 'URL列表', type: 'object', required: true, tooltip: 'URL数组，如 ["https://...","https://..."]' },
        { key: 'headers', label: '请求头', type: 'object', tooltip: '自定义请求头（JSON对象）' },
        { key: 'timeout', label: '超时(ms)', type: 'number', default: 60000, tooltip: '单个下载超时时间' },
      ],
      outputs: [
        { key: 'results', type: 'object', children: [
          { key: 'url', type: 'string' },
          { key: 'success', type: 'boolean' },
          { key: 'size', type: 'number' },
          { key: 'mimeType', type: 'string' },
          { key: 'error', type: 'string' },
        ] },
        { key: 'total', type: 'number' },
        { key: 'successCount', type: 'number' },
      ],
      handler: async (ctx, args) => {
        const urls = Array.isArray(args.urls) ? args.urls : JSON.parse(args.urls)
        const results = await ctx.api.fetchBuffers(urls, {
          headers: args.headers,
          timeout: args.timeout,
        })
        const successCount = results.filter(r => r.success).length
        return {
          success: true,
          message: `批量下载完成: ${successCount}/${results.length} 成功`,
          data: { results, total: results.length, successCount },
        }
      },
    },
  ],
}
