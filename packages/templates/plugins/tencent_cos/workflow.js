const { createClient, getBucketParams, getPublicUrl } = require('./shared')

const CONFIG_PREFIX = '{{ __config__["workfox.tencent-cos"]'

function configProperties() {
  return [
    { key: 'secretId', label: 'SecretId', type: 'text', required: true, default: `${CONFIG_PREFIX}["secretId"]}}` },
    { key: 'secretKey', label: 'SecretKey', type: 'text', required: true, default: `${CONFIG_PREFIX}["secretKey"]}}` },
    { key: 'bucket', label: 'Bucket', type: 'text', required: true, tooltip: '格式: bucket-appid', default: `${CONFIG_PREFIX}["bucket"]}}` },
    { key: 'region', label: 'Region', type: 'text', required: true, tooltip: '如 ap-guangzhou', default: `${CONFIG_PREFIX}["region"]}}` },
  ]
}

module.exports = {
  nodes: [
    // ─── 上传文件 ─────────────────────────────
    {
      type: 'cos_upload_file',
      label: 'COS上传文件',
      category: '腾讯云COS',
      icon: 'Upload',
      description: '将本地文件上传到 COS',
      properties: [
        { key: 'key', label: 'Object路径', type: 'text', required: true, tooltip: 'COS 中的完整路径' },
        { key: 'filePath', label: '本地文件路径', type: 'text', required: true, tooltip: '本地文件的完整路径' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'Key', type: 'string' },
          { key: 'ETag', type: 'string' },
          { key: 'Location', type: 'string' },
          { key: 'url', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const cos = createClient(args)
        const base = getBucketParams(args)
        ctx.logger.info(`上传文件: ${args.filePath} -> ${args.key}`)
        const result = await cos.sliceUploadFile({
          ...base,
          Key: args.key,
          FilePath: args.filePath,
        })
        const url = getPublicUrl(args, args.key)
        ctx.logger.info(`上传成功: ${url}`)
        return {
          success: true,
          message: `文件已上传: ${args.key}`,
          data: { Key: result.Key || args.key, ETag: result.ETag, Location: result.Location, url },
        }
      },
    },

    // ─── 上传内容 ─────────────────────────────
    {
      type: 'cos_upload_content',
      label: 'COS上传内容',
      category: '腾讯云COS',
      icon: 'FileUp',
      description: '将字符串内容上传到 COS',
      properties: [
        { key: 'key', label: 'Object路径', type: 'text', required: true, tooltip: 'COS 中的完整路径' },
        { key: 'content', label: '内容', type: 'textarea', required: true, tooltip: '要上传的文本内容' },
        { key: 'contentType', label: 'Content-Type', type: 'text', tooltip: '如 text/plain、application/json' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'Key', type: 'string' },
          { key: 'ETag', type: 'string' },
          { key: 'Location', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const cos = createClient(args)
        const base = getBucketParams(args)
        ctx.logger.info(`上传内容: -> ${args.key}`)
        const params = {
          ...base,
          Key: args.key,
          Body: args.content,
        }
        if (args.contentType) params.ContentType = args.contentType
        const result = await cos.putObject(params)
        return {
          success: true,
          message: `内容已上传: ${args.key}`,
          data: { Key: result.Key || args.key, ETag: result.ETag, Location: result.Location },
        }
      },
    },

    // ─── 上传 Buffer / Base64 ─────────────────
    {
      type: 'cos_upload_buffer',
      label: 'COS上传二进制',
      category: '腾讯云COS',
      icon: 'Binary',
      description: '将 Base64 编码的二进制数据上传到 COS',
      properties: [
        { key: 'key', label: 'Object路径', type: 'text', required: true, tooltip: 'COS 中的完整路径' },
        { key: 'base64Data', label: 'Base64数据', type: 'textarea', required: true, tooltip: 'Base64 编码的二进制数据' },
        { key: 'contentType', label: 'Content-Type', type: 'text', tooltip: '如 image/jpeg、application/pdf' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'Key', type: 'string' },
          { key: 'ETag', type: 'string' },
          { key: 'Location', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const cos = createClient(args)
        const base = getBucketParams(args)
        ctx.logger.info(`上传二进制: -> ${args.key}`)
        const buffer = Buffer.from(args.base64Data, 'base64')
        const params = {
          ...base,
          Key: args.key,
          Body: buffer,
          ContentLength: buffer.length,
        }
        if (args.contentType) params.ContentType = args.contentType
        const result = await cos.putObject(params)
        return {
          success: true,
          message: `二进制已上传: ${args.key}`,
          data: { Key: result.Key || args.key, ETag: result.ETag, Location: result.Location },
        }
      },
    },

    // ─── 下载文件 ─────────────────────────────
    {
      type: 'cos_download',
      label: 'COS下载文件',
      category: '腾讯云COS',
      icon: 'Download',
      description: '从 COS 下载文件到本地',
      properties: [
        { key: 'key', label: 'Object路径', type: 'text', required: true, tooltip: 'COS 中的完整路径' },
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
        const cos = createClient(args)
        const base = getBucketParams(args)
        ctx.logger.info(`下载文件: ${args.key} -> ${args.filePath}`)
        const result = await cos.getObject({
          ...base,
          Key: args.key,
          Output: args.filePath,
        })
        return {
          success: true,
          message: `文件已下载: ${args.key}`,
          data: {
            filePath: args.filePath,
            contentLength: parseInt(result.headers?.['content-length'] || '0', 10),
          },
        }
      },
    },

    // ─── 获取文件内容 ─────────────────────────
    {
      type: 'cos_get_content',
      label: 'COS获取内容',
      category: '腾讯云COS',
      icon: 'FileText',
      description: '从 COS 获取文件文本内容',
      properties: [
        { key: 'key', label: 'Object路径', type: 'text', required: true, tooltip: 'COS 中的完整路径' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'content', type: 'string' },
          { key: 'contentType', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const cos = createClient(args)
        const base = getBucketParams(args)
        ctx.logger.info(`获取内容: ${args.key}`)
        const result = await cos.getObject({ ...base, Key: args.key })
        const content = result.Body?.toString('utf-8') || ''
        return {
          success: true,
          message: `内容已获取: ${args.key}`,
          data: { content, contentType: result.headers?.['content-type'] || '' },
        }
      },
    },

    // ─── 删除文件 ─────────────────────────────
    {
      type: 'cos_delete',
      label: 'COS删除文件',
      category: '腾讯云COS',
      icon: 'Trash2',
      description: '删除 COS 上的文件',
      properties: [
        { key: 'key', label: 'Object路径', type: 'text', required: true, tooltip: 'COS 中的完整路径' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
      ],
      handler: async (ctx, args) => {
        const cos = createClient(args)
        const base = getBucketParams(args)
        ctx.logger.info(`删除文件: ${args.key}`)
        await cos.deleteObject({ ...base, Key: args.key })
        return { success: true, message: `文件已删除: ${args.key}` }
      },
    },

    // ─── 批量删除 ─────────────────────────────
    {
      type: 'cos_delete_multi',
      label: 'COS批量删除',
      category: '腾讯云COS',
      icon: 'Trash',
      description: '批量删除 COS 上的多个文件',
      properties: [
        { key: 'keys', label: 'Object路径列表', type: 'textarea', required: true, tooltip: 'JSON 数组格式，如 ["a.txt","b.txt"]' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'deleted', type: 'object', children: [] },
          { key: 'errors', type: 'object', children: [] },
        ] },
      ],
      handler: async (ctx, args) => {
        const cos = createClient(args)
        const base = getBucketParams(args)
        const keyList = Array.isArray(args.keys) ? args.keys : JSON.parse(args.keys)
        ctx.logger.info(`批量删除: ${keyList.length} 个文件`)
        const result = await cos.deleteMultipleObject({
          ...base,
          Objects: keyList.map(k => ({ Key: k })),
        })
        return {
          success: true,
          message: `批量删除完成`,
          data: {
            deleted: result.Deleted || [],
            errors: result.Error || [],
          },
        }
      },
    },

    // ─── 列举文件 ─────────────────────────────
    {
      type: 'cos_list',
      label: 'COS列举文件',
      category: '腾讯云COS',
      icon: 'FolderSearch',
      description: '列举存储桶中指定前缀的文件',
      properties: [
        { key: 'prefix', label: '前缀', type: 'text', tooltip: '只列出以此前缀开头的文件' },
        { key: 'delimiter', label: '分隔符', type: 'text', tooltip: '用于分组（常用 /）' },
        { key: 'maxKeys', label: '最大数量', type: 'number', default: 100, tooltip: '单次返回最大数量' },
        { key: 'marker', label: 'Marker', type: 'text', tooltip: '分页标记' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'objects', type: 'object', children: [] },
          { key: 'commonPrefixes', type: 'object', children: [] },
          { key: 'nextMarker', type: 'string' },
          { key: 'isTruncated', type: 'boolean' },
        ] },
      ],
      handler: async (ctx, args) => {
        const cos = createClient(args)
        const base = getBucketParams(args)
        const params = { ...base }
        if (args.prefix) params.Prefix = args.prefix
        if (args.delimiter) params.Delimiter = args.delimiter
        if (args.maxKeys) params.MaxKeys = args.maxKeys
        if (args.marker) params.Marker = args.marker

        ctx.logger.info(`列举文件: prefix=${args.prefix || '(全部)'}, max=${args.maxKeys || 100}`)
        const result = await cos.getBucket(params)
        const objects = (result.Contents || []).map(o => ({
          key: o.Key,
          size: o.Size,
          lastModified: o.LastModified,
          etag: o.ETag,
        }))
        ctx.logger.info(`共 ${objects.length} 个文件`)
        return {
          success: true,
          message: `共 ${objects.length} 个文件`,
          data: {
            objects,
            commonPrefixes: result.CommonPrefixes || [],
            nextMarker: result.NextMarker || '',
            isTruncated: result.IsTruncated === 'true',
          },
        }
      },
    },

    // ─── 签名URL ──────────────────────────────
    {
      type: 'cos_sign_url',
      label: 'COS签名URL',
      category: '腾讯云COS',
      icon: 'Link',
      description: '生成带签名的临时访问 URL',
      properties: [
        { key: 'key', label: 'Object路径', type: 'text', required: true, tooltip: 'COS 中的完整路径' },
        { key: 'expires', label: '有效期(秒)', type: 'number', default: 3600, tooltip: 'URL 有效时间，默认 1 小时' },
        { key: 'method', label: 'HTTP方法', type: 'select', default: 'GET', options: [
          { label: 'GET', value: 'GET' },
          { label: 'PUT', value: 'PUT' },
        ] },
        { key: 'responseContentType', label: '响应Content-Type', type: 'text', tooltip: '强制下载时的 Content-Type' },
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
        const cos = createClient(args)
        const base = getBucketParams(args)
        const params = {
          ...base,
          Key: args.key,
          Sign: true,
          Expires: args.expires || 3600,
          Method: (args.method || 'GET').toUpperCase(),
        }
        if (args.responseContentType) params.ResponseContentType = args.responseContentType
        if (args.responseContentDisposition) params.ResponseContentDisposition = args.responseContentDisposition

        ctx.logger.info(`生成签名URL: ${args.key}, 有效期 ${args.expires || 3600}s`)
        const url = cos.getObjectUrl(params)
        return {
          success: true,
          message: '签名URL已生成',
          data: { url },
        }
      },
    },

    // ─── 复制文件 ─────────────────────────────
    {
      type: 'cos_copy',
      label: 'COS复制文件',
      category: '腾讯云COS',
      icon: 'Copy',
      description: '在 COS 内复制文件（支持跨 Bucket）',
      properties: [
        { key: 'key', label: '目标Object路径', type: 'text', required: true, tooltip: '复制后的 COS 路径' },
        { key: 'sourceKey', label: '源Object路径', type: 'text', required: true, tooltip: '源文件的 COS 路径' },
        { key: 'sourceBucket', label: '源Bucket', type: 'text', tooltip: '源 Bucket 名称（默认同 Bucket）' },
        { key: 'sourceRegion', label: '源Region', type: 'text', tooltip: '源 Bucket 地域（默认同 Region）' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'Key', type: 'string' },
          { key: 'ETag', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const cos = createClient(args)
        const base = getBucketParams(args)
        const sourceBucket = args.sourceBucket || args.bucket
        const sourceRegion = args.sourceRegion || args.region
        const copySource = `${sourceBucket}.cos.${sourceRegion}.myqcloud.com/${encodeURI(args.sourceKey)}`
        ctx.logger.info(`复制文件: ${copySource} -> ${args.key}`)
        const result = await cos.putObjectCopy({
          ...base,
          Key: args.key,
          CopySource: copySource,
        })
        return {
          success: true,
          message: `文件已复制: ${args.sourceKey} -> ${args.key}`,
          data: { Key: args.key, ETag: result.ETag },
        }
      },
    },

    // ─── 检测文件是否存在 ─────────────────────
    {
      type: 'cos_head',
      label: 'COS文件信息',
      category: '腾讯云COS',
      icon: 'Info',
      description: '获取 COS 文件的元信息（大小、类型、最后修改时间等）',
      properties: [
        { key: 'key', label: 'Object路径', type: 'text', required: true, tooltip: 'COS 中的完整路径' },
        ...configProperties(),
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'exists', type: 'boolean' },
          { key: 'size', type: 'number' },
          { key: 'contentType', type: 'string' },
          { key: 'lastModified', type: 'string' },
          { key: 'etag', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const cos = createClient(args)
        const base = getBucketParams(args)
        ctx.logger.info(`获取文件信息: ${args.key}`)
        try {
          const result = await cos.headObject({ ...base, Key: args.key })
          return {
            success: true,
            message: `文件存在: ${args.key}`,
            data: {
              exists: true,
              size: parseInt(result.headers?.['content-length'] || '0', 10),
              contentType: result.headers?.['content-type'] || '',
              lastModified: result.headers?.['last-modified'] || '',
              etag: result.headers?.etag || '',
            },
          }
        } catch (e) {
          if (e.statusCode === 404) {
            return { success: true, message: `文件不存在: ${args.key}`, data: { exists: false } }
          }
          throw e
        }
      },
    },
  ],
}
