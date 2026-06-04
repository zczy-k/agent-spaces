const JIMENG_BASE_URL = 'http://localhost:5100'

function getBaseUrl(args) {
  return args.baseUrl || JIMENG_BASE_URL
}

function getHeaders(args) {
  const token = args.sessionId
  if (!token) throw new Error('缺少 sessionId')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
}

module.exports = {
  tools: [
    {
      name: 'jimeng_text_to_image',
      description: '即梦AI文生图：通过文字描述生成图片。支持多种模型(jimeng-4.5/jimeng-5.0等)、分辨率(1k/2k/4k)、比例(1:1/16:9/9:16等)。',
      input_schema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: '即梦API的session token（中国站直接填sessionid，国际站加前缀如 us-/hk-/jp-/sg-）' },
          prompt: { type: 'string', description: '图片描述文字' },
          model: { type: 'string', description: '模型名，默认 jimeng-4.5' },
          ratio: { type: 'string', description: '比例，默认 1:1，支持 1:1/4:3/3:4/16:9/9:16/3:2/2:3/21:9' },
          resolution: { type: 'string', description: '分辨率，默认 2k，支持 1k/2k/4k' },
          negativePrompt: { type: 'string', description: '反向提示词' },
          baseUrl: { type: 'string', description: 'API服务地址，默认 http://localhost:5100' },
        },
        required: ['sessionId', 'prompt'],
      },
    },
    {
      name: 'jimeng_image_to_image',
      description: '即梦AI图生图：基于输入图片和文字描述生成新图片，支持风格迁移、图片融合等。',
      input_schema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: '即梦API的session token' },
          prompt: { type: 'string', description: '图片描述文字' },
          images: { type: 'array', items: { type: 'string' }, description: '输入图片URL数组(1-10张)' },
          model: { type: 'string', description: '模型名，默认 jimeng-4.5' },
          ratio: { type: 'string', description: '比例，默认 1:1' },
          resolution: { type: 'string', description: '分辨率，默认 2k' },
          sampleStrength: { type: 'number', description: '采样强度(0.0-1.0)' },
          baseUrl: { type: 'string', description: 'API服务地址，默认 http://localhost:5100' },
        },
        required: ['sessionId', 'prompt', 'images'],
      },
    },
    {
      name: 'jimeng_text_to_video',
      description: '即梦AI视频生成：通过文字描述或图片生成视频，支持文生视频、图生视频、首尾帧视频。',
      input_schema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: '即梦API的session token' },
          prompt: { type: 'string', description: '视频描述文字' },
          model: { type: 'string', description: '模型名，默认 jimeng-video-3.5-pro' },
          ratio: { type: 'string', description: '比例，默认 1:1' },
          resolution: { type: 'string', description: '分辨率(仅部分模型支持)，默认 720p' },
          duration: { type: 'number', description: '时长(秒)，默认 5' },
          filePaths: { type: 'array', items: { type: 'string' }, description: '图片URL数组，1张为图生视频，2张为首尾帧' },
          baseUrl: { type: 'string', description: 'API服务地址，默认 http://localhost:5100' },
        },
        required: ['sessionId', 'prompt'],
      },
    },
  ],

  handler: async (name, args, api) => {
    const baseUrl = getBaseUrl(args)
    const headers = getHeaders(args)

    switch (name) {
      case 'jimeng_text_to_image': {
        const body = {
          model: args.model || 'jimeng-4.5',
          prompt: args.prompt,
          ...(args.ratio && { ratio: args.ratio }),
          ...(args.resolution && { resolution: args.resolution }),
          ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
        }
        const result = await api.postJson(`${baseUrl}/v1/images/generations`, { headers, body, timeout: 600000 })
        const urls = result.data?.map(d => d.url) || []
        return {
          success: true,
          message: `生成 ${urls.length} 张图片`,
          data: { images: urls, created: result.created },
        }
      }
      case 'jimeng_image_to_image': {
        const body = {
          model: args.model || 'jimeng-4.5',
          prompt: args.prompt,
          images: args.images,
          ...(args.ratio && { ratio: args.ratio }),
          ...(args.resolution && { resolution: args.resolution }),
          ...(args.sampleStrength != null && { sample_strength: args.sampleStrength }),
        }
        const result = await api.postJson(`${baseUrl}/v1/images/compositions`, { headers, body, timeout: 600000 })
        const urls = result.data?.map(d => d.url) || []
        return {
          success: true,
          message: `图生图完成，生成 ${urls.length} 张图片`,
          data: { images: urls, created: result.created, inputImages: result.input_images },
        }
      }
      case 'jimeng_text_to_video': {
        const body = {
          model: args.model || 'jimeng-video-3.5-pro',
          prompt: args.prompt,
          ...(args.ratio && { ratio: args.ratio }),
          ...(args.resolution && { resolution: args.resolution }),
          ...(args.duration && { duration: args.duration }),
          ...(args.filePaths?.length && { filePaths: args.filePaths }),
        }
        const result = await api.postJson(`${baseUrl}/v1/videos/generations`, { headers, body, timeout: 600000 })
        const urls = result.data?.map(d => d.url) || []
        return {
          success: true,
          message: `视频生成完成`,
          data: { videos: urls, created: result.created },
        }
      }
      default:
        return { success: false, message: `未知工具: ${name}` }
    }
  },
}
