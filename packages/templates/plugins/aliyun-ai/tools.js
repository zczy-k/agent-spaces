// ============================================================
// 阿里云百炼 AI 插件 - AI Agent 工具定义
// 涵盖：文生图、图像编辑、扩图、可灵生图、图生视频、首尾帧生视频、
//       参考生视频、文生视频、视频编辑、图生动作、声动人像
// ============================================================

const SYNC_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
const TASK_QUERY_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/tasks'

const ASYNC_ENDPOINTS = {
  wanText2Image: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
  outPainting: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/out-painting',
  klingImage: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation',
  videoSynthesis: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
  image2video: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis',
}

// ── Helpers ────────────────────────────────────────────────

function getHeaders(args) {
  const apiKey = args.apiKey
  if (!apiKey) throw new Error('缺少 apiKey（阿里云百炼 DashScope API Key）')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
}

function getAsyncHeaders(args) {
  return { ...getHeaders(args), 'X-DashScope-Async': 'enable' }
}

function extractImageUrls(result) {
  const choices = result.output?.choices || []
  const urls = []
  for (const choice of choices) {
    const contents = choice.message?.content || []
    for (const item of contents) {
      if (item.image) urls.push(item.image)
    }
  }
  return urls
}

function extractLegacyImageUrls(result) {
  return (result.output?.results || []).map(r => r.url).filter(Boolean)
}

async function executeAsyncTask(api, args, endpoint, body, extractResult) {
  const headers = getAsyncHeaders(args)

  const createResult = await api.postJson(endpoint, { headers, body, timeout: 600000 })
  if (createResult.code || createResult.message) {
    return { success: false, message: `创建任务失败: ${createResult.code} - ${createResult.message}` }
  }

  const taskId = createResult.output?.task_id
  if (!taskId) return { success: false, message: '创建任务成功但未获取到 task_id' }

  const pollHeaders = getHeaders(args)
  const maxAttempts = 120
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 10000))
    const pollResult = await api.getJson(`${TASK_QUERY_ENDPOINT}/${taskId}`, { headers: pollHeaders, timeout: 30000 })
    const status = pollResult.output?.task_status

    if (status === 'SUCCEEDED') return extractResult(pollResult)
    if (status === 'FAILED') {
      return { success: false, message: `任务失败: ${pollResult.output?.code || ''} - ${pollResult.output?.message || '未知错误'}` }
    }
    if (status === 'UNKNOWN' || status === 'CANCELED') return { success: false, message: `任务异常: ${status}` }
  }
  return { success: false, message: '轮询超时' }
}

// ── Tool definitions ───────────────────────────────────────

module.exports = {
  tools: [
    {
      name: 'aliyun_text_to_image',
      description: '阿里云百炼AI文生图：千问/万相模型同步生成图片。支持 qwen-image-2.0-pro/qwen-image-2.0/qwen-image-max/wan2.7-image-pro/wan2.7-image/wan2.6-t2i。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: '阿里云百炼 DashScope API Key' },
          prompt: { type: 'string', description: '图片描述文字' },
          model: { type: 'string', description: '模型名，默认 qwen-image-2.0-pro' },
          size: { type: 'string', description: '分辨率，默认 2048*2048' },
          negativePrompt: { type: 'string', description: '反向提示词' },
          n: { type: 'number', description: '生成图片数量，默认1' },
          promptExtend: { type: 'boolean', description: '是否智能改写，默认true' },
          seed: { type: 'number', description: '随机种子' },
        },
        required: ['apiKey', 'prompt'],
      },
    },
    {
      name: 'aliyun_image_edit',
      description: '阿里云百炼AI图像编辑：基于图片和文字描述进行风格迁移、物体增删、局部修改。支持千问和万相2.7模型。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'API Key' },
          prompt: { type: 'string', description: '编辑指令' },
          images: { type: 'array', items: { type: 'string' }, description: '输入图片URL数组(1-9张)' },
          model: { type: 'string', description: '模型名，默认 qwen-image-2.0-pro' },
          size: { type: 'string', description: '分辨率，默认 2048*2048' },
          negativePrompt: { type: 'string', description: '反向提示词' },
          n: { type: 'number', description: '生成数量' },
          promptExtend: { type: 'boolean', description: '智能改写，默认true' },
        },
        required: ['apiKey', 'prompt'],
      },
    },
    {
      name: 'aliyun_wan_text_to_image_legacy',
      description: '万相2.5及以下版本文生图(异步)：支持 wan2.5-t2i-preview/wan2.2-t2i-flash/wan2.2-t2i-plus 等旧版万相模型。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'API Key' },
          prompt: { type: 'string', description: '图片描述' },
          model: { type: 'string', description: '模型，默认 wan2.5-t2i-preview' },
          size: { type: 'string', description: '分辨率，默认 1280*1280' },
          negativePrompt: { type: 'string', description: '反向提示词' },
          n: { type: 'number', description: '图片数量(1-4)，默认1' },
          promptExtend: { type: 'boolean', description: '智能改写，默认true' },
          seed: { type: 'number', description: '随机种子' },
        },
        required: ['apiKey', 'prompt'],
      },
    },
    {
      name: 'aliyun_image_out_painting',
      description: '图像画面扩展/扩图：按宽高比、按比例或按方向像素扩展图像，支持旋转。模型：image-out-painting。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'API Key' },
          imageUrl: { type: 'string', description: '输入图片URL' },
          outputRatio: { type: 'string', description: '宽高比: 1:1/3:4/4:3/9:16/16:9' },
          xScale: { type: 'number', description: '水平扩展比例(1.0-3.0)' },
          yScale: { type: 'number', description: '垂直扩展比例(1.0-3.0)' },
          leftOffset: { type: 'number', description: '左侧扩展像素' },
          rightOffset: { type: 'number', description: '右侧扩展像素' },
          topOffset: { type: 'number', description: '上方扩展像素' },
          bottomOffset: { type: 'number', description: '下方扩展像素' },
          angle: { type: 'number', description: '逆时针旋转角度(0-359)' },
        },
        required: ['apiKey', 'imageUrl'],
      },
    },
    {
      name: 'aliyun_kling_image_generation',
      description: '可灵AI图像生成：文生图和参考图生图。支持 kling-v3-image-generation/kling-v3-omni-image-generation 模型，单图和组图模式。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'API Key' },
          prompt: { type: 'string', description: '图片描述' },
          images: { type: 'array', items: { type: 'string' }, description: '参考图URL数组(可选)' },
          model: { type: 'string', description: '模型，默认 kling/kling-v3-image-generation' },
          aspectRatio: { type: 'string', description: '宽高比: 16:9/9:16/1:1，默认1:1' },
          resolution: { type: 'string', description: '分辨率: 1k/2k/4k，默认1k' },
          n: { type: 'number', description: '图片数量(1-9)，默认1' },
          resultType: { type: 'string', description: 'single或series，默认single' },
          seriesAmount: { type: 'number', description: '组图张数(2-9)' },
        },
        required: ['apiKey', 'prompt'],
      },
    },
    {
      name: 'aliyun_image_to_video_v27',
      description: '万相2.7图生视频：支持首帧生视频、首尾帧生视频、视频续写、音频驱动。模型 wan2.7-i2v。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'API Key' },
          prompt: { type: 'string', description: '视频描述(可选)' },
          media: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', description: 'first_frame/last_frame/driving_audio/first_clip' }, url: { type: 'string' } } }, description: '媒体素材数组' },
          resolution: { type: 'string', description: '720P或1080P，默认720P' },
          duration: { type: 'number', description: '视频时长2-15秒，默认5' },
          promptExtend: { type: 'boolean', description: '智能改写，默认true' },
          negativePrompt: { type: 'string', description: '反向提示词' },
          watermark: { type: 'boolean', description: '水印，默认false' },
          seed: { type: 'number', description: '随机种子' },
        },
        required: ['apiKey', 'media'],
      },
    },
    {
      name: 'aliyun_image_to_video_legacy',
      description: '万相图生视频旧版：wan2.6/2.5/2.2/2.1模型，基于首帧图像生成视频，支持音频输入。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'API Key' },
          prompt: { type: 'string', description: '视频描述' },
          imageUrl: { type: 'string', description: '首帧图片URL' },
          model: { type: 'string', description: '模型，默认 wan2.6-i2v-flash' },
          resolution: { type: 'string', description: '480P/720P/1080P' },
          duration: { type: 'number', description: '视频时长(秒)，默认5' },
          audioUrl: { type: 'string', description: '音频URL(仅wan2.6/2.5)' },
          promptExtend: { type: 'boolean', description: '智能改写，默认true' },
          negativePrompt: { type: 'string', description: '反向提示词' },
          seed: { type: 'number', description: '随机种子' },
        },
        required: ['apiKey', 'imageUrl'],
      },
    },
    {
      name: 'aliyun_first_last_frame_video',
      description: '万相首尾帧生视频：基于首帧和尾帧图像生成平滑过渡视频。模型 wan2.2-kf2v-flash/wanx2.1-kf2v-plus。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'API Key' },
          prompt: { type: 'string', description: '视频描述' },
          firstFrameUrl: { type: 'string', description: '首帧图片URL' },
          lastFrameUrl: { type: 'string', description: '尾帧图片URL' },
          model: { type: 'string', description: '模型，默认 wan2.2-kf2v-flash' },
          resolution: { type: 'string', description: '480P/720P/1080P' },
          promptExtend: { type: 'boolean', description: '智能改写' },
          negativePrompt: { type: 'string', description: '反向提示词' },
          seed: { type: 'number', description: '随机种子' },
        },
        required: ['apiKey', 'firstFrameUrl', 'lastFrameUrl'],
      },
    },
    {
      name: 'aliyun_reference_video',
      description: '万相2.7参考生视频：将人或物体作为主角生成视频，支持多角色互动和音色参考。模型 wan2.7-r2v。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'API Key' },
          prompt: { type: 'string', description: '用"图1""视频1"指代素材描述视频' },
          media: { type: 'array', items: { type: 'object', properties: { type: { type: 'string', description: 'reference_image/reference_video/first_frame' }, url: { type: 'string' }, reference_voice: { type: 'string' } } }, description: '参考素材数组' },
          resolution: { type: 'string', description: '720P或1080P' },
          ratio: { type: 'string', description: '宽高比，默认16:9' },
          duration: { type: 'number', description: '视频时长2-15秒' },
          promptExtend: { type: 'boolean', description: '智能改写' },
          seed: { type: 'number', description: '随机种子' },
        },
        required: ['apiKey', 'prompt', 'media'],
      },
    },
    {
      name: 'aliyun_text_to_video',
      description: '万相2.7文生视频：基于文字描述生成视频，支持多镜头叙事和自动配音。模型 wan2.7-t2v。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'API Key' },
          prompt: { type: 'string', description: '视频场景描述' },
          resolution: { type: 'string', description: '720P或1080P' },
          ratio: { type: 'string', description: '宽高比，默认16:9' },
          duration: { type: 'number', description: '视频时长2-15秒，默认5' },
          audioUrl: { type: 'string', description: '音频URL(可选)' },
          promptExtend: { type: 'boolean', description: '智能改写' },
          negativePrompt: { type: 'string', description: '反向提示词' },
          seed: { type: 'number', description: '随机种子' },
        },
        required: ['apiKey', 'prompt'],
      },
    },
    {
      name: 'aliyun_video_editing',
      description: '万相2.7视频编辑：支持指令编辑（改风格）和参考图编辑（局部替换）。模型 wan2.7-videoedit。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'API Key' },
          prompt: { type: 'string', description: '编辑指令' },
          videoUrl: { type: 'string', description: '待编辑视频URL(mp4/mov, 2-10秒)' },
          referenceImages: { type: 'array', items: { type: 'string' }, description: '参考图URL数组(最多4张)' },
          resolution: { type: 'string', description: '720P或1080P' },
          duration: { type: 'number', description: '输出时长(0=原时长，2-10秒)' },
          audioSetting: { type: 'string', description: '声音: auto/origin' },
          promptExtend: { type: 'boolean', description: '智能改写' },
          seed: { type: 'number', description: '随机种子' },
        },
        required: ['apiKey', 'prompt', 'videoUrl'],
      },
    },
    {
      name: 'aliyun_animate_move',
      description: '万相图生动作：将参考视频的动作/表情迁移到人物图片中。模型 wan2.2-animate-move，支持标准/专业模式。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'API Key' },
          imageUrl: { type: 'string', description: '人物图片URL(正面单人清晰)' },
          videoUrl: { type: 'string', description: '参考动作视频URL(2-30秒)' },
          mode: { type: 'string', description: 'wan-std(标准)或wan-pro(专业)，默认wan-std' },
        },
        required: ['apiKey', 'imageUrl', 'videoUrl'],
      },
    },
    {
      name: 'aliyun_videoretalk',
      description: '声动人像VideoRetalk：基于人物视频和人声音频生成口型匹配的新视频。模型 videoretalk。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'API Key' },
          videoUrl: { type: 'string', description: '人物视频URL(正面镜头)' },
          audioUrl: { type: 'string', description: '人声音频URL(wav/mp3)' },
        },
        required: ['apiKey', 'videoUrl', 'audioUrl'],
      },
    },
  ],

  // ── Tool handler ──────────────────────────────────────────

  handler: async (name, args, api) => {
    switch (name) {

      case 'aliyun_text_to_image': {
        const headers = getHeaders(args)
        const body = {
          model: args.model || 'qwen-image-2.0-pro',
          input: { messages: [{ role: 'user', content: [{ text: args.prompt }] }] },
          parameters: {
            size: args.size || '2048*2048',
            ...(args.n && { n: args.n }),
            ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
            ...(args.seed != null && { seed: args.seed }),
            ...(args.promptExtend != null ? { prompt_extend: args.promptExtend } : { prompt_extend: true }),
          },
        }
        const result = await api.postJson(SYNC_ENDPOINT, { headers, body, timeout: 600000 })
        if (result.code || result.message) return { success: false, message: `API错误: ${result.code} - ${result.message}` }
        const urls = extractImageUrls(result)
        return { success: true, message: `生成 ${urls.length} 张图片`, data: { images: urls, requestId: result.request_id } }
      }

      case 'aliyun_image_edit': {
        if (!args.images?.length) return { success: false, message: '需要至少1张输入图片' }
        const headers = getHeaders(args)
        const content = args.images.map(img => ({ image: img }))
        content.push({ text: args.prompt })
        const body = {
          model: args.model || 'qwen-image-2.0-pro',
          input: { messages: [{ role: 'user', content }] },
          parameters: {
            size: args.size || '2048*2048',
            ...(args.n && { n: args.n }),
            ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
            ...(args.promptExtend != null ? { prompt_extend: args.promptExtend } : { prompt_extend: true }),
          },
        }
        const result = await api.postJson(SYNC_ENDPOINT, { headers, body, timeout: 600000 })
        if (result.code || result.message) return { success: false, message: `API错误: ${result.code} - ${result.message}` }
        const urls = extractImageUrls(result)
        return { success: true, message: `图像编辑完成，${urls.length} 张`, data: { images: urls, requestId: result.request_id } }
      }

      case 'aliyun_wan_text_to_image_legacy': {
        const body = {
          model: args.model || 'wan2.5-t2i-preview',
          input: { prompt: args.prompt, ...(args.negativePrompt && { negative_prompt: args.negativePrompt }) },
          parameters: {
            size: args.size || '1280*1280',
            ...(args.n && { n: args.n }),
            ...(args.seed != null && { seed: args.seed }),
            prompt_extend: args.promptExtend !== false,
          },
        }
        return executeAsyncTask(api, args, ASYNC_ENDPOINTS.wanText2Image, body, (result) => {
          const urls = extractLegacyImageUrls(result)
          return { success: true, message: `生成 ${urls.length} 张图片`, data: { images: urls, requestId: result.request_id } }
        })
      }

      case 'aliyun_image_out_painting': {
        const body = {
          model: 'image-out-painting',
          input: { image_url: args.imageUrl },
          parameters: {
            ...(args.angle && { angle: args.angle }),
            ...(args.outputRatio && { output_ratio: args.outputRatio }),
            ...(args.xScale && { x_scale: args.xScale }),
            ...(args.yScale && { y_scale: args.yScale }),
            ...(args.leftOffset && { left_offset: args.leftOffset }),
            ...(args.rightOffset && { right_offset: args.rightOffset }),
            ...(args.topOffset && { top_offset: args.topOffset }),
            ...(args.bottomOffset && { bottom_offset: args.bottomOffset }),
          },
        }
        return executeAsyncTask(api, args, ASYNC_ENDPOINTS.outPainting, body, (result) => ({
          success: true, message: '图像扩图完成', data: { imageUrl: result.output?.output_image_url, requestId: result.request_id },
        }))
      }

      case 'aliyun_kling_image_generation': {
        const content = [{ text: args.prompt }]
        if (args.images) for (const img of args.images) content.push({ image: img })
        const body = {
          model: args.model || 'kling/kling-v3-image-generation',
          input: { messages: [{ role: 'user', content }] },
          parameters: {
            n: args.n || 1,
            aspect_ratio: args.aspectRatio || '1:1',
            resolution: args.resolution || '1k',
            ...(args.resultType === 'series' && { result_type: 'series', series_amount: args.seriesAmount || 4 }),
          },
        }
        return executeAsyncTask(api, args, ASYNC_ENDPOINTS.klingImage, body, (result) => {
          const urls = extractImageUrls(result)
          return { success: true, message: `生成 ${urls.length} 张图片`, data: { images: urls, requestId: result.request_id } }
        })
      }

      case 'aliyun_image_to_video_v27': {
        const body = {
          model: 'wan2.7-i2v',
          input: { ...(args.prompt && { prompt: args.prompt }), media: args.media },
          parameters: {
            resolution: args.resolution || '720P',
            duration: args.duration || 5,
            prompt_extend: args.promptExtend !== false,
            watermark: args.watermark === true,
            ...(args.seed != null && { seed: args.seed }),
          },
        }
        return executeAsyncTask(api, args, ASYNC_ENDPOINTS.videoSynthesis, body, (result) => ({
          success: true, message: '视频生成完成', data: { videoUrl: result.output?.video_url, requestId: result.request_id },
        }))
      }

      case 'aliyun_image_to_video_legacy': {
        const body = {
          model: args.model || 'wan2.6-i2v-flash',
          input: { prompt: args.prompt || '', img_url: args.imageUrl, ...(args.audioUrl && { audio_url: args.audioUrl }) },
          parameters: {
            resolution: args.resolution || '720P',
            duration: args.duration || 5,
            prompt_extend: args.promptExtend !== false,
            ...(args.seed != null && { seed: args.seed }),
          },
        }
        return executeAsyncTask(api, args, ASYNC_ENDPOINTS.videoSynthesis, body, (result) => ({
          success: true, message: '视频生成完成', data: { videoUrl: result.output?.video_url, requestId: result.request_id },
        }))
      }

      case 'aliyun_first_last_frame_video': {
        const body = {
          model: args.model || 'wan2.2-kf2v-flash',
          input: { prompt: args.prompt || '', first_frame_url: args.firstFrameUrl, last_frame_url: args.lastFrameUrl },
          parameters: {
            resolution: args.resolution || '720P',
            prompt_extend: args.promptExtend !== false,
            ...(args.seed != null && { seed: args.seed }),
          },
        }
        return executeAsyncTask(api, args, ASYNC_ENDPOINTS.image2video, body, (result) => ({
          success: true, message: '视频生成完成', data: { videoUrl: result.output?.video_url, requestId: result.request_id },
        }))
      }

      case 'aliyun_reference_video': {
        const body = {
          model: 'wan2.7-r2v',
          input: { prompt: args.prompt, media: args.media },
          parameters: {
            resolution: args.resolution || '720P',
            ratio: args.ratio || '16:9',
            duration: args.duration || 5,
            prompt_extend: args.promptExtend !== false,
            ...(args.seed != null && { seed: args.seed }),
          },
        }
        return executeAsyncTask(api, args, ASYNC_ENDPOINTS.videoSynthesis, body, (result) => ({
          success: true, message: '视频生成完成', data: { videoUrl: result.output?.video_url, requestId: result.request_id },
        }))
      }

      case 'aliyun_text_to_video': {
        const body = {
          model: 'wan2.7-t2v',
          input: { prompt: args.prompt, ...(args.audioUrl && { audio_url: args.audioUrl }) },
          parameters: {
            resolution: args.resolution || '720P',
            ratio: args.ratio || '16:9',
            duration: args.duration || 5,
            prompt_extend: args.promptExtend !== false,
            ...(args.seed != null && { seed: args.seed }),
          },
        }
        return executeAsyncTask(api, args, ASYNC_ENDPOINTS.videoSynthesis, body, (result) => ({
          success: true, message: '视频生成完成', data: { videoUrl: result.output?.video_url, requestId: result.request_id },
        }))
      }

      case 'aliyun_video_editing': {
        const media = [{ type: 'video', url: args.videoUrl }]
        if (args.referenceImages) for (const img of args.referenceImages) media.push({ type: 'reference_image', url: img })
        const body = {
          model: 'wan2.7-videoedit',
          input: { prompt: args.prompt, media },
          parameters: {
            resolution: args.resolution || '720P',
            prompt_extend: args.promptExtend !== false,
            ...(args.duration && { duration: args.duration }),
            ...(args.audioSetting && { audio_setting: args.audioSetting }),
            ...(args.seed != null && { seed: args.seed }),
          },
        }
        return executeAsyncTask(api, args, ASYNC_ENDPOINTS.videoSynthesis, body, (result) => ({
          success: true, message: '视频编辑完成', data: { videoUrl: result.output?.video_url, requestId: result.request_id },
        }))
      }

      case 'aliyun_animate_move': {
        const body = {
          model: 'wan2.2-animate-move',
          input: { image_url: args.imageUrl, video_url: args.videoUrl },
          parameters: { mode: args.mode || 'wan-std' },
        }
        return executeAsyncTask(api, args, ASYNC_ENDPOINTS.image2video, body, (result) => ({
          success: true, message: '视频生成完成', data: { videoUrl: result.output?.video_url, requestId: result.request_id },
        }))
      }

      case 'aliyun_videoretalk': {
        const body = {
          model: 'videoretalk',
          input: { video_url: args.videoUrl, audio_url: args.audioUrl },
        }
        return executeAsyncTask(api, args, ASYNC_ENDPOINTS.videoSynthesis, body, (result) => ({
          success: true, message: '视频生成完成', data: { videoUrl: result.output?.video_url, requestId: result.request_id },
        }))
      }

      default:
        return { success: false, message: `未知工具: ${name}` }
    }
  },
}
