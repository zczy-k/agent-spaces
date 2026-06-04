const { createClient, normalizeResult } = require('./shared')

const CONFIG_PREFIX = '{{ __config__["workfox.aliyun-oss"]'

/** 通用配置属性 — 每个节点都包含 */
function configProperties() {
  return [
    { key: 'region', label: 'Region', type: 'text', required: true, tooltip: '如 oss-cn-hangzhou', default: `${CONFIG_PREFIX}["region"]}}` },
    { key: 'accessKeyId', label: 'AccessKey ID', type: 'text', required: true, default: `${CONFIG_PREFIX}["accessKeyId"]}}` },
    { key: 'accessKeySecret', label: 'AccessKey Secret', type: 'text', required: true, default: `${CONFIG_PREFIX}["accessKeySecret"]}}` },
    { key: 'bucket', label: 'Bucket', type: 'text', required: true, default: `${CONFIG_PREFIX}["bucket"]}}` },
    { key: 'endpoint', label: 'Endpoint', type: 'text', tooltip: '自定义 Endpoint，填写后忽略 Region', default: `${CONFIG_PREFIX}["endpoint"]}}` },
    { key: 'secure', label: 'HTTPS', type: 'boolean', default: true },
  ]
}

module.exports = {
  nodes: [
    // ─── 上传文件 ─────────────────────────────
    {
      type: 'oss_upload_file',
      label: 'OSS上传文件',
      category: '阿里云OSS',
      icon: 'Upload',
      description: '将本地文件上传到 OSS',
      properties: [
        { key: 'objectKey', label: 'Object路径', type: 'text', required: true, tooltip: 'OSS 中的完整路径（不含 Bucket 名）' },
        { key: 'filePath', label: '本地文件路径', type: 'text', required: true, tooltip: '本地文件的完整路径' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'name', type: 'string' },
          { key: 'url', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const client = createClient(args)
        ctx.logger.info(`上传文件: ${args.filePath} -> ${args.objectKey}`)
        const result = await client.put(args.objectKey, args.filePath)
        const out = normalizeResult(result)
        ctx.logger.info(`上传成功: ${out.url}`)
        return { success: true, message: `文件已上传: ${out.name}`, data: out }
      },
    },

    // ─── 上传内容 ─────────────────────────────
    {
      type: 'oss_upload_content',
      label: 'OSS上传内容',
      category: '阿里云OSS',
      icon: 'FileUp',
      description: '将字符串或 Buffer 内容上传到 OSS',
      properties: [
        { key: 'objectKey', label: 'Object路径', type: 'text', required: true, tooltip: 'OSS 中的完整路径' },
        { key: 'content', label: '内容', type: 'textarea', required: true, tooltip: '要上传的文本内容' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'name', type: 'string' },
          { key: 'url', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const client = createClient(args)
        ctx.logger.info(`上传内容: -> ${args.objectKey}`)
        const result = await client.put(args.objectKey, Buffer.from(args.content))
        const out = normalizeResult(result)
        return { success: true, message: `内容已上传: ${out.name}`, data: out }
      },
    },

    // ─── 下载文件 ─────────────────────────────
    {
      type: 'oss_download',
      label: 'OSS下载文件',
      category: '阿里云OSS',
      icon: 'Download',
      description: '从 OSS 下载文件到本地',
      properties: [
        { key: 'objectKey', label: 'Object路径', type: 'text', required: true, tooltip: 'OSS 中的完整路径' },
        { key: 'filePath', label: '本地保存路径', type: 'text', required: true, tooltip: '下载到本地的完整路径' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'filePath', type: 'string' },
          { key: 'contentLength', type: 'number' },
        ] },
      ],
      handler: async (ctx, args) => {
        const client = createClient(args)
        ctx.logger.info(`下载文件: ${args.objectKey} -> ${args.filePath}`)
        const result = await client.get(args.objectKey, args.filePath)
        ctx.logger.info(`下载成功, 大小: ${result.res?.headers?.['content-length'] || 'unknown'}`)
        return {
          success: true,
          message: `文件已下载: ${args.objectKey}`,
          data: {
            filePath: args.filePath,
            contentLength: parseInt(result.res?.headers?.['content-length'] || '0', 10),
          },
        }
      },
    },

    // ─── 获取文件内容 ─────────────────────────
    {
      type: 'oss_get_content',
      label: 'OSS获取内容',
      category: '阿里云OSS',
      icon: 'FileText',
      description: '从 OSS 获取文件内容（返回文本）',
      properties: [
        { key: 'objectKey', label: 'Object路径', type: 'text', required: true, tooltip: 'OSS 中的完整路径' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'content', type: 'string' },
          { key: 'contentLength', type: 'number' },
        ] },
      ],
      handler: async (ctx, args) => {
        const client = createClient(args)
        ctx.logger.info(`获取内容: ${args.objectKey}`)
        const result = await client.get(args.objectKey)
        const content = result.content?.toString('utf-8') || ''
        return {
          success: true,
          message: `内容已获取: ${args.objectKey}`,
          data: {
            content,
            contentLength: content.length,
          },
        }
      },
    },

    // ─── 删除文件 ─────────────────────────────
    {
      type: 'oss_delete',
      label: 'OSS删除文件',
      category: '阿里云OSS',
      icon: 'Trash2',
      description: '删除 OSS 上的文件',
      properties: [
        { key: 'objectKey', label: 'Object路径', type: 'text', required: true, tooltip: 'OSS 中的完整路径' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
      ],
      handler: async (ctx, args) => {
        const client = createClient(args)
        ctx.logger.info(`删除文件: ${args.objectKey}`)
        await client.delete(args.objectKey)
        return { success: true, message: `文件已删除: ${args.objectKey}` }
      },
    },

    // ─── 批量删除 ─────────────────────────────
    {
      type: 'oss_delete_multi',
      label: 'OSS批量删除',
      category: '阿里云OSS',
      icon: 'Trash',
      description: '批量删除 OSS 上的多个文件',
      properties: [
        { key: 'objectKeys', label: 'Object路径列表', type: 'textarea', required: true, tooltip: 'JSON 数组格式，如 ["a.txt","b.txt"]' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'deleted', type: 'object', children: [] },
        ] },
      ],
      handler: async (ctx, args) => {
        const client = createClient(args)
        const keys = Array.isArray(args.objectKeys) ? args.objectKeys : JSON.parse(args.objectKeys)
        ctx.logger.info(`批量删除: ${keys.length} 个文件`)
        const result = await client.deleteMulti(keys)
        return {
          success: true,
          message: `批量删除完成，共 ${result.deleted?.length || 0} 个`,
          data: { deleted: result.deleted || [] },
        }
      },
    },

    // ─── 列举文件 ─────────────────────────────
    {
      type: 'oss_list',
      label: 'OSS列举文件',
      category: '阿里云OSS',
      icon: 'FolderSearch',
      description: '列举 Bucket 中指定前缀的文件',
      properties: [
        { key: 'prefix', label: '前缀', type: 'text', tooltip: '只列出以此前缀开头的文件' },
        { key: 'delimiter', label: '分隔符', type: 'text', tooltip: '用于分组（常用 /）' },
        { key: 'maxKeys', label: '最大数量', type: 'number', default: 100, tooltip: '单次返回最大数量' },
        { key: 'marker', label: 'Marker', type: 'text', tooltip: '分页标记，从上次结果的 nextMarker 继续' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'objects', type: 'object', children: [] },
          { key: 'prefixes', type: 'object', children: [] },
          { key: 'nextMarker', type: 'string' },
          { key: 'isTruncated', type: 'boolean' },
        ] },
      ],
      handler: async (ctx, args) => {
        const client = createClient(args)
        const query = {}
        if (args.prefix) query.prefix = args.prefix
        if (args.delimiter) query.delimiter = args.delimiter
        if (args.maxKeys) query['max-keys'] = args.maxKeys
        if (args.marker) query.marker = args.marker

        ctx.logger.info(`列举文件: prefix=${args.prefix || '(全部)'}, max=${args.maxKeys || 100}`)
        const result = await client.list(query)
        const objects = (result.objects || []).map(o => ({
          name: o.name,
          size: o.size,
          lastModified: o.lastModified,
          url: o.url,
        }))
        ctx.logger.info(`共 ${objects.length} 个文件`)
        return {
          success: true,
          message: `共 ${objects.length} 个文件`,
          data: {
            objects,
            prefixes: result.prefixes || [],
            nextMarker: result.nextMarker || '',
            isTruncated: result.isTruncated || false,
          },
        }
      },
    },

    // ─── 签名URL ──────────────────────────────
    {
      type: 'oss_sign_url',
      label: 'OSS签名URL',
      category: '阿里云OSS',
      icon: 'Link',
      description: '生成带签名的临时访问 URL',
      properties: [
        { key: 'objectKey', label: 'Object路径', type: 'text', required: true, tooltip: 'OSS 中的完整路径' },
        { key: 'expires', label: '有效期(秒)', type: 'number', default: 3600, tooltip: 'URL 有效时间，默认 1 小时' },
        { key: 'method', label: 'HTTP方法', type: 'select', default: 'GET', options: [
          { label: 'GET', value: 'GET' },
          { label: 'PUT', value: 'PUT' },
        ], tooltip: '允许的 HTTP 方法' },
        { key: 'responseContentType', label: '响应Content-Type', type: 'text', tooltip: '如 application/octet-stream' },
        { key: 'responseContentDisposition', label: '响应Content-Disposition', type: 'text', tooltip: '如 attachment; filename="file.txt"' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'url', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const client = createClient(args)
        const options = {}
        if (args.responseContentType) options['response-content-type'] = args.responseContentType
        if (args.responseContentDisposition) options['response-content-disposition'] = args.responseContentDisposition

        ctx.logger.info(`生成签名URL: ${args.objectKey}, 有效期 ${args.expires || 3600}s`)
        const url = client.signatureUrl(args.objectKey, {
          expires: args.expires || 3600,
          method: (args.method || 'GET').toUpperCase(),
          ...options,
        })
        return {
          success: true,
          message: `签名URL已生成`,
          data: { url },
        }
      },
    },

    // ─── 复制文件 ─────────────────────────────
    {
      type: 'oss_copy',
      label: 'OSS复制文件',
      category: '阿里云OSS',
      icon: 'Copy',
      description: '在 OSS 内复制文件（支持跨 Bucket）',
      properties: [
        { key: 'objectKey', label: '目标Object路径', type: 'text', required: true, tooltip: '复制后的 OSS 路径' },
        { key: 'sourceKey', label: '源Object路径', type: 'text', required: true, tooltip: '源文件在 OSS 中的路径' },
        { key: 'sourceBucket', label: '源Bucket', type: 'text', tooltip: '源 Bucket 名称（默认同 Bucket）' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'name', type: 'string' },
          { key: 'url', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const client = createClient(args)
        const sourceBucket = args.sourceBucket || args.bucket
        const source = `/${sourceBucket}/${args.sourceKey}`
        ctx.logger.info(`复制文件: ${source} -> ${args.objectKey}`)
        const result = await client.copy(args.objectKey, source)
        const out = normalizeResult(result)
        return { success: true, message: `文件已复制: ${args.sourceKey} -> ${args.objectKey}`, data: out }
      },
    },
  ],
}
