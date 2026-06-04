module.exports = {
  nodes: [
    {
      type: 'jimeng_text_to_image',
      label: 'AI文生图',
      category: '即梦AI',
      icon: 'Image',
      description: '通过文字描述使用即梦AI生成图片',
      properties: [
        { key: 'sessionId', label: 'Session Token', type: 'text', required: true, tooltip: '即梦sessionid（国际站加前缀 us-/hk-/jp-/sg-）', default: '{{ __config__["workfox.jimeng"]["sessionId"] }}' },
        { key: 'prompt', label: '图片描述', type: 'textarea', required: true, tooltip: '描述你想生成的图片内容' },
        { key: 'model', label: '模型', type: 'select', default: 'jimeng-4.5', options: [
          { label: 'jimeng-4.5 (默认)', value: 'jimeng-4.5' },
          { label: 'jimeng-5.0', value: 'jimeng-5.0' },
          { label: 'jimeng-4.6', value: 'jimeng-4.6' },
          { label: 'jimeng-4.1', value: 'jimeng-4.1' },
          { label: 'jimeng-4.0', value: 'jimeng-4.0' },
          { label: 'jimeng-3.1 (仅中国站)', value: 'jimeng-3.1' },
          { label: 'jimeng-3.0', value: 'jimeng-3.0' },
        ] },
        { key: 'ratio', label: '比例', type: 'select', default: '1:1', options: [
          { label: '1:1', value: '1:1' },
          { label: '4:3', value: '4:3' },
          { label: '3:4', value: '3:4' },
          { label: '16:9', value: '16:9' },
          { label: '9:16', value: '9:16' },
          { label: '3:2', value: '3:2' },
          { label: '2:3', value: '2:3' },
          { label: '21:9', value: '21:9' },
        ] },
        { key: 'resolution', label: '分辨率', type: 'select', default: '2k', options: [
          { label: '1K', value: '1k' },
          { label: '2K (默认)', value: '2k' },
          { label: '4K', value: '4k' },
        ] },
        { key: 'negativePrompt', label: '反向提示词', type: 'textarea', tooltip: '排除不想出现的内容' },
        { key: 'baseUrl', label: 'API地址', type: 'text', default: '{{ __config__["workfox.jimeng"]["baseUrl"] }}', tooltip: '即梦API服务地址' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'images', type: 'object', children: [] },
          { key: 'created', type: 'number' },
        ] },
      ],
      handler: async (ctx, args) => {
        const baseUrl = args.baseUrl || 'http://localhost:5100'
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${args.sessionId}`,
        }
        const body = {
          model: args.model || 'jimeng-4.5',
          prompt: args.prompt,
          ratio: args.ratio || '1:1',
          resolution: args.resolution || '2k',
          ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
        }
        ctx.logger.info(`请求地址: ${baseUrl}/v1/images/generations`)
        ctx.logger.info(`模型: ${body.model}, 比例: ${body.ratio}, 分辨率: ${body.resolution}`)
        ctx.logger.info(`提示词: ${body.prompt}`)
        const result = await ctx.api.postJson(`${baseUrl}/v1/images/generations`, { headers, body, timeout: 600000 })
        const urls = result.data?.map(d => d.url) || []
        ctx.logger.info(`生成完成，共 ${urls.length} 张图片`)
        return { success: true, message: `生成 ${urls.length} 张图片`, data: { images: urls, created: result.created } }
      },
    },
    {
      type: 'jimeng_image_to_image',
      label: 'AI图生图',
      category: '即梦AI',
      icon: 'Wand2',
      description: '基于输入图片和文字描述生成新图片（风格迁移、图片融合等）',
      properties: [
        { key: 'sessionId', label: 'Session Token', type: 'text', required: true, tooltip: '即梦sessionid（国际站加前缀 us-/hk-/jp-/sg-）', default: '{{ __config__["workfox.jimeng"]["sessionId"] }}' },
        { key: 'prompt', label: '图片描述', type: 'textarea', required: true, tooltip: '描述生成方向' },
        { key: 'images', label: '图片URL', type: 'textarea', required: true, tooltip: '输入图片URL数组，如 ["https://..."]' },
        { key: 'model', label: '模型', type: 'select', default: 'jimeng-4.5', options: [
          { label: 'jimeng-4.5 (默认)', value: 'jimeng-4.5' },
          { label: 'jimeng-5.0', value: 'jimeng-5.0' },
          { label: 'jimeng-4.6', value: 'jimeng-4.6' },
          { label: 'jimeng-4.1', value: 'jimeng-4.1' },
          { label: 'jimeng-4.0', value: 'jimeng-4.0' },
        ] },
        { key: 'ratio', label: '比例', type: 'select', default: '1:1', options: [
          { label: '1:1', value: '1:1' },
          { label: '4:3', value: '4:3' },
          { label: '3:4', value: '3:4' },
          { label: '16:9', value: '16:9' },
          { label: '9:16', value: '9:16' },
        ] },
        { key: 'resolution', label: '分辨率', type: 'select', default: '2k', options: [
          { label: '1K', value: '1k' },
          { label: '2K', value: '2k' },
          { label: '4K', value: '4k' },
        ] },
        { key: 'sampleStrength', label: '采样强度', type: 'number', default: 0.7, tooltip: '0.0-1.0' },
        { key: 'baseUrl', label: 'API地址', type: 'text', default: '{{ __config__["workfox.jimeng"]["baseUrl"] }}', tooltip: '即梦API服务地址' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'images', type: 'object', children: [] },
          { key: 'created', type: 'number' },
          { key: 'inputImages', type: 'object', children: [] },
        ] },
      ],
      handler: async (ctx, args) => {
        const baseUrl = args.baseUrl || 'http://localhost:5100'
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${args.sessionId}`,
        }
        const images = Array.isArray(args.images) ? args.images : JSON.parse(args.images)
        const body = {
          model: args.model || 'jimeng-4.5',
          prompt: args.prompt,
          images,
          ratio: args.ratio || '1:1',
          resolution: args.resolution || '2k',
          ...(args.sampleStrength != null && { sample_strength: args.sampleStrength }),
        }
        ctx.logger.info(`请求地址: ${baseUrl}/v1/images/compositions`)
        ctx.logger.info(`模型: ${body.model}, 比例: ${body.ratio}, 分辨率: ${body.resolution}`)
        ctx.logger.info(`输入图片: ${images.length} 张, 采样强度: ${body.sample_strength ?? '默认'}`)
        ctx.logger.info(`提示词: ${body.prompt}`)
        const result = await ctx.api.postJson(`${baseUrl}/v1/images/compositions`, { headers, body, timeout: 600000 })
        const urls = result.data?.map(d => d.url) || []
        ctx.logger.info(`图生图完成，共 ${urls.length} 张图片`)
        return { success: true, message: `图生图完成，生成 ${urls.length} 张图片`, data: { images: urls, created: result.created } }
      },
    },
    {
      type: 'jimeng_text_to_video',
      label: 'AI视频生成',
      category: '即梦AI',
      icon: 'Video',
      description: '通过文字描述或图片生成视频（文生视频/图生视频/首尾帧）',
      properties: [
        { key: 'sessionId', label: 'Session Token', type: 'text', required: true, tooltip: '即梦sessionid（国际站加前缀 us-/hk-/jp-/sg-）', default: '{{ __config__["workfox.jimeng"]["sessionId"] }}' },
        { key: 'prompt', label: '视频描述', type: 'textarea', required: true, tooltip: '描述视频内容' },
        { key: 'model', label: '模型', type: 'select', default: 'jimeng-video-3.5-pro', options: [
          { label: 'jimeng-video-3.5-pro (默认)', value: 'jimeng-video-3.5-pro' },
          { label: 'jimeng-video-3.0', value: 'jimeng-video-3.0' },
          { label: 'jimeng-video-3.0-pro', value: 'jimeng-video-3.0-pro' },
          { label: 'jimeng-video-3.0-fast', value: 'jimeng-video-3.0-fast' },
          { label: 'jimeng-video-2.0', value: 'jimeng-video-2.0' },
          { label: 'jimeng-video-2.0-pro', value: 'jimeng-video-2.0-pro' },
        ] },
        { key: 'ratio', label: '比例', type: 'select', default: '1:1', options: [
          { label: '1:1', value: '1:1' },
          { label: '4:3', value: '4:3' },
          { label: '3:4', value: '3:4' },
          { label: '16:9', value: '16:9' },
          { label: '9:16', value: '9:16' },
          { label: '21:9', value: '21:9' },
        ] },
        { key: 'duration', label: '时长(秒)', type: 'number', default: 5, tooltip: '5或10秒' },
        { key: 'filePaths', label: '图片URL', type: 'textarea', tooltip: '图片URL数组，1张=图生视频，2张=首尾帧' },
        { key: 'baseUrl', label: 'API地址', type: 'text', default: '{{ __config__["workfox.jimeng"]["baseUrl"] }}', tooltip: '即梦API服务地址' },
      ],
      outputs: [
        { key: 'videos', type: 'object', children: [
          { key: 'url', type: 'string' },
        ] },
        { key: 'created', type: 'number' },
      ],
      handler: async (ctx, args) => {
        const baseUrl = args.baseUrl || 'http://localhost:5100'
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${args.sessionId}`,
        }
        const body = {
          model: args.model || 'jimeng-video-3.5-pro',
          prompt: args.prompt,
          ratio: args.ratio || '1:1',
          duration: args.duration || 5,
          ...(args.filePaths && { filePaths: Array.isArray(args.filePaths) ? args.filePaths : JSON.parse(args.filePaths) }),
        }
        ctx.logger.info(`请求地址: ${baseUrl}/v1/videos/generations`)
        ctx.logger.info(`模型: ${body.model}, 比例: ${body.ratio}, 时长: ${body.duration}s`)
        ctx.logger.info(`提示词: ${body.prompt}`)
        if (body.filePaths) ctx.logger.info(`输入图片: ${body.filePaths.length} 张`)
        const result = await ctx.api.postJson(`${baseUrl}/v1/videos/generations`, { headers, body, timeout: 600000 })
        const urls = result.data?.map(d => d.url) || []
        ctx.logger.info(`视频生成完成，共 ${urls.length} 个视频`)
        return { success: true, message: '视频生成完成', data: { videos: urls, created: result.created } }
      },
    },
  ],
}
