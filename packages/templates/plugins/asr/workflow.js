// ============================================================
// 语音识别 ASR 插件 - 工作流节点定义
// 涵盖：录音文件异步转写（FunASR/Paraformer/Qwen-Filetrans）、
//       千问 Qwen-ASR 实时语音识别（OpenAI 兼容模式）
// ============================================================

const TASK_SUBMIT_ENDPOINT = '/api/v1/services/audio/asr/transcription'
const TASK_QUERY_ENDPOINT = '/api/v1/tasks'
const QWEN_SYNC_ENDPOINT = '/compatible-mode/v1/chat/completions'

// ── Model options ──────────────────────────────────────────

const FILE_MODELS = [
  { label: 'paraformer-v2 (推荐多语种)', value: 'paraformer-v2' },
  { label: 'paraformer-8k-v2 (8kHz电话)', value: 'paraformer-8k-v2' },
  { label: 'paraformer-v1 (中英文)', value: 'paraformer-v1' },
  { label: 'paraformer-8k-v1 (8kHz)', value: 'paraformer-8k-v1' },
  { label: 'paraformer-mtl-v1 (多语种)', value: 'paraformer-mtl-v1' },
  { label: 'fun-asr (中英文)', value: 'fun-asr' },
  { label: 'qwen3-asr-flash-filetrans (千问长音频)', value: 'qwen3-asr-flash-filetrans' },
]

const LANGUAGES = [
  { label: '自动检测', value: '' },
  { label: 'zh 中文', value: 'zh' },
  { label: 'en 英文', value: 'en' },
  { label: 'ja 日语', value: 'ja' },
  { label: 'ko 韩语', value: 'ko' },
  { label: 'yue 粤语', value: 'yue' },
  { label: 'de 德语', value: 'de' },
  { label: 'fr 法语', value: 'fr' },
  { label: 'ru 俄语', value: 'ru' },
  { label: 'es 西班牙语', value: 'es' },
  { label: 'pt 葡萄牙语', value: 'pt' },
  { label: 'ar 阿拉伯语', value: 'ar' },
  { label: 'it 意大利语', value: 'it' },
  { label: 'hi 印地语', value: 'hi' },
  { label: 'id 印尼语', value: 'id' },
  { label: 'th 泰语', value: 'th' },
  { label: 'vi 越南语', value: 'vi' },
]

// ── Helpers ────────────────────────────────────────────────

function getBaseUrl(args) {
  return args.baseUrl || 'https://dashscope.aliyuncs.com'
}

function getHeaders(args) {
  const apiKey = args.apiKey
  if (!apiKey) throw new Error('缺少 apiKey')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
}

function getAsyncHeaders(args) {
  return { ...getHeaders(args), 'X-DashScope-Async': 'enable' }
}

function parseArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    return JSON.parse(value)
  } catch {
    return [value]
  }
}

/**
 * 异步轮询任务直到完成，然后获取转写结果
 */
async function pollAndFetchResult(ctx, args, taskId) {
  const baseUrl = getBaseUrl(args)
  const pollHeaders = getHeaders(args)
  const maxAttempts = 120

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000))
    const pollResult = await ctx.api.getJson(`${baseUrl}${TASK_QUERY_ENDPOINT}/${taskId}`, {
      headers: pollHeaders,
      timeout: 30000,
    })

    const status = pollResult.output?.task_status
    ctx.logger.info(`任务 ${taskId} 状态: ${status}`)

    if (status === 'SUCCEEDED') {
      return await fetchTranscriptionContent(ctx, pollResult)
    }
    if (status === 'FAILED') {
      throw new Error(`任务失败: ${pollResult.output?.code || ''} - ${pollResult.output?.message || '未知错误'}`)
    }
    if (status === 'UNKNOWN' || status === 'CANCELED') {
      throw new Error(`任务异常: ${status}`)
    }
  }
  throw new Error('轮询超时（已等待 10 分钟）')
}

/**
 * 从成功任务结果中获取转写内容
 * 对于 FunASR/Paraformer: results[].transcription_url 需再次请求获取 JSON
 * 对于 Qwen-Filetrans: result.transcription_url 需再次请求获取 JSON
 */
async function fetchTranscriptionContent(ctx, pollResult) {
  const output = pollResult.output || {}

  // Paraformer / FunASR: output.results[]
  // Qwen-Filetrans: output.result
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

    // 获取转写 JSON 内容
    const transcription = await ctx.api.getJson(transcriptionUrl, { timeout: 30000 })
    const transcriptTexts = extractTexts(transcription)
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
  ctx.logger.info(`识别完成，共提取 ${texts.length} 段文本`)

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

/**
 * 从转写 JSON 中提取所有文本
 */
function extractTexts(transcription) {
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

// ── Common property definitions ─────────────────────────────

function configProperties() {
  return [
    { key: 'apiKey', label: 'API Key', type: 'text', required: true, tooltip: '阿里云百炼 DashScope API Key', default: '{{ __config__["workfox.asr"]["apiKey"] }}' },
    { key: 'baseUrl', label: 'API 地址', type: 'text', default: '{{ __config__["workfox.asr"]["baseUrl"] }}', tooltip: 'DashScope API 基础地址' },
  ]
}

const commonOutputs = [
  { key: 'success', type: 'boolean' },
  { key: 'message', type: 'string' },
  { key: 'data', type: 'object', children: [
    { key: 'text', type: 'string' },
    { key: 'details', type: 'object', children: [] },
    { key: 'taskId', type: 'string' },
  ] },
]

// ── Node definitions ────────────────────────────────────────

module.exports = {
  nodes: [
    {
      type: 'asr_file_recognition',
      label: '录音文件转写',
      category: '语音识别',
      icon: 'FileAudio',
      description: '提交音频/视频文件URL进行异步语音识别，支持 FunASR/Paraformer/Qwen 等多种模型，自动轮询获取转写结果',
      properties: [
        ...configProperties(),
        { key: 'model', label: '识别模型', type: 'select', default: 'paraformer-v2', options: FILE_MODELS, tooltip: '不同模型支持的语种和采样率不同' },
        { key: 'fileUrls', label: '音频文件URL', type: 'textarea', required: true, tooltip: 'FunASR/Paraformer: URL数组，如 ["https://...mp3"]，最多100个' },
        { key: 'fileUrl', label: '音频文件URL(Qwen)', type: 'text', tooltip: '仅 Qwen-Filetrans: 单个音频文件URL' },
        { key: 'languageHints', label: '语言提示', type: 'text', tooltip: 'Paraformer-v2 语言代码数组，如 ["zh","en"]' },
        { key: 'language', label: '语言(Qwen)', type: 'select', default: '', options: LANGUAGES, tooltip: 'Qwen-Filetrans 指定语种' },
        { key: 'diarizationEnabled', label: '说话人分离', type: 'boolean', default: false, tooltip: '开启后识别结果中会区分不同说话人' },
        { key: 'speakerCount', label: '说话人数量', type: 'number', tooltip: '说话人数量参考值(2-100)，需先开启说话人分离' },
        { key: 'channelId', label: '音轨索引', type: 'text', tooltip: '指定音轨，如 [0] 或 [0,1]' },
        { key: 'enableItn', label: '逆文本标准化', type: 'boolean', default: false, tooltip: 'Qwen-Filetrans: 是否启用 ITN' },
      ],
      outputs: commonOutputs,
      handler: async (ctx, args) => {
        const baseUrl = getBaseUrl(args)
        const headers = getAsyncHeaders(args)
        const model = args.model || 'paraformer-v2'
        const isQwenFiletrans = model.startsWith('qwen')

        // 构建请求体
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

        ctx.logger.info(`提交语音识别任务: 模型=${model}`)
        if (!isQwenFiletrans) {
          ctx.logger.info(`文件数量: ${parseArray(args.fileUrls).length}`)
        }

        const createResult = await ctx.api.postJson(`${baseUrl}${TASK_SUBMIT_ENDPOINT}`, {
          headers,
          body,
          timeout: 600000,
        })

        if (createResult.code || createResult.message) {
          throw new Error(`创建任务失败: ${createResult.code} - ${createResult.message}`)
        }

        const taskId = createResult.output?.task_id
        if (!taskId) {
          throw new Error('创建任务成功但未获取到 task_id')
        }

        ctx.logger.info(`任务已提交: task_id=${taskId}，开始轮询...`)
        return pollAndFetchResult(ctx, args, taskId)
      },
    },
    {
      type: 'asr_qwen_flash',
      label: '千问实时语音识别',
      category: '语音识别',
      icon: 'Mic',
      description: '千问 Qwen-ASR 实时语音识别（同步模式），适用于短音频快速转写，支持语种检测和情感分析',
      properties: [
        ...configProperties(),
        { key: 'audio', label: '音频内容', type: 'textarea', required: true, tooltip: '公网可访问的音频URL，或 Base64 Data URI（data:audio/wav;base64,...）' },
        { key: 'language', label: '语言', type: 'select', default: '', options: LANGUAGES, tooltip: '指定语种可提升准确率，不指定则自动检测' },
        { key: 'enableItn', label: '逆文本标准化', type: 'boolean', default: false, tooltip: '仅支持中文和英文' },
      ],
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
      handler: async (ctx, args) => {
        const baseUrl = getBaseUrl(args)
        const headers = getHeaders(args)

        if (!args.audio) throw new Error('需要提供 audio（音频URL或Base64编码）')

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

        ctx.logger.info(`千问实时语音识别: 音频=${args.audio.substring(0, 100)}...`)

        const result = await ctx.api.postJson(`${baseUrl}${QWEN_SYNC_ENDPOINT}`, {
          headers,
          body,
          timeout: 120000,
        })

        if (result.error) {
          throw new Error(`识别失败: ${result.error.message || JSON.stringify(result.error)}`)
        }

        const text = result.choices?.[0]?.message?.content || ''
        const annotations = result.choices?.[0]?.message?.annotations || []
        const audioInfo = annotations.find(a => a.type === 'audio_info') || {}
        const usage = result.usage || {}

        ctx.logger.info(`识别完成: 语种=${audioInfo.language || '未知'}, 情感=${audioInfo.emotion || '未知'}, 时长=${usage.seconds || 0}s`)
        ctx.logger.info(`识别文本: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`)

        return {
          success: true,
          message: text ? `识别完成` : '识别完成但无内容',
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
  ],
}
