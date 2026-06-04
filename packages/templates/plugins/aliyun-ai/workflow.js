// ============================================================
// 阿里云百炼 AI 插件 - 工作流节点定义
// 涵盖：文生图、图像编辑、扩图、可灵生图、图生视频、首尾帧生视频、
//       参考生视频、文生视频、视频编辑、图生动作、声动人像
// ============================================================

const SYNC_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
const TASK_QUERY_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/tasks'

// Async endpoints
const ASYNC_ENDPOINTS = {
  wanText2Image: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
  outPainting: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/out-painting',
  klingImage: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation',
  videoSynthesis: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
  image2video: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis',
}

// ── Model options ──────────────────────────────────────────

const QWEN_IMAGE_MODELS = [
  { label: 'qwen-image-2.0-pro (推荐)', value: 'qwen-image-2.0-pro' },
  { label: 'qwen-image-2.0', value: 'qwen-image-2.0' },
  { label: 'qwen-image-max', value: 'qwen-image-max' },
  { label: 'wan2.7-image-pro (万相2.7)', value: 'wan2.7-image-pro' },
  { label: 'wan2.7-image (万相2.7加速)', value: 'wan2.7-image' },
  { label: 'wan2.6-t2i (万相2.6)', value: 'wan2.6-t2i' },
]

const QWEN_EDIT_MODELS = [
  { label: 'qwen-image-2.0-pro (推荐)', value: 'qwen-image-2.0-pro' },
  { label: 'qwen-image-2.0', value: 'qwen-image-2.0' },
  { label: 'qwen-image-edit', value: 'qwen-image-edit' },
  { label: 'wan2.7-image-pro (万相2.7)', value: 'wan2.7-image-pro' },
  { label: 'wan2.7-image (万相2.7加速)', value: 'wan2.7-image' },
]

const WAN_T2I_MODELS = [
  { label: 'wan2.5-t2i-preview (推荐)', value: 'wan2.5-t2i-preview' },
  { label: 'wan2.2-t2i-flash (极速版)', value: 'wan2.2-t2i-flash' },
  { label: 'wan2.2-t2i-plus (专业版)', value: 'wan2.2-t2i-plus' },
  { label: 'wanx2.1-t2i-turbo', value: 'wanx2.1-t2i-turbo' },
  { label: 'wanx2.1-t2i-plus', value: 'wanx2.1-t2i-plus' },
]

const KLING_IMAGE_MODELS = [
  { label: 'kling-v3-image-generation', value: 'kling/kling-v3-image-generation' },
  { label: 'kling-v3-omni-image-generation', value: 'kling/kling-v3-omni-image-generation' },
]

const I2V_LEGACY_MODELS = [
  { label: 'wan2.6-i2v-flash (推荐)', value: 'wan2.6-i2v-flash' },
  { label: 'wan2.5-i2v-preview', value: 'wan2.5-i2v-preview' },
  { label: 'wan2.2-i2v-flash (极速版)', value: 'wan2.2-i2v-flash' },
  { label: 'wan2.2-i2v-plus (专业版)', value: 'wan2.2-i2v-plus' },
  { label: 'wanx2.1-i2v-turbo', value: 'wanx2.1-i2v-turbo' },
  { label: 'wanx2.1-i2v-plus', value: 'wanx2.1-i2v-plus' },
]

const KF2V_MODELS = [
  { label: 'wan2.2-kf2v-flash (推荐)', value: 'wan2.2-kf2v-flash' },
  { label: 'wanx2.1-kf2v-plus', value: 'wanx2.1-kf2v-plus' },
]

const ANIMATE_MOVE_MODES = [
  { label: 'wan-std (标准模式)', value: 'wan-std' },
  { label: 'wan-pro (专业模式)', value: 'wan-pro' },
]

const RESOLUTION_IMAGE = [
  { label: '2048*2048 (默认)', value: '2048*2048' },
  { label: '1024*1024', value: '1024*1024' },
  { label: '1536*1536', value: '1536*1536' },
  { label: '2688*1536 (16:9)', value: '2688*1536' },
  { label: '1536*2688 (9:16)', value: '1536*2688' },
  { label: '2368*1728 (4:3)', value: '2368*1728' },
  { label: '1728*2368 (3:4)', value: '1728*2368' },
]

const RESOLUTION_WAN_T2I = [
  { label: '1280*1280 (默认)', value: '1280*1280' },
  { label: '1024*1024', value: '1024*1024' },
  { label: '1104*1472 (3:4)', value: '1104*1472' },
  { label: '1472*1104 (4:3)', value: '1472*1104' },
  { label: '960*1696 (9:16)', value: '960*1696' },
  { label: '1696*960 (16:9)', value: '1696*960' },
]

const RESOLUTION_VIDEO = [
  { label: '1080P (默认)', value: '1080P' },
  { label: '720P', value: '720P' },
  { label: '480P', value: '480P' },
]

const ASPECT_RATIO = [
  { label: '16:9 (默认)', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:4', value: '3:4' },
]

// ── Helpers ────────────────────────────────────────────────

function getHeaders(apiKey) {
  if (!apiKey) throw new Error('缺少 API Key')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
}

function getAsyncHeaders(apiKey) {
  return { ...getHeaders(apiKey), 'X-DashScope-Async': 'enable' }
}

function extractImageUrls(result) {
  const urls = []
  const choices = result.output?.choices || []
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

// Async task: create + poll until SUCCEEDED/FAILED
async function executeAsyncTask(ctx, apiKey, endpoint, body, extractResult) {
  const headers = getAsyncHeaders(apiKey)

  // Step 1: create task
  ctx.logger.info(`创建异步任务: ${endpoint}`)
  ctx.logger.info(`模型: ${body.model}`)
  const createResult = await ctx.api.postJson(endpoint, { headers, body, timeout: 600000 })

  if (createResult.code || createResult.message) {
    ctx.logger.error(`创建任务失败: ${createResult.code} - ${createResult.message}`)
    return { success: false, message: `创建任务失败: ${createResult.code} - ${createResult.message}` }
  }

  const taskId = createResult.output?.task_id
  if (!taskId) {
    return { success: false, message: '创建任务成功但未获取到 task_id' }
  }
  ctx.logger.info(`任务已创建: ${taskId}, 状态: ${createResult.output.task_status}`)

  // Step 2: poll until done
  const pollHeaders = getHeaders(apiKey)
  const maxAttempts = 120 // ~20 min at 10s interval
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 10000))

    const pollResult = await ctx.api.getJson(`${TASK_QUERY_ENDPOINT}/${taskId}`, { headers: pollHeaders, timeout: 30000 })
    const status = pollResult.output?.task_status
    ctx.logger.info(`轮询 #${i + 1}: 状态=${status}`)

    if (status === 'SUCCEEDED') {
      return extractResult(pollResult)
    }
    if (status === 'FAILED') {
      const code = pollResult.output?.code || ''
      const msg = pollResult.output?.message || '未知错误'
      ctx.logger.error(`任务失败: ${code} - ${msg}`)
      return { success: false, message: `任务失败: ${code} - ${msg}` }
    }
    if (status === 'UNKNOWN' || status === 'CANCELED') {
      return { success: false, message: `任务异常: ${status}` }
    }
  }
  return { success: false, message: '轮询超时，请稍后手动查询' }
}

// Common property definitions
const API_KEY_PROP = { key: 'apiKey', label: 'API Key', type: 'text', required: true, tooltip: '阿里云百炼 DashScope API Key', default: '{{ __config__["workfox.aliyun-ai"]["apiKey"] }}' }
const PROMPT_PROP = (label, tip) => ({ key: 'prompt', label, type: 'textarea', required: true, tooltip: tip })
const NEGATIVE_PROMPT_PROP = { key: 'negativePrompt', label: '反向提示词', type: 'textarea', tooltip: '排除不想出现的内容' }
const SEED_PROP = { key: 'seed', label: '随机种子', type: 'number', tooltip: '固定种子可复现结果，0~2147483647' }
const WATERMARK_PROP = { key: 'watermark', label: '水印', type: 'select', default: 'false', options: [{ label: '不添加 (默认)', value: 'false' }, { label: '添加水印', value: 'true' }] }

const IMAGE_OUTPUTS = [
  { key: 'success', type: 'boolean' },
  { key: 'message', type: 'string' },
  { key: 'data', type: 'object', children: [
    { key: 'images', type: 'object', children: [] },
    { key: 'requestId', type: 'string' },
  ] },
]

const VIDEO_OUTPUTS = [
  { key: 'success', type: 'boolean' },
  { key: 'message', type: 'string' },
  { key: 'data', type: 'object', children: [
    { key: 'videoUrl', type: 'string' },
    { key: 'taskId', type: 'string' },
    { key: 'requestId', type: 'string' },
  ] },
]

// ── Node definitions ───────────────────────────────────────

module.exports = {
  nodes: [

    // ─── 1. AI文生图 (SYNC) ────────────────────────────────
    {
      type: 'aliyun_text_to_image',
      label: 'AI文生图',
      category: '阿里云AI',
      icon: 'Image',
      description: '千问/万相文生图：通过文字描述生成图片（同步调用）',
      properties: [
        API_KEY_PROP,
        PROMPT_PROP('图片描述', '描述你想生成的图片内容'),
        { key: 'model', label: '模型', type: 'select', default: 'qwen-image-2.0-pro', options: QWEN_IMAGE_MODELS },
        { key: 'size', label: '分辨率', type: 'select', default: '2048*2048', options: RESOLUTION_IMAGE },
        { key: 'n', label: '图片数量', type: 'number', default: 1, tooltip: '生成图片数量(1-6)' },
        NEGATIVE_PROMPT_PROP,
        { key: 'promptExtend', label: '智能改写', type: 'select', default: 'true', options: [{ label: '开启 (默认)', value: 'true' }, { label: '关闭', value: 'false' }] },
        SEED_PROP,
      ],
      outputs: IMAGE_OUTPUTS,
      handler: async (ctx, args) => {
        const headers = getHeaders(args.apiKey)
        const body = {
          model: args.model || 'qwen-image-2.0-pro',
          input: { messages: [{ role: 'user', content: [{ text: args.prompt }] }] },
          parameters: {
            size: args.size || '2048*2048',
            ...(args.n && { n: args.n }),
            ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
            ...(args.seed != null && { seed: args.seed }),
            prompt_extend: args.promptExtend !== 'false',
          },
        }
        ctx.logger.info(`[文生图] 模型: ${body.model}, 分辨率: ${body.parameters.size}`)
        const result = await ctx.api.postJson(SYNC_ENDPOINT, { headers, body, timeout: 600000 })
        if (result.code || result.message) {
          return { success: false, message: `API错误: ${result.code} - ${result.message}` }
        }
        const urls = extractImageUrls(result)
        return { success: true, message: `生成 ${urls.length} 张图片`, data: { images: urls, requestId: result.request_id } }
      },
    },

    // ─── 2. AI图像编辑 (SYNC) ──────────────────────────────
    {
      type: 'aliyun_image_edit',
      label: 'AI图像编辑',
      category: '阿里云AI',
      icon: 'Wand2',
      description: '千问/万相图像编辑：基于输入图片和文字描述进行风格迁移、物体增删、局部修改',
      properties: [
        API_KEY_PROP,
        PROMPT_PROP('编辑指令', '描述编辑方向，如"将背景改为海边"'),
        { key: 'images', label: '图片URL', type: 'textarea', required: true, tooltip: '输入图片URL数组，如 ["https://..."]' },
        { key: 'model', label: '模型', type: 'select', default: 'qwen-image-2.0-pro', options: QWEN_EDIT_MODELS },
        { key: 'size', label: '分辨率', type: 'select', default: '2048*2048', options: [
          { label: '2048*2048 (默认)', value: '2048*2048' },
          { label: '1024*1024', value: '1024*1024' },
        ] },
        { key: 'n', label: '图片数量', type: 'number', default: 1 },
        NEGATIVE_PROMPT_PROP,
        { key: 'promptExtend', label: '智能改写', type: 'select', default: 'true', options: [{ label: '开启 (默认)', value: 'true' }, { label: '关闭', value: 'false' }] },
      ],
      outputs: IMAGE_OUTPUTS,
      handler: async (ctx, args) => {
        const headers = getHeaders(args.apiKey)
        const images = Array.isArray(args.images) ? args.images : JSON.parse(args.images)
        if (!images.length) throw new Error('图像编辑需要至少1张输入图片')
        const content = images.map(img => ({ image: img }))
        content.push({ text: args.prompt })
        const body = {
          model: args.model || 'qwen-image-2.0-pro',
          input: { messages: [{ role: 'user', content }] },
          parameters: {
            size: args.size || '2048*2048',
            ...(args.n && { n: args.n }),
            ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
            prompt_extend: args.promptExtend !== 'false',
          },
        }
        ctx.logger.info(`[图像编辑] 模型: ${body.model}, 输入: ${images.length} 张`)
        const result = await ctx.api.postJson(SYNC_ENDPOINT, { headers, body, timeout: 600000 })
        if (result.code || result.message) {
          return { success: false, message: `API错误: ${result.code} - ${result.message}` }
        }
        const urls = extractImageUrls(result)
        return { success: true, message: `生成 ${urls.length} 张图片`, data: { images: urls, requestId: result.request_id } }
      },
    },

    // ─── 3. 万相文生图-旧版 (ASYNC) ────────────────────────
    {
      type: 'aliyun_wan_text_to_image_legacy',
      label: '万相文生图(旧版)',
      category: '阿里云AI',
      icon: 'ImagePlus',
      description: '万相2.5及以下版本文生图（异步调用，wan2.5/2.2/2.1模型）',
      properties: [
        API_KEY_PROP,
        PROMPT_PROP('图片描述', '描述你想生成的图片内容'),
        { key: 'model', label: '模型', type: 'select', default: 'wan2.5-t2i-preview', options: WAN_T2I_MODELS },
        { key: 'size', label: '分辨率', type: 'select', default: '1280*1280', options: RESOLUTION_WAN_T2I },
        { key: 'n', label: '图片数量', type: 'number', default: 1, tooltip: '1-4张' },
        NEGATIVE_PROMPT_PROP,
        { key: 'promptExtend', label: '智能改写', type: 'select', default: 'true', options: [{ label: '开启 (默认)', value: 'true' }, { label: '关闭', value: 'false' }] },
        SEED_PROP,
      ],
      outputs: IMAGE_OUTPUTS,
      handler: async (ctx, args) => {
        const body = {
          model: args.model || 'wan2.5-t2i-preview',
          input: {
            prompt: args.prompt,
            ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
          },
          parameters: {
            size: args.size || '1280*1280',
            ...(args.n && { n: args.n }),
            ...(args.seed != null && { seed: args.seed }),
            prompt_extend: args.promptExtend !== 'false',
          },
        }
        return executeAsyncTask(ctx, args.apiKey, ASYNC_ENDPOINTS.wanText2Image, body, (result) => {
          const urls = extractLegacyImageUrls(result)
          ctx.logger.info(`[万相文生图] 完成，${urls.length} 张图片`)
          return { success: true, message: `生成 ${urls.length} 张图片`, data: { images: urls, requestId: result.request_id } }
        })
      },
    },

    // ─── 4. 图像画面扩展/扩图 (ASYNC) ──────────────────────
    {
      type: 'aliyun_image_out_painting',
      label: 'AI图像扩图',
      category: '阿里云AI',
      icon: 'Expand',
      description: '图像画面扩展：按比例/按方向/按宽高比扩展图像，支持旋转',
      properties: [
        API_KEY_PROP,
        { key: 'imageUrl', label: '图片URL', type: 'text', required: true, tooltip: '输入图片URL' },
        { key: 'expandMode', label: '扩展方式', type: 'select', default: 'ratio', options: [
          { label: '按宽高比', value: 'ratio' },
          { label: '按比例', value: 'scale' },
          { label: '按方向像素', value: 'offset' },
        ] },
        { key: 'outputRatio', label: '宽高比', type: 'select', tooltip: '仅"按宽高比"模式生效', options: [
          { label: '不设置', value: '' },
          { label: '1:1', value: '1:1' },
          { label: '3:4', value: '3:4' },
          { label: '4:3', value: '4:3' },
          { label: '9:16', value: '9:16' },
          { label: '16:9', value: '16:9' },
        ] },
        { key: 'xScale', label: '水平扩展比例', type: 'number', tooltip: '1.0~3.0，默认1.0' },
        { key: 'yScale', label: '垂直扩展比例', type: 'number', tooltip: '1.0~3.0，默认1.0' },
        { key: 'leftOffset', label: '左侧扩展(px)', type: 'number', tooltip: '添加像素数' },
        { key: 'rightOffset', label: '右侧扩展(px)', type: 'number', tooltip: '添加像素数' },
        { key: 'topOffset', label: '上方扩展(px)', type: 'number', tooltip: '添加像素数' },
        { key: 'bottomOffset', label: '下方扩展(px)', type: 'number', tooltip: '添加像素数' },
        { key: 'angle', label: '旋转角度', type: 'number', tooltip: '逆时针0~359度' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'imageUrl', type: 'string' },
          { key: 'requestId', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        if (!args.imageUrl) throw new Error('缺少输入图片URL')
        const body = {
          model: 'image-out-painting',
          input: { image_url: args.imageUrl },
          parameters: {
            ...(args.angle && { angle: args.angle }),
            ...(args.expandMode === 'ratio' && args.outputRatio && { output_ratio: args.outputRatio }),
            ...(args.expandMode === 'scale' && {
              ...(args.xScale && { x_scale: args.xScale }),
              ...(args.yScale && { y_scale: args.yScale }),
            }),
            ...(args.expandMode === 'offset' && {
              ...(args.leftOffset && { left_offset: args.leftOffset }),
              ...(args.rightOffset && { right_offset: args.rightOffset }),
              ...(args.topOffset && { top_offset: args.topOffset }),
              ...(args.bottomOffset && { bottom_offset: args.bottomOffset }),
            }),
          },
        }
        return executeAsyncTask(ctx, args.apiKey, ASYNC_ENDPOINTS.outPainting, body, (result) => {
          const url = result.output?.output_image_url
          ctx.logger.info(`[图像扩图] 完成`)
          return { success: true, message: '图像扩图完成', data: { imageUrl: url, requestId: result.request_id } }
        })
      },
    },

    // ─── 5. 可灵图像生成 (ASYNC) ───────────────────────────
    {
      type: 'aliyun_kling_image_generation',
      label: '可灵图像生成',
      category: '阿里云AI',
      icon: 'Sparkles',
      description: '可灵AI文生图/参考图生图，支持单图和组图模式',
      properties: [
        API_KEY_PROP,
        PROMPT_PROP('图片描述', '描述想生成的图片内容'),
        { key: 'images', label: '参考图片URL', type: 'textarea', tooltip: '参考图URL数组(可选)，如 ["https://..."]' },
        { key: 'model', label: '模型', type: 'select', default: 'kling/kling-v3-image-generation', options: KLING_IMAGE_MODELS },
        { key: 'aspectRatio', label: '宽高比', type: 'select', default: '1:1', options: ASPECT_RATIO },
        { key: 'resolution', label: '分辨率', type: 'select', default: '1k', options: [
          { label: '1K (默认)', value: '1k' },
          { label: '2K', value: '2k' },
          { label: '4K (仅omni)', value: '4k' },
        ] },
        { key: 'n', label: '图片数量', type: 'number', default: 1, tooltip: '1-9张' },
        { key: 'resultType', label: '生成类型', type: 'select', default: 'single', tooltip: '仅omni模型支持组图', options: [
          { label: '单图 (默认)', value: 'single' },
          { label: '组图', value: 'series' },
        ] },
        { key: 'seriesAmount', label: '组图张数', type: 'number', tooltip: '2-9张，仅组图模式' },
      ],
      outputs: IMAGE_OUTPUTS,
      handler: async (ctx, args) => {
        const content = [{ text: args.prompt }]
        if (args.images) {
          const imgs = Array.isArray(args.images) ? args.images : JSON.parse(args.images)
          for (const img of imgs) content.push({ image: img })
        }
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
        return executeAsyncTask(ctx, args.apiKey, ASYNC_ENDPOINTS.klingImage, body, (result) => {
          const urls = extractImageUrls(result)
          ctx.logger.info(`[可灵生图] 完成，${urls.length} 张图片`)
          return { success: true, message: `生成 ${urls.length} 张图片`, data: { images: urls, requestId: result.request_id } }
        })
      },
    },

    // ─── 6. 万相图生视频-wan2.7 (ASYNC, media array) ──────
    {
      type: 'aliyun_image_to_video_v27',
      label: '万相图生视频(2.7)',
      category: '阿里云AI',
      icon: 'Video',
      description: '万相2.7图生视频：支持首帧生视频、首尾帧生视频、视频续写、音频驱动',
      properties: [
        API_KEY_PROP,
        PROMPT_PROP('视频描述', '描述视频内容（可选）'),
        { key: 'media', label: '媒体素材', type: 'textarea', required: true, tooltip: 'JSON数组，如 [{"type":"first_frame","url":"https://..."}]。支持: first_frame, last_frame, driving_audio, first_clip' },
        { key: 'resolution', label: '分辨率', type: 'select', default: '720P', options: [
          { label: '720P', value: '720P' },
          { label: '1080P', value: '1080P' },
        ] },
        { key: 'duration', label: '视频时长(秒)', type: 'number', default: 5, tooltip: '2-15秒' },
        { key: 'promptExtend', label: '智能改写', type: 'select', default: 'true', options: [{ label: '开启 (默认)', value: 'true' }, { label: '关闭', value: 'false' }] },
        NEGATIVE_PROMPT_PROP,
        WATERMARK_PROP,
        SEED_PROP,
      ],
      outputs: VIDEO_OUTPUTS,
      handler: async (ctx, args) => {
        const media = Array.isArray(args.media) ? args.media : JSON.parse(args.media)
        if (!media.length) throw new Error('需要至少1个媒体素材')
        const body = {
          model: 'wan2.7-i2v',
          input: {
            ...(args.prompt && { prompt: args.prompt }),
            ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
            media,
          },
          parameters: {
            resolution: args.resolution || '720P',
            duration: args.duration || 5,
            prompt_extend: args.promptExtend !== 'false',
            watermark: args.watermark === 'true',
            ...(args.seed != null && { seed: args.seed }),
          },
        }
        return executeAsyncTask(ctx, args.apiKey, ASYNC_ENDPOINTS.videoSynthesis, body, (result) => {
          const videoUrl = result.output?.video_url
          ctx.logger.info(`[图生视频2.7] 完成`)
          return { success: true, message: '视频生成完成', data: { videoUrl, requestId: result.request_id } }
        })
      },
    },

    // ─── 7. 万相图生视频-旧版 (ASYNC, img_url) ────────────
    {
      type: 'aliyun_image_to_video_legacy',
      label: '万相图生视频(旧版)',
      category: '阿里云AI',
      icon: 'Video',
      description: '万相2.6及早期图生视频模型，基于首帧图像生成视频（wan2.6/2.5/2.2/2.1）',
      properties: [
        API_KEY_PROP,
        PROMPT_PROP('视频描述', '描述视频内容'),
        { key: 'imageUrl', label: '首帧图片URL', type: 'text', required: true, tooltip: '首帧图像URL或Base64' },
        { key: 'model', label: '模型', type: 'select', default: 'wan2.6-i2v-flash', options: I2V_LEGACY_MODELS },
        { key: 'resolution', label: '分辨率', type: 'select', default: '720P', options: RESOLUTION_VIDEO },
        { key: 'duration', label: '视频时长(秒)', type: 'number', default: 5, tooltip: '各模型支持范围不同' },
        { key: 'audioUrl', label: '音频URL', type: 'text', tooltip: '背景音乐/配音(wan2.6/2.5支持)' },
        { key: 'promptExtend', label: '智能改写', type: 'select', default: 'true', options: [{ label: '开启 (默认)', value: 'true' }, { label: '关闭', value: 'false' }] },
        NEGATIVE_PROMPT_PROP,
        WATERMARK_PROP,
        SEED_PROP,
      ],
      outputs: VIDEO_OUTPUTS,
      handler: async (ctx, args) => {
        if (!args.imageUrl) throw new Error('缺少首帧图片URL')
        const body = {
          model: args.model || 'wan2.6-i2v-flash',
          input: {
            prompt: args.prompt || '',
            img_url: args.imageUrl,
            ...(args.audioUrl && { audio_url: args.audioUrl }),
            ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
          },
          parameters: {
            resolution: args.resolution || '720P',
            duration: args.duration || 5,
            prompt_extend: args.promptExtend !== 'false',
            watermark: args.watermark === 'true',
            ...(args.seed != null && { seed: args.seed }),
          },
        }
        return executeAsyncTask(ctx, args.apiKey, ASYNC_ENDPOINTS.videoSynthesis, body, (result) => {
          const videoUrl = result.output?.video_url
          ctx.logger.info(`[图生视频旧版] 完成`)
          return { success: true, message: '视频生成完成', data: { videoUrl, requestId: result.request_id } }
        })
      },
    },

    // ─── 8. 万相首尾帧生视频 (ASYNC) ──────────────────────
    {
      type: 'aliyun_first_last_frame_video',
      label: '首尾帧生视频',
      category: '阿里云AI',
      icon: 'Film',
      description: '万相首尾帧生视频：基于首帧和尾帧图像生成平滑过渡视频',
      properties: [
        API_KEY_PROP,
        PROMPT_PROP('视频描述', '描述画面过渡效果'),
        { key: 'firstFrameUrl', label: '首帧图片URL', type: 'text', required: true, tooltip: '首帧图像URL' },
        { key: 'lastFrameUrl', label: '尾帧图片URL', type: 'text', required: true, tooltip: '尾帧图像URL' },
        { key: 'model', label: '模型', type: 'select', default: 'wan2.2-kf2v-flash', options: KF2V_MODELS },
        { key: 'resolution', label: '分辨率', type: 'select', default: '720P', options: RESOLUTION_VIDEO },
        { key: 'promptExtend', label: '智能改写', type: 'select', default: 'true', options: [{ label: '开启 (默认)', value: 'true' }, { label: '关闭', value: 'false' }] },
        NEGATIVE_PROMPT_PROP,
        WATERMARK_PROP,
        SEED_PROP,
      ],
      outputs: VIDEO_OUTPUTS,
      handler: async (ctx, args) => {
        if (!args.firstFrameUrl) throw new Error('缺少首帧图片URL')
        if (!args.lastFrameUrl) throw new Error('缺少尾帧图片URL')
        const body = {
          model: args.model || 'wan2.2-kf2v-flash',
          input: {
            prompt: args.prompt || '',
            first_frame_url: args.firstFrameUrl,
            last_frame_url: args.lastFrameUrl,
            ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
          },
          parameters: {
            resolution: args.resolution || '720P',
            prompt_extend: args.promptExtend !== 'false',
            watermark: args.watermark === 'true',
            ...(args.seed != null && { seed: args.seed }),
          },
        }
        return executeAsyncTask(ctx, args.apiKey, ASYNC_ENDPOINTS.image2video, body, (result) => {
          const videoUrl = result.output?.video_url
          ctx.logger.info(`[首尾帧生视频] 完成`)
          return { success: true, message: '视频生成完成', data: { videoUrl, requestId: result.request_id } }
        })
      },
    },

    // ─── 9. 万相参考生视频 (ASYNC) ────────────────────────
    {
      type: 'aliyun_reference_video',
      label: '参考生视频',
      category: '阿里云AI',
      icon: 'UserRound',
      description: '万相2.7参考生视频：将人或物体作为主角生成视频，支持多角色互动',
      properties: [
        API_KEY_PROP,
        PROMPT_PROP('视频描述', '用"图1""视频1"指代参考素材，描述视频内容'),
        { key: 'media', label: '参考素材', type: 'textarea', required: true, tooltip: 'JSON数组，如 [{"type":"reference_image","url":"https://...","reference_voice":"https://...mp3"}]' },
        { key: 'resolution', label: '分辨率', type: 'select', default: '720P', options: [
          { label: '720P', value: '720P' },
          { label: '1080P', value: '1080P' },
        ] },
        { key: 'ratio', label: '宽高比', type: 'select', default: '16:9', options: ASPECT_RATIO },
        { key: 'duration', label: '视频时长(秒)', type: 'number', default: 5, tooltip: '2-15秒' },
        { key: 'promptExtend', label: '智能改写', type: 'select', default: 'true', options: [{ label: '开启 (默认)', value: 'true' }, { label: '关闭', value: 'false' }] },
        NEGATIVE_PROMPT_PROP,
        WATERMARK_PROP,
        SEED_PROP,
      ],
      outputs: VIDEO_OUTPUTS,
      handler: async (ctx, args) => {
        const media = Array.isArray(args.media) ? args.media : JSON.parse(args.media)
        if (!media.length) throw new Error('需要至少1个参考素材')
        const body = {
          model: 'wan2.7-r2v',
          input: {
            prompt: args.prompt,
            ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
            media,
          },
          parameters: {
            resolution: args.resolution || '720P',
            ratio: args.ratio || '16:9',
            duration: args.duration || 5,
            prompt_extend: args.promptExtend !== 'false',
            watermark: args.watermark === 'true',
            ...(args.seed != null && { seed: args.seed }),
          },
        }
        return executeAsyncTask(ctx, args.apiKey, ASYNC_ENDPOINTS.videoSynthesis, body, (result) => {
          const videoUrl = result.output?.video_url
          ctx.logger.info(`[参考生视频] 完成`)
          return { success: true, message: '视频生成完成', data: { videoUrl, requestId: result.request_id } }
        })
      },
    },

    // ─── 10. 万相文生视频 (ASYNC) ─────────────────────────
    {
      type: 'aliyun_text_to_video',
      label: '万相文生视频',
      category: '阿里云AI',
      icon: 'Clapperboard',
      description: '万相2.7文生视频：基于文字描述生成视频，支持多镜头叙事、自动配音',
      properties: [
        API_KEY_PROP,
        PROMPT_PROP('视频描述', '详细描述视频场景、镜头、角色等'),
        { key: 'resolution', label: '分辨率', type: 'select', default: '720P', options: [
          { label: '720P', value: '720P' },
          { label: '1080P', value: '1080P' },
        ] },
        { key: 'ratio', label: '宽高比', type: 'select', default: '16:9', options: ASPECT_RATIO },
        { key: 'duration', label: '视频时长(秒)', type: 'number', default: 5, tooltip: '2-15秒' },
        { key: 'audioUrl', label: '音频URL', type: 'text', tooltip: '背景音乐/配音音频URL（可选）' },
        { key: 'promptExtend', label: '智能改写', type: 'select', default: 'true', options: [{ label: '开启 (默认)', value: 'true' }, { label: '关闭', value: 'false' }] },
        NEGATIVE_PROMPT_PROP,
        WATERMARK_PROP,
        SEED_PROP,
      ],
      outputs: VIDEO_OUTPUTS,
      handler: async (ctx, args) => {
        const body = {
          model: 'wan2.7-t2v',
          input: {
            prompt: args.prompt,
            ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
            ...(args.audioUrl && { audio_url: args.audioUrl }),
          },
          parameters: {
            resolution: args.resolution || '720P',
            ratio: args.ratio || '16:9',
            duration: args.duration || 5,
            prompt_extend: args.promptExtend !== 'false',
            watermark: args.watermark === 'true',
            ...(args.seed != null && { seed: args.seed }),
          },
        }
        return executeAsyncTask(ctx, args.apiKey, ASYNC_ENDPOINTS.videoSynthesis, body, (result) => {
          const videoUrl = result.output?.video_url
          ctx.logger.info(`[文生视频] 完成`)
          return { success: true, message: '视频生成完成', data: { videoUrl, requestId: result.request_id } }
        })
      },
    },

    // ─── 11. 万相视频编辑 (ASYNC) ─────────────────────────
    {
      type: 'aliyun_video_editing',
      label: '万相视频编辑',
      category: '阿里云AI',
      icon: 'PenTool',
      description: '万相2.7视频编辑：支持指令编辑（改风格）和参考图编辑（局部替换）',
      properties: [
        API_KEY_PROP,
        PROMPT_PROP('编辑指令', '如"将画面转换为黏土风格"或"将衣服替换为参考图中的衣服"'),
        { key: 'videoUrl', label: '视频URL', type: 'text', required: true, tooltip: '待编辑的视频URL(mp4/mov, 2-10秒)' },
        { key: 'referenceImages', label: '参考图片URL', type: 'textarea', tooltip: '参考图URL数组(可选)，如 ["https://..."]，最多4张' },
        { key: 'resolution', label: '分辨率', type: 'select', default: '720P', options: [
          { label: '720P', value: '720P' },
          { label: '1080P', value: '1080P' },
        ] },
        { key: 'duration', label: '输出时长(秒)', type: 'number', tooltip: '0=使用原视频时长，2-10秒可截断' },
        { key: 'audioSetting', label: '声音设置', type: 'select', default: 'auto', options: [
          { label: '自动 (默认)', value: 'auto' },
          { label: '保留原声', value: 'origin' },
        ] },
        { key: 'promptExtend', label: '智能改写', type: 'select', default: 'true', options: [{ label: '开启 (默认)', value: 'true' }, { label: '关闭', value: 'false' }] },
        NEGATIVE_PROMPT_PROP,
        WATERMARK_PROP,
        SEED_PROP,
      ],
      outputs: VIDEO_OUTPUTS,
      handler: async (ctx, args) => {
        if (!args.videoUrl) throw new Error('缺少视频URL')
        const media = [{ type: 'video', url: args.videoUrl }]
        if (args.referenceImages) {
          const imgs = Array.isArray(args.referenceImages) ? args.referenceImages : JSON.parse(args.referenceImages)
          for (const img of imgs) media.push({ type: 'reference_image', url: img })
        }
        const body = {
          model: 'wan2.7-videoedit',
          input: {
            prompt: args.prompt,
            ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
            media,
          },
          parameters: {
            resolution: args.resolution || '720P',
            prompt_extend: args.promptExtend !== 'false',
            ...(args.duration && { duration: args.duration }),
            ...(args.audioSetting && { audio_setting: args.audioSetting }),
            watermark: args.watermark === 'true',
            ...(args.seed != null && { seed: args.seed }),
          },
        }
        return executeAsyncTask(ctx, args.apiKey, ASYNC_ENDPOINTS.videoSynthesis, body, (result) => {
          const videoUrl = result.output?.video_url
          ctx.logger.info(`[视频编辑] 完成`)
          return { success: true, message: '视频编辑完成', data: { videoUrl, requestId: result.request_id } }
        })
      },
    },

    // ─── 12. 万相图生动作 (ASYNC) ──────────────────────────
    {
      type: 'aliyun_animate_move',
      label: '万相图生动作',
      category: '阿里云AI',
      icon: 'PersonStanding',
      description: '万相图生动作：将参考视频的动作/表情迁移到人物图片中',
      properties: [
        API_KEY_PROP,
        { key: 'imageUrl', label: '人物图片URL', type: 'text', required: true, tooltip: '人物图片URL（正面、单人、清晰）' },
        { key: 'videoUrl', label: '参考视频URL', type: 'text', required: true, tooltip: '参考动作视频URL（2-30秒）' },
        { key: 'mode', label: '模式', type: 'select', default: 'wan-std', options: ANIMATE_MOVE_MODES },
        WATERMARK_PROP,
      ],
      outputs: VIDEO_OUTPUTS,
      handler: async (ctx, args) => {
        if (!args.imageUrl) throw new Error('缺少人物图片URL')
        if (!args.videoUrl) throw new Error('缺少参考视频URL')
        const body = {
          model: 'wan2.2-animate-move',
          input: {
            image_url: args.imageUrl,
            video_url: args.videoUrl,
            watermark: args.watermark === 'true',
          },
          parameters: { mode: args.mode || 'wan-std' },
        }
        return executeAsyncTask(ctx, args.apiKey, ASYNC_ENDPOINTS.image2video, body, (result) => {
          const videoUrl = result.output?.video_url
          ctx.logger.info(`[图生动作] 完成`)
          return { success: true, message: '视频生成完成', data: { videoUrl, requestId: result.request_id } }
        })
      },
    },

    // ─── 13. 声动人像VideoRetalk (ASYNC) ───────────────────
    {
      type: 'aliyun_videoretalk',
      label: '声动人像',
      category: '阿里云AI',
      icon: 'Mic',
      description: '声动人像VideoRetalk：基于人物视频和人声音频生成口型匹配的新视频',
      properties: [
        API_KEY_PROP,
        { key: 'videoUrl', label: '人物视频URL', type: 'text', required: true, tooltip: '正面镜头的人物视频URL' },
        { key: 'audioUrl', label: '人声音频URL', type: 'text', required: true, tooltip: '人声清晰的音频文件URL(wav/mp3)' },
      ],
      outputs: VIDEO_OUTPUTS,
      handler: async (ctx, args) => {
        if (!args.videoUrl) throw new Error('缺少人物视频URL')
        if (!args.audioUrl) throw new Error('缺少人声音频URL')
        const body = {
          model: 'videoretalk',
          input: {
            video_url: args.videoUrl,
            audio_url: args.audioUrl,
          },
        }
        return executeAsyncTask(ctx, args.apiKey, ASYNC_ENDPOINTS.videoSynthesis, body, (result) => {
          const videoUrl = result.output?.video_url
          ctx.logger.info(`[声动人像] 完成`)
          return { success: true, message: '视频生成完成', data: { videoUrl, requestId: result.request_id } }
        })
      },
    },
  ],
}
