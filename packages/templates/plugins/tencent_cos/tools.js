const { createClient, getBucketParams } = require('./shared')

module.exports = {
  tools: [
    {
      name: 'cos_upload',
      description: '上传文件或内容到腾讯云 COS。支持本地文件路径、文本内容、Base64 二进制数据。',
      input_schema: {
        type: 'object',
        properties: {
          secretId: { type: 'string', description: '腾讯云 SecretId' },
          secretKey: { type: 'string', description: '腾讯云 SecretKey' },
          bucket: { type: 'string', description: '存储桶名称（格式: bucket-appid）' },
          region: { type: 'string', description: '地域，如 ap-guangzhou' },
          key: { type: 'string', description: 'COS 目标路径' },
          filePath: { type: 'string', description: '本地文件路径（与 content/base64Data 三选一）' },
          content: { type: 'string', description: '文本内容（与 filePath/base64Data 三选一）' },
          base64Data: { type: 'string', description: 'Base64 编码的二进制数据（与 filePath/content 三选一）' },
          contentType: { type: 'string', description: 'Content-Type，如 image/jpeg' },
        },
        required: ['secretId', 'secretKey', 'bucket', 'region', 'key'],
      },
    },
    {
      name: 'cos_download',
      description: '从腾讯云 COS 下载文件到本地，或获取文件文本内容。',
      input_schema: {
        type: 'object',
        properties: {
          secretId: { type: 'string', description: '腾讯云 SecretId' },
          secretKey: { type: 'string', description: '腾讯云 SecretKey' },
          bucket: { type: 'string', description: '存储桶名称' },
          region: { type: 'string', description: '地域' },
          key: { type: 'string', description: 'COS 文件路径' },
          filePath: { type: 'string', description: '本地保存路径（不填则返回文本内容）' },
        },
        required: ['secretId', 'secretKey', 'bucket', 'region', 'key'],
      },
    },
    {
      name: 'cos_delete',
      description: '删除腾讯云 COS 上的文件，支持单个或批量删除。',
      input_schema: {
        type: 'object',
        properties: {
          secretId: { type: 'string', description: '腾讯云 SecretId' },
          secretKey: { type: 'string', description: '腾讯云 SecretKey' },
          bucket: { type: 'string', description: '存储桶名称' },
          region: { type: 'string', description: '地域' },
          key: { type: 'string', description: '单个文件路径' },
          keys: { type: 'array', items: { type: 'string' }, description: '多个文件路径数组（批量删除）' },
        },
        required: ['secretId', 'secretKey', 'bucket', 'region'],
      },
    },
    {
      name: 'cos_list',
      description: '列举腾讯云 COS 存储桶中的文件。',
      input_schema: {
        type: 'object',
        properties: {
          secretId: { type: 'string', description: '腾讯云 SecretId' },
          secretKey: { type: 'string', description: '腾讯云 SecretKey' },
          bucket: { type: 'string', description: '存储桶名称' },
          region: { type: 'string', description: '地域' },
          prefix: { type: 'string', description: '文件前缀过滤' },
          delimiter: { type: 'string', description: '分隔符（常用 /）' },
          maxKeys: { type: 'number', description: '单次最大返回数量，默认 100' },
          marker: { type: 'string', description: '分页标记' },
        },
        required: ['secretId', 'secretKey', 'bucket', 'region'],
      },
    },
    {
      name: 'cos_sign_url',
      description: '生成腾讯云 COS 文件的临时签名访问 URL。',
      input_schema: {
        type: 'object',
        properties: {
          secretId: { type: 'string', description: '腾讯云 SecretId' },
          secretKey: { type: 'string', description: '腾讯云 SecretKey' },
          bucket: { type: 'string', description: '存储桶名称' },
          region: { type: 'string', description: '地域' },
          key: { type: 'string', description: 'COS 文件路径' },
          expires: { type: 'number', description: '有效期（秒），默认 3600' },
          method: { type: 'string', description: 'HTTP 方法，默认 GET' },
        },
        required: ['secretId', 'secretKey', 'bucket', 'region', 'key'],
      },
    },
    {
      name: 'cos_copy',
      description: '在腾讯云 COS 内复制文件（支持跨 Bucket）。',
      input_schema: {
        type: 'object',
        properties: {
          secretId: { type: 'string', description: '腾讯云 SecretId' },
          secretKey: { type: 'string', description: '腾讯云 SecretKey' },
          bucket: { type: 'string', description: '目标存储桶名称' },
          region: { type: 'string', description: '目标地域' },
          key: { type: 'string', description: '目标 COS 路径' },
          sourceKey: { type: 'string', description: '源 COS 路径' },
          sourceBucket: { type: 'string', description: '源存储桶名称（默认同 Bucket）' },
          sourceRegion: { type: 'string', description: '源地域（默认同 Region）' },
        },
        required: ['secretId', 'secretKey', 'bucket', 'region', 'key', 'sourceKey'],
      },
    },
    {
      name: 'cos_head',
      description: '获取腾讯云 COS 文件的元信息（大小、类型、修改时间等），或检测文件是否存在。',
      input_schema: {
        type: 'object',
        properties: {
          secretId: { type: 'string', description: '腾讯云 SecretId' },
          secretKey: { type: 'string', description: '腾讯云 SecretKey' },
          bucket: { type: 'string', description: '存储桶名称' },
          region: { type: 'string', description: '地域' },
          key: { type: 'string', description: 'COS 文件路径' },
        },
        required: ['secretId', 'secretKey', 'bucket', 'region', 'key'],
      },
    },
  ],

  handler: async (name, args, api) => {
    const cos = createClient(args)
    const base = getBucketParams(args)

    switch (name) {
      case 'cos_upload': {
        if (!args.key) return { success: false, message: '缺少 key' }
        if (args.filePath) {
          const result = await cos.sliceUploadFile({ ...base, Key: args.key, FilePath: args.filePath })
          return { success: true, message: `上传成功: ${args.key}`, data: { Key: args.key, ETag: result.ETag, Location: result.Location } }
        }
        const params = { ...base, Key: args.key }
        if (args.content) {
          params.Body = args.content
        } else if (args.base64Data) {
          const buf = Buffer.from(args.base64Data, 'base64')
          params.Body = buf
          params.ContentLength = buf.length
        } else {
          return { success: false, message: '需提供 filePath、content 或 base64Data' }
        }
        if (args.contentType) params.ContentType = args.contentType
        const result = await cos.putObject(params)
        return { success: true, message: `上传成功: ${args.key}`, data: { Key: args.key, ETag: result.ETag, Location: result.Location } }
      }

      case 'cos_download': {
        if (!args.key) return { success: false, message: '缺少 key' }
        if (args.filePath) {
          await cos.getObject({ ...base, Key: args.key, Output: args.filePath })
          return { success: true, message: `已下载到: ${args.filePath}`, data: { filePath: args.filePath } }
        }
        const result = await cos.getObject({ ...base, Key: args.key })
        return {
          success: true,
          message: `内容已获取: ${args.key}`,
          data: { content: result.Body?.toString('utf-8') || '' },
        }
      }

      case 'cos_delete': {
        if (args.keys?.length) {
          const result = await cos.deleteMultipleObject({
            ...base,
            Objects: args.keys.map(k => ({ Key: k })),
          })
          return { success: true, message: '批量删除完成', data: { deleted: result.Deleted || [], errors: result.Error || [] } }
        }
        if (args.key) {
          await cos.deleteObject({ ...base, Key: args.key })
          return { success: true, message: `已删除: ${args.key}` }
        }
        return { success: false, message: '需提供 key 或 keys' }
      }

      case 'cos_list': {
        const params = { ...base }
        if (args.prefix) params.Prefix = args.prefix
        if (args.delimiter) params.Delimiter = args.delimiter
        if (args.maxKeys) params.MaxKeys = args.maxKeys
        if (args.marker) params.Marker = args.marker
        const result = await cos.getBucket(params)
        const objects = (result.Contents || []).map(o => ({
          key: o.Key, size: o.Size, lastModified: o.LastModified, etag: o.ETag,
        }))
        return {
          success: true,
          message: `共 ${objects.length} 个文件`,
          data: { objects, commonPrefixes: result.CommonPrefixes || [], nextMarker: result.NextMarker || '' },
        }
      }

      case 'cos_sign_url': {
        if (!args.key) return { success: false, message: '缺少 key' }
        const url = cos.getObjectUrl({
          ...base,
          Key: args.key,
          Sign: true,
          Expires: args.expires || 3600,
          Method: (args.method || 'GET').toUpperCase(),
        })
        return { success: true, message: '签名URL已生成', data: { url } }
      }

      case 'cos_copy': {
        if (!args.key || !args.sourceKey) return { success: false, message: '缺少 key 或 sourceKey' }
        const sourceBucket = args.sourceBucket || args.bucket
        const sourceRegion = args.sourceRegion || args.region
        const copySource = `${sourceBucket}.cos.${sourceRegion}.myqcloud.com/${encodeURI(args.sourceKey)}`
        const result = await cos.putObjectCopy({ ...base, Key: args.key, CopySource: copySource })
        return {
          success: true,
          message: `复制成功: ${args.sourceKey} -> ${args.key}`,
          data: { Key: args.key, ETag: result.ETag },
        }
      }

      case 'cos_head': {
        if (!args.key) return { success: false, message: '缺少 key' }
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
      }

      default:
        return { success: false, message: `未知工具: ${name}` }
    }
  },
}
