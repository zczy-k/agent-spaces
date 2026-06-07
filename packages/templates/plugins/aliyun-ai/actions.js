// ============================================================
// 阿里云百炼 AI 插件 - 统一 Actions
// 合并自: tools-asr.js, tools-image.js, tools-upload.js, tools-video.js, workflow.js
// ============================================================

const shared = require('./shared')

const {
  SYNC_ENDPOINT,
  ASYNC_ENDPOINTS,
  getHeaders,
  extractImageUrls,
  extractLegacyImageUrls,
  executeAsyncTask,
} = shared

// ASR specific constants
const TASK_SUBMIT_ENDPOINT = '/api/v1/services/audio/asr/transcription'
const TASK_QUERY_BASE = 'https://dashscope.aliyuncs.com/api/v1/tasks'
const QWEN_SYNC_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
const UPLOAD_POLICY_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/uploads'

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

// ── Common property definitions ─────────────────────────────

const CONFIG_PREFIX = '{{ __config__["workflow.aliyun-ai"]'

const API_KEY_PROP = { key: 'apiKey', label: 'API Key', type: 'text', required: true, tooltip: '阿里云百炼 DashScope API Key', default: `${CONFIG_PREFIX}["apiKey"]}}` }
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

// ── ASR Helpers ──────────────────────────────────────────────

function parseArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    return JSON.parse(value)
  } catch {
    return [value]
  }
}

function extractAsrTexts(transcription) {
  const texts = []
  const transcripts = transcription.transcripts || []
  for (const transcript of transcripts) {
    if (transcript.text) {
      texts.push(transcript.text)
    } else if (transcript.sentences) {
      const sentenceTexts = transcript.sentences.map(s => s.text).filter(Boolean)
      texts.push(...sentenceTexts)
    }
  }
  return texts
}

async function fetchAsrTranscriptionContent(ctx, pollResult) {
  const output = pollResult.output || {}
  const items = output.results || (output.result ? [output.result] : [])

  const texts = []
  const details = []

  for (const item of items) {
    if (item.subtask_status === 'FAILED') {
      details.push({
        fileUrl: item.file_url || '',
        status: 'FAILED',
        error: `${item.code || ''} - ${item.message || ''}`,
      })
      continue
    }

    const transcriptionUrl = item.transcription_url
    if (!transcriptionUrl) continue

    const transcription = await ctx.api.getJson(transcriptionUrl, { timeout: 30000 })
    const transcriptTexts = extractAsrTexts(transcription)
    texts.push(...transcriptTexts)
    details.push({
      fileUrl: transcription.file_url || item.file_url || '',
      status: 'SUCCEEDED',
      text: transcriptTexts.join('\n'),
      properties: transcription.properties || null,
      sentences: transcription.transcripts || null,
    })
  }

  const fullText = texts.join('\n')
  ctx.logger.info(`[ASR] 识别完成，共提取 ${texts.length} 段文本`)

  return {
    success: true,
    message: `识别完成，共 ${details.length} 个文件，${texts.length} 段文本`,
    data: {
      text: fullText,
      details,
      taskId: output.task_id,
      usage: pollResult.usage || null,
    },
  }
}

// ── Async task helper (for workflow context with ctx.logger) ──

async function executeAsyncTaskCtx(ctx, apiKey, endpoint, body, extractResult) {
  const asyncHeaders = { ...getHeaders({ apiKey }), 'X-DashScope-Async': 'enable' }

  ctx.logger.info(`创建异步任务: ${endpoint}`)
  ctx.logger.info(`模型: ${body.model}`)
  const createResult = await ctx.api.postJson(endpoint, { headers: asyncHeaders, body, timeout: 600000 })

  if (createResult.code || createResult.message) {
    ctx.logger.error(`创建任务失败: ${createResult.code} - ${createResult.message}`)
    return { success: false, message: `创建任务失败: ${createResult.code} - ${createResult.message}` }
  }

  const taskId = createResult.output?.task_id
  if (!taskId) {
    return { success: false, message: '创建任务成功但未获取到 task_id' }
  }
  ctx.logger.info(`任务已创建: ${taskId}, 状态: ${createResult.output.task_status}`)

  const pollHeaders = getHeaders({ apiKey })
  const TASK_QUERY_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/tasks'
  const maxAttempts = 120
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

// ── Actions ────────────────────────────────────────────────

module.exports = [
  // ─── 1. AI文生图 (SYNC) ────────────────────────────────
  {
    name: 'aliyun_text_to_image',
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
    toolProperties: {
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
    outputs: IMAGE_OUTPUTS,
    run: async (ctx, args) => {
      const headers = getHeaders(args)
      const body = {
        model: args.model || 'qwen-image-2.0-pro',
        input: { messages: [{ role: 'user', content: [{ text: args.prompt }] }] },
        parameters: {
          size: args.size || '2048*2048',
          ...(args.n && { n: args.n }),
          ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
          ...(args.seed != null && { seed: args.seed }),
          prompt_extend: args.promptExtend !== 'false' && args.promptExtend !== false,
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
    name: 'aliyun_image_edit',
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
    toolProperties: {
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
    outputs: IMAGE_OUTPUTS,
    run: async (ctx, args) => {
      const images = Array.isArray(args.images) ? args.images : (() => { try { return JSON.parse(args.images) } catch { return [] } })()
      if (!images.length) return { success: false, message: '需要至少1张输入图片' }
      const headers = getHeaders(args)
      const content = images.map(img => ({ image: img }))
      content.push({ text: args.prompt })
      const body = {
        model: args.model || 'qwen-image-2.0-pro',
        input: { messages: [{ role: 'user', content }] },
        parameters: {
          size: args.size || '2048*2048',
          ...(args.n && { n: args.n }),
          ...(args.negativePrompt && { negative_prompt: args.negativePrompt }),
          prompt_extend: args.promptExtend !== 'false' && args.promptExtend !== false,
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
    name: 'aliyun_wan_text_to_image_legacy',
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
    toolProperties: {
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
    outputs: IMAGE_OUTPUTS,
    run: async (ctx, args) => {
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
          prompt_extend: args.promptExtend !== 'false' && args.promptExtend !== false,
        },
      }
      return executeAsyncTaskCtx(ctx, args.apiKey, ASYNC_ENDPOINTS.wanText2Image, body, (result) => {
        const urls = extractLegacyImageUrls(result)
        ctx.logger.info(`[万相文生图] 完成，${urls.length} 张图片`)
        return { success: true, message: `生成 ${urls.length} 张图片`, data: { images: urls, requestId: result.request_id } }
      })
    },
  },

  // ─── 4. 图像画面扩展/扩图 (ASYNC) ──────────────────────
  {
    name: 'aliyun_image_out_painting',
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
    toolProperties: {
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
    outputs: [
      { key: 'success', type: 'boolean' },
      { key: 'message', type: 'string' },
      { key: 'data', type: 'object', children: [
        { key: 'imageUrl', type: 'string' },
        { key: 'requestId', type: 'string' },
      ] },
    ],
    run: async (ctx, args) => {
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
      return executeAsyncTaskCtx(ctx, args.apiKey, ASYNC_ENDPOINTS.outPainting, body, (result) => {
        const url = result.output?.output_image_url
        ctx.logger.info('[图像扩图] 完成')
        return { success: true, message: '图像扩图完成', data: { imageUrl: url, requestId: result.request_id } }
      })
    },
  },

  // ─── 5. 可灵图像生成 (ASYNC) ───────────────────────────
  {
    name: 'aliyun_kling_image_generation',
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
    toolProperties: {
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
    outputs: IMAGE_OUTPUTS,
    run: async (ctx, args) => {
      const content = [{ text: args.prompt }]
      if (args.images) {
        const imgs = Array.isArray(args.images) ? args.images : (() => { try { return JSON.parse(args.images) } catch { return [] } })()
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
      return executeAsyncTaskCtx(ctx, args.apiKey, ASYNC_ENDPOINTS.klingImage, body, (result) => {
        const urls = extractImageUrls(result)
        ctx.logger.info(`[可灵生图] 完成，${urls.length} 张图片`)
        return { success: true, message: `生成 ${urls.length} 张图片`, data: { images: urls, requestId: result.request_id } }
      })
    },
  },

  // ─── 6. 万相图生视频-wan2.7 (ASYNC) ──────────────────
  {
    name: 'aliyun_image_to_video_v27',
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
    toolProperties: {
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
    outputs: VIDEO_OUTPUTS,
    run: async (ctx, args) => {
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
          prompt_extend: args.promptExtend !== 'false' && args.promptExtend !== false,
          watermark: args.watermark === 'true' || args.watermark === true,
          ...(args.seed != null && { seed: args.seed }),
        },
      }
      return executeAsyncTaskCtx(ctx, args.apiKey, ASYNC_ENDPOINTS.videoSynthesis, body, (result) => {
        const videoUrl = result.output?.video_url
        ctx.logger.info('[图生视频2.7] 完成')
        return { success: true, message: '视频生成完成', data: { videoUrl, requestId: result.request_id } }
      })
    },
  },

  // ─── 7. 万相图生视频-旧版 (ASYNC) ────────────────────
  {
    name: 'aliyun_image_to_video_legacy',
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
    toolProperties: {
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
    outputs: VIDEO_OUTPUTS,
    run: async (ctx, args) => {
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
          prompt_extend: args.promptExtend !== 'false' && args.promptExtend !== false,
          watermark: args.watermark === 'true' || args.watermark === true,
          ...(args.seed != null && { seed: args.seed }),
        },
      }
      return executeAsyncTaskCtx(ctx, args.apiKey, ASYNC_ENDPOINTS.videoSynthesis, body, (result) => {
        const videoUrl = result.output?.video_url
        ctx.logger.info('[图生视频旧版] 完成')
        return { success: true, message: '视频生成完成', data: { videoUrl, requestId: result.request_id } }
      })
    },
  },

  // ─── 8. 万相首尾帧生视频 (ASYNC) ──────────────────────
  {
    name: 'aliyun_first_last_frame_video',
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
    toolProperties: {
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
    outputs: VIDEO_OUTPUTS,
    run: async (ctx, args) => {
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
          prompt_extend: args.promptExtend !== 'false' && args.promptExtend !== false,
          watermark: args.watermark === 'true' || args.watermark === true,
          ...(args.seed != null && { seed: args.seed }),
        },
      }
      return executeAsyncTaskCtx(ctx, args.apiKey, ASYNC_ENDPOINTS.image2video, body, (result) => {
        const videoUrl = result.output?.video_url
        ctx.logger.info('[首尾帧生视频] 完成')
        return { success: true, message: '视频生成完成', data: { videoUrl, requestId: result.request_id } }
      })
    },
  },

  // ─── 9. 万相参考生视频 (ASYNC) ────────────────────────
  {
    name: 'aliyun_reference_video',
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
    toolProperties: {
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
    outputs: VIDEO_OUTPUTS,
    run: async (ctx, args) => {
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
          prompt_extend: args.promptExtend !== 'false' && args.promptExtend !== false,
          watermark: args.watermark === 'true' || args.watermark === true,
          ...(args.seed != null && { seed: args.seed }),
        },
      }
      return executeAsyncTaskCtx(ctx, args.apiKey, ASYNC_ENDPOINTS.videoSynthesis, body, (result) => {
        const videoUrl = result.output?.video_url
        ctx.logger.info('[参考生视频] 完成')
        return { success: true, message: '视频生成完成', data: { videoUrl, requestId: result.request_id } }
      })
    },
  },

  // ─── 10. 万相文生视频 (ASYNC) ─────────────────────────
  {
    name: 'aliyun_text_to_video',
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
    toolProperties: {
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
    outputs: VIDEO_OUTPUTS,
    run: async (ctx, args) => {
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
          prompt_extend: args.promptExtend !== 'false' && args.promptExtend !== false,
          watermark: args.watermark === 'true' || args.watermark === true,
          ...(args.seed != null && { seed: args.seed }),
        },
      }
      return executeAsyncTaskCtx(ctx, args.apiKey, ASYNC_ENDPOINTS.videoSynthesis, body, (result) => {
        const videoUrl = result.output?.video_url
        ctx.logger.info('[文生视频] 完成')
        return { success: true, message: '视频生成完成', data: { videoUrl, requestId: result.request_id } }
      })
    },
  },

  // ─── 11. 万相视频编辑 (ASYNC) ─────────────────────────
  {
    name: 'aliyun_video_editing',
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
    toolProperties: {
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
    outputs: VIDEO_OUTPUTS,
    run: async (ctx, args) => {
      if (!args.videoUrl) throw new Error('缺少视频URL')
      const media = [{ type: 'video', url: args.videoUrl }]
      if (args.referenceImages) {
        const imgs = Array.isArray(args.referenceImages) ? args.referenceImages : (() => { try { return JSON.parse(args.referenceImages) } catch { return [] } })()
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
          prompt_extend: args.promptExtend !== 'false' && args.promptExtend !== false,
          ...(args.duration && { duration: args.duration }),
          ...(args.audioSetting && { audio_setting: args.audioSetting }),
          watermark: args.watermark === 'true' || args.watermark === true,
          ...(args.seed != null && { seed: args.seed }),
        },
      }
      return executeAsyncTaskCtx(ctx, args.apiKey, ASYNC_ENDPOINTS.videoSynthesis, body, (result) => {
        const videoUrl = result.output?.video_url
        ctx.logger.info('[视频编辑] 完成')
        return { success: true, message: '视频编辑完成', data: { videoUrl, requestId: result.request_id } }
      })
    },
  },

  // ─── 12. 万相图生动作 (ASYNC) ──────────────────────────
  {
    name: 'aliyun_animate_move',
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
    toolProperties: {
      type: 'object',
      properties: {
        apiKey: { type: 'string', description: 'API Key' },
        imageUrl: { type: 'string', description: '人物图片URL(正面单人清晰)' },
        videoUrl: { type: 'string', description: '参考动作视频URL(2-30秒)' },
        mode: { type: 'string', description: 'wan-std(标准)或wan-pro(专业)，默认wan-std' },
      },
      required: ['apiKey', 'imageUrl', 'videoUrl'],
    },
    outputs: VIDEO_OUTPUTS,
    run: async (ctx, args) => {
      if (!args.imageUrl) throw new Error('缺少人物图片URL')
      if (!args.videoUrl) throw new Error('缺少参考视频URL')
      const body = {
        model: 'wan2.2-animate-move',
        input: {
          image_url: args.imageUrl,
          video_url: args.videoUrl,
          watermark: args.watermark === 'true' || args.watermark === true,
        },
        parameters: { mode: args.mode || 'wan-std' },
      }
      return executeAsyncTaskCtx(ctx, args.apiKey, ASYNC_ENDPOINTS.image2video, body, (result) => {
        const videoUrl = result.output?.video_url
        ctx.logger.info('[图生动作] 完成')
        return { success: true, message: '视频生成完成', data: { videoUrl, requestId: result.request_id } }
      })
    },
  },

  // ─── 13. 声动人像VideoRetalk (ASYNC) ───────────────────
  {
    name: 'aliyun_videoretalk',
    label: '声动人像',
    category: '阿里云AI',
    icon: 'Mic',
    description: '声动人像VideoRetalk：基于人物视频和人声音频生成口型匹配的新视频',
    properties: [
      API_KEY_PROP,
      { key: 'videoUrl', label: '人物视频URL', type: 'text', required: true, tooltip: '正面镜头的人物视频URL' },
      { key: 'audioUrl', label: '人声音频URL', type: 'text', required: true, tooltip: '人声清晰的音频文件URL(wav/mp3)' },
    ],
    toolProperties: {
      type: 'object',
      properties: {
        apiKey: { type: 'string', description: 'API Key' },
        videoUrl: { type: 'string', description: '人物视频URL(正面镜头)' },
        audioUrl: { type: 'string', description: '人声音频URL(wav/mp3)' },
      },
      required: ['apiKey', 'videoUrl', 'audioUrl'],
    },
    outputs: VIDEO_OUTPUTS,
    run: async (ctx, args) => {
      if (!args.videoUrl) throw new Error('缺少人物视频URL')
      if (!args.audioUrl) throw new Error('缺少人声音频URL')
      const body = {
        model: 'videoretalk',
        input: {
          video_url: args.videoUrl,
          audio_url: args.audioUrl,
        },
      }
      return executeAsyncTaskCtx(ctx, args.apiKey, ASYNC_ENDPOINTS.image2video, body, (result) => {
        const videoUrl = result.output?.video_url
        ctx.logger.info('[声动人像] 完成')
        return { success: true, message: '视频生成完成', data: { videoUrl, requestId: result.request_id } }
      })
    },
  },

  // ─── 14. 上传文件到百炼临时存储 ──────────────────────
  {
    name: 'aliyun_upload_file',
    label: '上传文件(百炼)',
    category: '阿里云AI',
    icon: 'Upload',
    description: '上传本地文件到阿里云百炼临时存储空间，获取 oss:// 临时URL（有效期48小时）',
    toolProperties: {
      type: 'object',
      properties: {
        apiKey: { type: 'string', description: '阿里云百炼 DashScope API Key' },
        filePath: { type: 'string', description: '本地文件路径' },
        model: { type: 'string', description: '目标模型名（文件与模型绑定，须与后续调用一致），如 qwen-vl-plus、wan2.7-i2v 等' },
      },
      required: ['apiKey', 'filePath', 'model'],
    },
    properties: [
      API_KEY_PROP,
      { key: 'filePath', label: '本地文件路径', type: 'text', required: true, tooltip: '本地文件的完整路径' },
      { key: 'model', label: '目标模型', type: 'text', required: true, tooltip: '目标模型名，如 qwen-vl-plus、wan2.7-i2v' },
    ],
    outputs: [
      { key: 'success', type: 'boolean' },
      { key: 'message', type: 'string' },
      { key: 'data', type: 'object', children: [
        { key: 'url', type: 'string' },
        { key: 'fileName', type: 'string' },
        { key: 'key', type: 'string' },
        { key: 'model', type: 'string' },
      ] },
    ],
    run: async (ctx, args) => {
      const { apiKey, filePath, model } = args
      if (!apiKey || !filePath || !model) {
        return { success: false, message: '缺少必要参数: apiKey, filePath, model' }
      }

      // 1. 获取上传凭证
      const policyHeaders = getHeaders(args)
      const policyUrl = `${UPLOAD_POLICY_ENDPOINT}?action=getPolicy&model=${encodeURIComponent(model)}`
      const policyResult = await ctx.api.getJson(policyUrl, { headers: policyHeaders, timeout: 30000 })

      if (!policyResult.data) {
        return { success: false, message: `获取上传凭证失败: ${policyResult.message || JSON.stringify(policyResult)}` }
      }

      const policy = policyResult.data
      const fileName = filePath.split(/[/\\]/).pop()
      const key = `${policy.upload_dir}/${fileName}`

      // 2. 上传文件到 OSS
      const uploaded = await ctx.api.uploadFile(policy.upload_host, {
        fields: {
          OSSAccessKeyId: policy.oss_access_key_id,
          Signature: policy.signature,
          policy: policy.policy,
          'x-oss-object-acl': policy.x_oss_object_acl,
          'x-oss-forbid-overwrite': policy.x_oss_forbid_overwrite,
          key,
          success_action_status: '200',
        },
        filePath,
      })

      if (!uploaded) {
        return { success: false, message: '文件上传失败' }
      }

      // 3. 拼接临时 URL
      const ossUrl = `oss://${key}`
      const maxSizeInfo = policy.max_file_size_mb ? `，文件大小限制 ${policy.max_file_size_mb}MB` : ''

      return {
        success: true,
        message: `文件上传成功，临时URL有效期48小时${maxSizeInfo}`,
        data: {
          url: ossUrl,
          fileName,
          key,
          model,
          expireInSeconds: policy.expire_in_seconds,
        },
      }
    },
  },

  // ─── 15. 录音文件异步转写 (ASYNC) ──────────────────────
  {
    name: 'asr_file_recognition',
    label: '录音文件转写',
    category: '语音识别',
    icon: 'FileAudio',
    description: '提交音频/视频文件URL进行异步语音识别，支持 FunASR/Paraformer/Qwen 等多种模型，自动轮询获取转写结果',
    properties: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true, tooltip: '阿里云百炼 DashScope API Key', default: `${CONFIG_PREFIX}["apiKey"]}}` },
      { key: 'baseUrl', label: 'API 地址', type: 'text', default: '{{ __config__["workflow.aliyun-ai"]["baseUrl"] || "https://dashscope.aliyuncs.com" }}', tooltip: 'DashScope API 基础地址' },
      { key: 'model', label: '识别模型', type: 'select', default: 'paraformer-v2', options: [
        { label: 'paraformer-v2 (推荐多语种)', value: 'paraformer-v2' },
        { label: 'paraformer-8k-v2 (8kHz电话)', value: 'paraformer-8k-v2' },
        { label: 'paraformer-v1 (中英文)', value: 'paraformer-v1' },
        { label: 'paraformer-8k-v1 (8kHz)', value: 'paraformer-8k-v1' },
        { label: 'paraformer-mtl-v1 (多语种)', value: 'paraformer-mtl-v1' },
        { label: 'fun-asr (中英文)', value: 'fun-asr' },
        { label: 'qwen3-asr-flash-filetrans (千问长音频)', value: 'qwen3-asr-flash-filetrans' },
      ], tooltip: '不同模型支持的语种和采样率不同' },
      { key: 'fileUrls', label: '音频文件URL', type: 'textarea', required: true, tooltip: 'FunASR/Paraformer: URL数组，如 ["https://...mp3"]，最多100个' },
      { key: 'fileUrl', label: '音频文件URL(Qwen)', type: 'text', tooltip: '仅 Qwen-Filetrans: 单个音频文件URL' },
      { key: 'languageHints', label: '语言提示', type: 'text', tooltip: 'Paraformer-v2 语言代码数组，如 ["zh","en"]' },
      { key: 'language', label: '语言(Qwen)', type: 'select', default: '', options: [
        { label: '自动检测', value: '' },
        { label: 'zh 中文', value: 'zh' },
        { label: 'en 英文', value: 'en' },
        { label: 'ja 日语', value: 'ja' },
        { label: 'ko 韩语', value: 'ko' },
        { label: 'yue 粤语', value: 'yue' },
        { label: 'de 德语', value: 'de' },
        { label: 'fr 法语', value: 'fr' },
        { label: 'ru 俄语', value: 'ru' },
      ], tooltip: 'Qwen-Filetrans 指定语种' },
      { key: 'diarizationEnabled', label: '说话人分离', type: 'boolean', default: false, tooltip: '开启后识别结果中会区分不同说话人' },
      { key: 'speakerCount', label: '说话人数量', type: 'number', tooltip: '说话人数量参考值(2-100)，需先开启说话人分离' },
      { key: 'channelId', label: '音轨索引', type: 'text', tooltip: '指定音轨，如 [0] 或 [0,1]' },
      { key: 'enableItn', label: '逆文本标准化', type: 'boolean', default: false, tooltip: 'Qwen-Filetrans: 是否启用 ITN' },
    ],
    toolProperties: {
      type: 'object',
      properties: {
        apiKey: { type: 'string', description: '阿里云百炼 DashScope API Key' },
        baseUrl: { type: 'string', description: 'DashScope API 地址，默认 https://dashscope.aliyuncs.com' },
        model: { type: 'string', description: '识别模型。paraformer-v2(推荐多语种)/fun-asr(中英文)/qwen3-asr-flash-filetrans(千问长音频) 等' },
        fileUrls: { type: 'array', items: { type: 'string' }, description: 'FunASR/Paraformer: 音频文件URL列表（最多100个）' },
        fileUrl: { type: 'string', description: 'Qwen-Filetrans: 单个音频文件URL' },
        languageHints: { type: 'array', items: { type: 'string' }, description: 'Paraformer-v2 语言提示，如 ["zh","en"]' },
        language: { type: 'string', description: 'Qwen-Filetrans 指定语言代码（zh/en/ja/ko 等）' },
        diarizationEnabled: { type: 'boolean', description: '是否开启说话人分离（默认关闭）' },
        speakerCount: { type: 'integer', description: '说话人数量参考值（2-100）' },
      },
      required: ['apiKey'],
    },
    outputs: [
      { key: 'success', type: 'boolean' },
      { key: 'message', type: 'string' },
      { key: 'data', type: 'object', children: [
        { key: 'text', type: 'string' },
        { key: 'details', type: 'object', children: [] },
        { key: 'taskId', type: 'string' },
      ] },
    ],
    run: async (ctx, args) => {
      const baseUrl = (args.baseUrl || 'https://dashscope.aliyuncs.com').replace(/\/$/, '')
      const apiKey = args.apiKey
      const model = args.model || 'paraformer-v2'
      const isQwenFiletrans = model.startsWith('qwen')

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-DashScope-Async': 'enable',
      }

      const body = { model }

      if (isQwenFiletrans) {
        const fileUrl = args.fileUrl
        if (!fileUrl) throw new Error('Qwen-Filetrans 模型需要提供 fileUrl（单个音频文件URL）')
        body.input = { file_url: fileUrl }
        body.parameters = {}
        if (args.channelId) body.parameters.channel_id = parseArray(args.channelId)
        if (args.language) body.parameters.language = args.language
        if (args.enableItn !== undefined) body.parameters.enable_itn = args.enableItn
      } else {
        const fileUrls = parseArray(args.fileUrls)
        if (fileUrls.length === 0) throw new Error('需要提供 fileUrls（音频文件URL数组）')
        body.input = { file_urls: fileUrls }
        body.parameters = {}
        if (args.channelId) body.parameters.channel_id = parseArray(args.channelId)
        if (args.vocabularyId) body.parameters.vocabulary_id = args.vocabularyId
        if (args.specialWordFilter) body.parameters.special_word_filter = args.specialWordFilter
        if (args.diarizationEnabled !== undefined) body.parameters.diarization_enabled = args.diarizationEnabled
        if (args.speakerCount) body.parameters.speaker_count = args.speakerCount
        if (args.languageHints) body.parameters.language_hints = parseArray(args.languageHints)
        if (args.disfluencyRemovalEnabled !== undefined) body.parameters.disfluency_removal_enabled = args.disfluencyRemovalEnabled
        if (args.timestampAlignmentEnabled !== undefined) body.parameters.timestamp_alignment_enabled = args.timestampAlignmentEnabled
      }

      ctx.logger.info(`[ASR] 提交语音识别任务: 模型=${model}`)

      const submitEndpoint = `${baseUrl}/api/v1/services/audio/asr/transcription`
      const createResult = await ctx.api.postJson(submitEndpoint, { headers, body, timeout: 600000 })

      if (createResult.code || createResult.message) {
        throw new Error(`创建任务失败: ${createResult.code} - ${createResult.message}`)
      }

      const taskId = createResult.output?.task_id
      if (!taskId) throw new Error('创建任务成功但未获取到 task_id')

      ctx.logger.info(`[ASR] 任务已提交: task_id=${taskId}，开始轮询...`)

      const pollHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      }
      const taskQueryBase = `${baseUrl}/api/v1/tasks`
      const maxAttempts = 120
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000))
        const pollResult = await ctx.api.getJson(`${taskQueryBase}/${taskId}`, { headers: pollHeaders, timeout: 30000 })
        const status = pollResult.output?.task_status
        ctx.logger.info(`[ASR] 任务 ${taskId} 状态: ${status}`)

        if (status === 'SUCCEEDED') {
          return fetchAsrTranscriptionContent(ctx, pollResult)
        }
        if (status === 'FAILED') {
          throw new Error(`任务失败: ${pollResult.output?.code || ''} - ${pollResult.output?.message || '未知错误'}`)
        }
        if (status === 'UNKNOWN' || status === 'CANCELED') {
          throw new Error(`任务异常: ${status}`)
        }
      }
      throw new Error('轮询超时（已等待 10 分钟）')
    },
  },

  // ─── 16. 千问实时语音识别 (SYNC) ──────────────────────
  {
    name: 'asr_qwen_flash',
    label: '千问实时语音识别',
    category: '语音识别',
    icon: 'AudioLines',
    description: '千问 Qwen-ASR 实时语音识别（同步模式），适用于短音频快速转写，支持语种检测和情感分析',
    properties: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true, tooltip: '阿里云百炼 DashScope API Key', default: `${CONFIG_PREFIX}["apiKey"]}}` },
      { key: 'baseUrl', label: 'API 地址', type: 'text', default: '{{ __config__["workflow.aliyun-ai"]["baseUrl"] || "https://dashscope.aliyuncs.com" }}', tooltip: 'DashScope API 基础地址' },
      { key: 'audio', label: '音频内容', type: 'textarea', required: true, tooltip: '公网可访问的音频URL，或 Base64 Data URI（data:audio/wav;base64,...）' },
      { key: 'language', label: '语言', type: 'select', default: '', options: [
        { label: '自动检测', value: '' },
        { label: 'zh 中文', value: 'zh' },
        { label: 'en 英文', value: 'en' },
        { label: 'ja 日语', value: 'ja' },
        { label: 'ko 韩语', value: 'ko' },
        { label: 'de 德语', value: 'de' },
        { label: 'fr 法语', value: 'fr' },
        { label: 'ru 俄语', value: 'ru' },
      ], tooltip: '指定语种可提升准确率，不指定则自动检测' },
      { key: 'enableItn', label: '逆文本标准化', type: 'boolean', default: false, tooltip: '仅支持中文和英文' },
    ],
    toolProperties: {
      type: 'object',
      properties: {
        apiKey: { type: 'string', description: '阿里云百炼 DashScope API Key' },
        baseUrl: { type: 'string', description: 'DashScope API 地址，默认 https://dashscope.aliyuncs.com' },
        audio: { type: 'string', description: '音频内容：公网可访问URL 或 Base64 Data URI（data:audio/wav;base64,...）' },
        language: { type: 'string', description: '指定语种（zh/en/ja/ko/de/fr/ru 等），不指定则自动检测' },
        enableItn: { type: 'boolean', description: '是否启用逆文本标准化（ITN），默认 false' },
      },
      required: ['apiKey', 'audio'],
    },
    outputs: [
      { key: 'success', type: 'boolean' },
      { key: 'message', type: 'string' },
      { key: 'data', type: 'object', children: [
        { key: 'text', type: 'string' },
        { key: 'language', type: 'string' },
        { key: 'emotion', type: 'string' },
        { key: 'duration', type: 'number' },
      ] },
    ],
    run: async (ctx, args) => {
      const baseUrl = (args.baseUrl || 'https://dashscope.aliyuncs.com').replace(/\/$/, '')
      const apiKey = args.apiKey
      if (!args.audio) throw new Error('需要提供 audio（音频URL或Base64编码）')

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      }

      const body = {
        model: 'qwen3-asr-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'input_audio',
                input_audio: { data: args.audio },
              },
            ],
          },
        ],
        stream: false,
        asr_options: {
          ...(args.language && { language: args.language }),
          ...(args.enableItn !== undefined && { enable_itn: args.enableItn }),
        },
      }

      ctx.logger.info(`[ASR] 千问实时语音识别: 音频=${args.audio.substring(0, 100)}...`)

      const syncEndpoint = `${baseUrl}/compatible-mode/v1/chat/completions`
      const result = await ctx.api.postJson(syncEndpoint, { headers, body, timeout: 120000 })

      if (result.error) {
        throw new Error(`识别失败: ${result.error.message || JSON.stringify(result.error)}`)
      }

      const text = result.choices?.[0]?.message?.content || ''
      const annotations = result.choices?.[0]?.message?.annotations || []
      const audioInfo = annotations.find(a => a.type === 'audio_info') || {}
      const usage = result.usage || {}

      ctx.logger.info(`[ASR] 识别完成: 语种=${audioInfo.language || '未知'}, 情感=${audioInfo.emotion || '未知'}, 时长=${usage.seconds || 0}s`)

      return {
        success: true,
        message: text ? '识别完成' : '识别完成但无内容',
        data: {
          text,
          language: audioInfo.language || '',
          emotion: audioInfo.emotion || '',
          duration: usage.seconds || 0,
          usage,
        },
      }
    },
  },
]
