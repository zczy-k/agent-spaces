const { createClient } = require('./shared')

module.exports = {
  tools: [
    {
      name: 'oss_upload_file',
      description: '将本地文件上传到阿里云 OSS。支持上传文件路径或文本内容。',
      input_schema: {
        type: 'object',
        properties: {
          region: { type: 'string', description: 'Bucket 地域，如 oss-cn-hangzhou' },
          accessKeyId: { type: 'string', description: '阿里云 AccessKey ID' },
          accessKeySecret: { type: 'string', description: '阿里云 AccessKey Secret' },
          bucket: { type: 'string', description: 'Bucket 名称' },
          endpoint: { type: 'string', description: '自定义 Endpoint（可选）' },
          objectKey: { type: 'string', description: 'OSS 目标路径（不含 Bucket 名）' },
          filePath: { type: 'string', description: '本地文件完整路径（二选一）' },
          content: { type: 'string', description: '文本内容（二选一，与 filePath 互斥）' },
        },
        required: ['accessKeyId', 'accessKeySecret', 'bucket', 'objectKey'],
      },
    },
    {
      name: 'oss_download',
      description: '从阿里云 OSS 下载文件到本地，或获取文件文本内容。',
      input_schema: {
        type: 'object',
        properties: {
          region: { type: 'string', description: 'Bucket 地域' },
          accessKeyId: { type: 'string', description: '阿里云 AccessKey ID' },
          accessKeySecret: { type: 'string', description: '阿里云 AccessKey Secret' },
          bucket: { type: 'string', description: 'Bucket 名称' },
          endpoint: { type: 'string', description: '自定义 Endpoint（可选）' },
          objectKey: { type: 'string', description: 'OSS 文件路径' },
          filePath: { type: 'string', description: '本地保存路径（不填则返回文本内容）' },
        },
        required: ['accessKeyId', 'accessKeySecret', 'bucket', 'objectKey'],
      },
    },
    {
      name: 'oss_delete',
      description: '删除阿里云 OSS 上的文件，支持单个或批量删除。',
      input_schema: {
        type: 'object',
        properties: {
          region: { type: 'string', description: 'Bucket 地域' },
          accessKeyId: { type: 'string', description: '阿里云 AccessKey ID' },
          accessKeySecret: { type: 'string', description: '阿里云 AccessKey Secret' },
          bucket: { type: 'string', description: 'Bucket 名称' },
          endpoint: { type: 'string', description: '自定义 Endpoint（可选）' },
          objectKey: { type: 'string', description: '单个文件路径' },
          objectKeys: { type: 'array', items: { type: 'string' }, description: '多个文件路径数组（批量删除）' },
        },
        required: ['accessKeyId', 'accessKeySecret', 'bucket'],
      },
    },
    {
      name: 'oss_list',
      description: '列举阿里云 OSS Bucket 中的文件。',
      input_schema: {
        type: 'object',
        properties: {
          region: { type: 'string', description: 'Bucket 地域' },
          accessKeyId: { type: 'string', description: '阿里云 AccessKey ID' },
          accessKeySecret: { type: 'string', description: '阿里云 AccessKey Secret' },
          bucket: { type: 'string', description: 'Bucket 名称' },
          endpoint: { type: 'string', description: '自定义 Endpoint（可选）' },
          prefix: { type: 'string', description: '文件前缀过滤' },
          delimiter: { type: 'string', description: '分隔符（常用 /，模拟目录）' },
          maxKeys: { type: 'number', description: '单次最大返回数量，默认 100' },
          marker: { type: 'string', description: '分页标记' },
        },
        required: ['accessKeyId', 'accessKeySecret', 'bucket'],
      },
    },
    {
      name: 'oss_sign_url',
      description: '生成阿里云 OSS 文件的临时签名访问 URL。',
      input_schema: {
        type: 'object',
        properties: {
          region: { type: 'string', description: 'Bucket 地域' },
          accessKeyId: { type: 'string', description: '阿里云 AccessKey ID' },
          accessKeySecret: { type: 'string', description: '阿里云 AccessKey Secret' },
          bucket: { type: 'string', description: 'Bucket 名称' },
          endpoint: { type: 'string', description: '自定义 Endpoint（可选）' },
          objectKey: { type: 'string', description: 'OSS 文件路径' },
          expires: { type: 'number', description: '有效期（秒），默认 3600' },
          method: { type: 'string', description: 'HTTP 方法，默认 GET' },
        },
        required: ['accessKeyId', 'accessKeySecret', 'bucket', 'objectKey'],
      },
    },
    {
      name: 'oss_copy',
      description: '在阿里云 OSS 内复制文件（支持跨 Bucket）。',
      input_schema: {
        type: 'object',
        properties: {
          region: { type: 'string', description: 'Bucket 地域' },
          accessKeyId: { type: 'string', description: '阿里云 AccessKey ID' },
          accessKeySecret: { type: 'string', description: '阿里云 AccessKey Secret' },
          bucket: { type: 'string', description: '目标 Bucket 名称' },
          endpoint: { type: 'string', description: '自定义 Endpoint（可选）' },
          objectKey: { type: 'string', description: '目标 OSS 路径' },
          sourceKey: { type: 'string', description: '源 OSS 路径' },
          sourceBucket: { type: 'string', description: '源 Bucket 名称（默认同 Bucket）' },
        },
        required: ['accessKeyId', 'accessKeySecret', 'bucket', 'objectKey', 'sourceKey'],
      },
    },
  ],

  handler: async (name, args, api) => {
    const client = createClient(args)

    switch (name) {
      case 'oss_upload_file': {
        if (!args.objectKey) return { success: false, message: '缺少 objectKey' }
        let result
        if (args.filePath) {
          result = await client.put(args.objectKey, args.filePath)
        } else if (args.content) {
          result = await client.put(args.objectKey, Buffer.from(args.content))
        } else {
          return { success: false, message: '需提供 filePath 或 content' }
        }
        return {
          success: true,
          message: `上传成功: ${result.name}`,
          data: { name: result.name, url: result.url },
        }
      }

      case 'oss_download': {
        if (!args.objectKey) return { success: false, message: '缺少 objectKey' }
        if (args.filePath) {
          await client.get(args.objectKey, args.filePath)
          return { success: true, message: `已下载到: ${args.filePath}`, data: { filePath: args.filePath } }
        }
        const result = await client.get(args.objectKey)
        return {
          success: true,
          message: `内容已获取: ${args.objectKey}`,
          data: { content: result.content?.toString('utf-8') || '' },
        }
      }

      case 'oss_delete': {
        if (args.objectKeys?.length) {
          const result = await client.deleteMulti(args.objectKeys)
          return { success: true, message: `批量删除完成`, data: { deleted: result.deleted || [] } }
        }
        if (args.objectKey) {
          await client.delete(args.objectKey)
          return { success: true, message: `已删除: ${args.objectKey}` }
        }
        return { success: false, message: '需提供 objectKey 或 objectKeys' }
      }

      case 'oss_list': {
        const query = {}
        if (args.prefix) query.prefix = args.prefix
        if (args.delimiter) query.delimiter = args.delimiter
        if (args.maxKeys) query['max-keys'] = args.maxKeys
        if (args.marker) query.marker = args.marker

        const result = await client.list(query)
        const objects = (result.objects || []).map(o => ({
          name: o.name, size: o.size, lastModified: o.lastModified, url: o.url,
        }))
        return {
          success: true,
          message: `共 ${objects.length} 个文件`,
          data: { objects, prefixes: result.prefixes || [], nextMarker: result.nextMarker || '' },
        }
      }

      case 'oss_sign_url': {
        if (!args.objectKey) return { success: false, message: '缺少 objectKey' }
        const url = client.signatureUrl(args.objectKey, {
          expires: args.expires || 3600,
          method: (args.method || 'GET').toUpperCase(),
        })
        return { success: true, message: '签名URL已生成', data: { url } }
      }

      case 'oss_copy': {
        if (!args.objectKey || !args.sourceKey) return { success: false, message: '缺少 objectKey 或 sourceKey' }
        const sourceBucket = args.sourceBucket || args.bucket
        const result = await client.copy(args.objectKey, `/${sourceBucket}/${args.sourceKey}`)
        return {
          success: true,
          message: `复制成功: ${args.sourceKey} -> ${args.objectKey}`,
          data: { name: result.name, url: result.url },
        }
      }

      default:
        return { success: false, message: `未知工具: ${name}` }
    }
  },
}
