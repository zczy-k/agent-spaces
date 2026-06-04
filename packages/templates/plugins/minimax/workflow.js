const MINIMAX_BASE_URL = 'https://api.minimaxi.com'

function getBaseUrl(args) {
  return args.baseUrl || MINIMAX_BASE_URL
}

function getHeaders(args) {
  const apiKey = args.apiKey
  if (!apiKey) throw new Error('缺少 MiniMax API Key')
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  }
}

// --- 语音合成辅助 ---
const TTS_MODELS = [
  { label: 'speech-2.8-hd (推荐)', value: 'speech-2.8-hd' },
  { label: 'speech-2.8-turbo', value: 'speech-2.8-turbo' },
  { label: 'speech-2.6-hd', value: 'speech-2.6-hd' },
  { label: 'speech-2.6-turbo', value: 'speech-2.6-turbo' },
  { label: 'speech-02-hd', value: 'speech-02-hd' },
  { label: 'speech-02-turbo', value: 'speech-02-turbo' },
]

const AUDIO_FORMATS = [
  { label: 'mp3 (默认)', value: 'mp3' },
  { label: 'wav', value: 'wav' },
  { label: 'flac', value: 'flac' },
  { label: 'pcm', value: 'pcm' },
]

const EMOTIONS = [
  { label: '自动', value: '' },
  { label: '高兴', value: 'happy' },
  { label: '悲伤', value: 'sad' },
  { label: '愤怒', value: 'angry' },
  { label: '害怕', value: 'fearful' },
  { label: '厌恶', value: 'disgusted' },
  { label: '惊讶', value: 'surprised' },
  { label: '中性', value: 'calm' },
  { label: '生动', value: 'fluent' },
  { label: '低语', value: 'whisper' },
]

// --- 视频模型 ---
const T2V_MODELS = [
  { label: 'MiniMax-Hailuo-2.3 (推荐)', value: 'MiniMax-Hailuo-2.3' },
  { label: 'MiniMax-Hailuo-02', value: 'MiniMax-Hailuo-02' },
  { label: 'T2V-01-Director', value: 'T2V-01-Director' },
  { label: 'T2V-01', value: 'T2V-01' },
]

const I2V_MODELS = [
  { label: 'MiniMax-Hailuo-2.3 (推荐)', value: 'MiniMax-Hailuo-2.3' },
  { label: 'MiniMax-Hailuo-2.3-Fast', value: 'MiniMax-Hailuo-2.3-Fast' },
  { label: 'MiniMax-Hailuo-02', value: 'MiniMax-Hailuo-02' },
  { label: 'I2V-01-Director', value: 'I2V-01-Director' },
  { label: 'I2V-01-live', value: 'I2V-01-live' },
  { label: 'I2V-01', value: 'I2V-01' },
]

const VIDEO_RESOLUTIONS = [
  { label: '720P', value: '720P' },
  { label: '768P (默认)', value: '768P' },
  { label: '1080P', value: '1080P' },
]

const VIDEO_DURATIONS = [
  { label: '6秒 (默认)', value: 6 },
  { label: '10秒', value: 10 },
]

// --- Chat 模型 ---
const CHAT_MODELS = [
  { label: 'MiniMax-M2.7 (推荐)', value: 'MiniMax-M2.7' },
  { label: 'MiniMax-M2.7-highspeed (极速)', value: 'MiniMax-M2.7-highspeed' },
  { label: 'MiniMax-M2.5', value: 'MiniMax-M2.5' },
  { label: 'MiniMax-M2.5-highspeed (极速)', value: 'MiniMax-M2.5-highspeed' },
  { label: 'MiniMax-M2.1', value: 'MiniMax-M2.1' },
  { label: 'MiniMax-M2.1-highspeed (极速)', value: 'MiniMax-M2.1-highspeed' },
  { label: 'MiniMax-M2', value: 'MiniMax-M2' },
]

// --- 音乐模型 ---
const MUSIC_MODELS = [
  { label: 'music-2.6 (推荐)', value: 'music-2.6' },
  { label: 'music-cover (翻唱)', value: 'music-cover' },
  { label: 'music-2.6-free (免费)', value: 'music-2.6-free' },
  { label: 'music-cover-free (免费翻唱)', value: 'music-cover-free' },
]

const MUSIC_FORMATS = [
  { label: 'url (获取下载链接)', value: 'url' },
  { label: 'hex (默认)', value: 'hex' },
]

const HER_MESSAGE_NAMES = {
  system: 'AI',
  user_system: '用户',
  group: '场景',
  sample_message_user: '示例用户',
  sample_message_ai: '示例AI',
  user: '用户',
  assistant: 'AI',
}

const HER_MESSAGE_ROLES = new Set(Object.keys(HER_MESSAGE_NAMES))

function cleanHerMessages(raw, defaultRole = 'user') {
  const items = Array.isArray(raw)
    ? raw
    : (raw != null ? [{ role: defaultRole, content: raw }] : [])

  return items
    .filter(m => m != null)
    .map(m => {
      const role = HER_MESSAGE_ROLES.has(m.role) ? m.role : defaultRole
      const content = typeof m.content === 'string' ? m.content : String(m.content ?? '')
      const message = { role, content }
      if (m.name) message.name = String(m.name)
      else if (HER_MESSAGE_NAMES[role]) message.name = HER_MESSAGE_NAMES[role]
      return message
    })
    .filter(m => m.content.trim())
}

module.exports = {
  nodes: [
    // ============================
    // 文本合成（Chat Completion）
    // ============================
    {
      type: 'minimax_chat',
      label: '文本合成',
      category: 'MiniMax AI',
      icon: 'MessageSquare',
      description: 'MiniMax 文本合成：支持多轮对话、工具调用(Function Calling)、图片理解、思维链推理',
      properties: [
        { key: 'apiKey', label: 'API Key', type: 'text', required: true, default: '{{ __config__["workfox.minimax"]["apiKey"] }}' },
        { key: 'model', label: '模型', type: 'select', default: 'MiniMax-M2.7', options: CHAT_MODELS },
        { key: 'systemPrompt', label: '系统提示词', type: 'textarea', tooltip: '系统角色的行为指令，定义 AI 的角色和约束' },
        { key: 'messages', label: '消息列表', type: 'array', required: true, tooltip: '对话消息列表', fields: [
          { key: 'role', label: '角色', type: 'select', options: [
            { label: '用户', value: 'user' },
            { label: '助手', value: 'assistant' },
            { label: '系统', value: 'system' },
            { label: '开发者', value: 'developer' },
          ], default: 'user' },
          { key: 'content', label: '内容', type: 'text', placeholder: '消息内容' },
        ] },
        { key: 'temperature', label: '温度', type: 'number', default: 0.7, tooltip: '0-1，控制随机性，越高越随机，建议取值 0.7-1.0' },
        { key: 'topP', label: 'Top P', type: 'number', default: 0.95, tooltip: '0-1，核采样参数' },
        { key: 'maxCompletionTokens', label: '最大输出 Token', type: 'number', tooltip: '最大生成 token 数' },
        { key: 'baseUrl', label: 'API地址', type: 'text', default: '{{ __config__["workfox.minimax"]["baseUrl"] }}' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'content', type: 'string' },
          { key: 'reasoningContent', type: 'string' },
          { key: 'toolCalls', type: 'string' },
          { key: 'totalTokens', type: 'number' },
          { key: 'id', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const baseUrl = getBaseUrl(args)
        const headers = getHeaders(args)

        const rawMessages = Array.isArray(args.messages) && args.messages.length > 0
          ? args.messages
          : [{ role: 'user', content: args.messages }]
        // 清洗：去掉前端 id，补全 role 默认值
        const messages = rawMessages.map(m => ({
          role: m.role || 'user',
          content: m.content ?? '',
        }))

        // 如果有 systemPrompt，插入到 messages 最前面
        if (args.systemPrompt) {
          messages = [{ role: 'system', content: args.systemPrompt }, ...messages]
        }

        const body = {
          model: args.model || 'MiniMax-M2.7',
          messages,
          ...(args.temperature != null && { temperature: Number(args.temperature) }),
          ...(args.topP != null && { top_p: Number(args.topP) }),
          ...(args.maxCompletionTokens && { max_completion_tokens: Number(args.maxCompletionTokens) }),
        }

        ctx.logger.info(`文本合成: 模型=${body.model}, 消息数=${messages.length}`)
        const result = await ctx.api.postJson(`${baseUrl}/v1/text/chatcompletion_v2`, { headers, body, timeout: 120000 })

        const choice = result.choices?.[0]
        if (!choice) {
          const errMsg = result.error?.message || result.base_resp?.status_msg || JSON.stringify(result).slice(0, 200)
          throw new Error(`文本合成失败: ${errMsg}`)
        }

        const output = choice.message
        ctx.logger.info(`文本合成完成: tokens=${result.usage?.total_tokens}, id=${result.id}`)
        return {
          success: true,
          message: '文本合成完成',
          data: {
            content: output?.content || '',
            reasoningContent: output?.reasoning_content || '',
            toolCalls: output?.tool_calls ? JSON.stringify(output.tool_calls) : '',
            totalTokens: result.usage?.total_tokens,
            id: result.id,
          },
        }
      },
    },

    // ============================
    // 角色对话（M2-her）
    // ============================
    {
      type: 'minimax_chat_her',
      label: '角色对话',
      category: 'MiniMax AI',
      icon: 'User',
      description: 'MiniMax 角色对话（M2-her）：支持角色扮演、多轮对话，可定义角色人设和世界观',
      properties: [
        { key: 'apiKey', label: 'API Key', type: 'text', required: true, default: '{{ __config__["workfox.minimax"]["apiKey"] }}' },
        { key: 'systemPrompt', label: '角色人设', type: 'textarea', tooltip: '角色的系统设定，定义 AI 的性格、背景、说话风格' },
        { key: 'userSystem', label: '用户设定', type: 'textarea', tooltip: '用户角色的系统设定（user_system role）' },
        { key: 'group', label: '群组设定', type: 'textarea', tooltip: '世界观/场景设定（group role）' },
        { key: 'sampleMessages', label: '示例对话', type: 'array', tooltip: '用 sample_message_user / sample_message_ai 角色提供对话示例', fields: [
          { key: 'role', label: '角色', type: 'select', options: [
            { label: '示例用户', value: 'sample_message_user' },
            { label: '示例AI', value: 'sample_message_ai' },
          ], default: 'sample_message_user' },
          { key: 'content', label: '内容', type: 'text', placeholder: '示例消息内容' },
        ] },
        { key: 'messages', label: '消息列表', type: 'array', required: true, tooltip: '对话消息列表', fields: [
          { key: 'role', label: '角色', type: 'select', options: [
            { label: '用户', value: 'user' },
            { label: '助手', value: 'assistant' },
            { label: '系统', value: 'system' },
          ], default: 'user' },
          { key: 'content', label: '内容', type: 'text', placeholder: '消息内容' },
        ] },
        { key: 'temperature', label: '温度', type: 'number', default: 1.0, tooltip: '0-1，控制随机性，默认 1.0' },
        { key: 'topP', label: 'Top P', type: 'number', default: 0.95, tooltip: '0-1，核采样参数' },
        { key: 'maxCompletionTokens', label: '最大输出 Token', type: 'number', tooltip: '最大 2048' },
        { key: 'baseUrl', label: 'API地址', type: 'text', default: '{{ __config__["workfox.minimax"]["baseUrl"] }}' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'content', type: 'string' },
          { key: 'totalTokens', type: 'number' },
          { key: 'id', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const baseUrl = getBaseUrl(args)
        const headers = getHeaders(args)

        const messages = Array.isArray(args.messages) && args.messages.length > 0
          ? cleanHerMessages(args.messages)
          : cleanHerMessages(args.messages, 'user')

        // 按顺序构建消息列表：角色设定 -> 示例对话 -> 实际对话
        const builtMessages = []
        if (args.systemPrompt) builtMessages.push(...cleanHerMessages([{ role: 'system', content: args.systemPrompt }]))
        if (args.userSystem) builtMessages.push(...cleanHerMessages([{ role: 'user_system', content: args.userSystem }]))
        if (args.group) builtMessages.push(...cleanHerMessages([{ role: 'group', content: args.group }]))

        // 示例对话
        if (Array.isArray(args.sampleMessages) && args.sampleMessages.length > 0) {
          builtMessages.push(...cleanHerMessages(args.sampleMessages, 'sample_message_user'))
        }

        builtMessages.push(...messages)

        const body = {
          model: 'M2-her',
          messages: builtMessages,
          ...(args.temperature != null && { temperature: Number(args.temperature) }),
          ...(args.topP != null && { top_p: Number(args.topP) }),
          ...(args.maxCompletionTokens && { max_completion_tokens: Number(args.maxCompletionTokens) }),
        }

        ctx.logger.info(`角色对话: 消息数=${builtMessages.length}`)
        const result = await ctx.api.postJson(`${baseUrl}/v1/chat/completions`, { headers, body, timeout: 120000 })

        const choice = result.choices?.[0]
        if (!choice) {
          const errMsg = result.error?.message || result.base_resp?.status_msg || JSON.stringify(result).slice(0, 200)
          throw new Error(`角色对话失败: ${errMsg}`)
        }

        ctx.logger.info(`角色对话完成: tokens=${result.usage?.total_tokens}, id=${result.id}`)
        return {
          success: true,
          message: '角色对话完成',
          data: {
            content: choice.message?.content || '',
            totalTokens: result.usage?.total_tokens,
            id: result.id,
          },
        }
      },
    },

    // ============================
    // 语音合成（同步 TTS）
    // ============================
    {
      type: 'minimax_tts',
      label: '语音合成',
      category: 'MiniMax AI',
      icon: 'AudioLines',
      description: 'MiniMax 文字转语音（同步 TTS），支持多种音色、情绪、语速控制',
      properties: [
        { key: 'apiKey', label: 'API Key', type: 'text', required: true, tooltip: 'MiniMax API Key', default: '{{ __config__["workfox.minimax"]["apiKey"] }}' },
        { key: 'text', label: '文本内容', type: 'textarea', required: true, tooltip: '待合成语音的文本（<10000字符）' },
        { key: 'model', label: '模型', type: 'select', default: 'speech-2.8-hd', options: TTS_MODELS },
        { key: 'voiceId', label: '音色ID', type: 'text', default: 'Chinese (Mandarin)_Lyrical_Voice', tooltip: '系统音色ID，如 male-qn-qingse、English_Graceful_Lady' },
        { key: 'speed', label: '语速', type: 'number', default: 1, tooltip: '0.5-2.0，默认1.0' },
        { key: 'vol', label: '音量', type: 'number', default: 1, tooltip: '0-10，默认1.0' },
        { key: 'pitch', label: '语调', type: 'number', default: 0, tooltip: '-12到12，默认0' },
        { key: 'emotion', label: '情绪', type: 'select', default: '', options: EMOTIONS },
        { key: 'audioFormat', label: '音频格式', type: 'select', default: 'mp3', options: AUDIO_FORMATS },
        { key: 'sampleRate', label: '采样率', type: 'select', default: 32000, options: [
          { label: '8000', value: 8000 }, { label: '16000', value: 16000 },
          { label: '22050', value: 22050 }, { label: '24000', value: 24000 },
          { label: '32000 (默认)', value: 32000 }, { label: '44100', value: 44100 },
        ] },
        { key: 'outputFormat', label: '输出格式', type: 'select', default: 'url', options: [
          { label: 'URL (推荐)', value: 'url' },
          { label: 'HEX', value: 'hex' },
        ] },
        { key: 'baseUrl', label: 'API地址', type: 'text', default: '{{ __config__["workfox.minimax"]["baseUrl"] }}' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'audioUrl', type: 'string' },
          { key: 'audioHex', type: 'string' },
          { key: 'audioLength', type: 'number' },
          { key: 'audioFormat', type: 'string' },
          { key: 'traceId', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const baseUrl = getBaseUrl(args)
        const headers = getHeaders(args)

        const voiceSetting = {
          voice_id: args.voiceId || 'Chinese (Mandarin)_Lyrical_Voice',
          speed: args.speed ?? 1,
          vol: args.vol ?? 1,
          pitch: args.pitch ?? 0,
        }
        if (args.emotion) voiceSetting.emotion = args.emotion

        const body = {
          model: args.model || 'speech-2.8-hd',
          text: args.text,
          stream: false,
          voice_setting: voiceSetting,
          audio_setting: {
            sample_rate: args.sampleRate || 32000,
            bitrate: 128000,
            format: args.audioFormat || 'mp3',
            channel: 1,
          },
          output_format: args.outputFormat || 'url',
        }

        ctx.logger.info(`语音合成: 模型=${body.model}, 音色=${voiceSetting.voice_id}, 文本长度=${args.text.length}`)
        const result = await ctx.api.postJson(`${baseUrl}/v1/t2a_v2`, { headers, body, timeout: 120000 })

        if (result.base_resp?.status_code !== 0) {
          throw new Error(`语音合成失败: ${result.base_resp?.status_msg || '未知错误'} (code: ${result.base_resp?.status_code})`)
        }

        const audioUrl = args.outputFormat === 'url' ? result.data?.audio : undefined
        const audioHex = args.outputFormat !== 'url' ? result.data?.audio : undefined

        ctx.logger.info(`语音合成完成: 时长=${result.extra_info?.audio_length}ms, 格式=${result.extra_info?.audio_format}`)
        return {
          success: true,
          message: '语音合成完成',
          data: {
            audioUrl,
            audioHex,
            audioLength: result.extra_info?.audio_length,
            audioFormat: result.extra_info?.audio_format,
            traceId: result.trace_id,
          },
        }
      },
    },

    // ============================
    // 音乐生成
    // ============================
    {
      type: 'minimax_music_generation',
      label: '音乐生成',
      category: 'MiniMax AI',
      icon: 'Music',
      description: 'MiniMax 音乐生成：通过描述和歌词生成歌曲，支持翻唱模式',
      properties: [
        { key: 'apiKey', label: 'API Key', type: 'text', required: true, default: '{{ __config__["workfox.minimax"]["apiKey"] }}' },
        { key: 'prompt', label: '音乐描述', type: 'textarea', required: true, tooltip: '描述风格、情绪、场景，如"流行音乐, 难过, 适合在下雨的晚上"' },
        { key: 'lyrics', label: '歌词', type: 'textarea', tooltip: '用 \\n 分隔每行，支持结构标签如 [Verse] [Chorus] 等' },
        { key: 'model', label: '模型', type: 'select', default: 'music-2.6', options: MUSIC_MODELS },
        { key: 'isInstrumental', label: '纯音乐', type: 'select', default: 'false', options: [
          { label: '否', value: 'false' }, { label: '是', value: 'true' },
        ] },
        { key: 'lyricsOptimizer', label: '自动生成歌词', type: 'select', default: 'false', options: [
          { label: '否', value: 'false' }, { label: '是（根据描述自动生成）', value: 'true' },
        ] },
        { key: 'audioUrl', label: '参考音频URL', type: 'text', tooltip: '翻唱模式专用：参考音频URL（6秒-6分钟，最大50MB）' },
        { key: 'outputFormat', label: '输出格式', type: 'select', default: 'url', options: MUSIC_FORMATS },
        { key: 'audioFormat', label: '音频格式', type: 'select', default: 'mp3', options: [
          { label: 'mp3 (默认)', value: 'mp3' }, { label: 'wav', value: 'wav' }, { label: 'pcm', value: 'pcm' },
        ] },
        { key: 'baseUrl', label: 'API地址', type: 'text', default: '{{ __config__["workfox.minimax"]["baseUrl"] }}' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'audioHex', type: 'string' },
          { key: 'duration', type: 'number' },
          { key: 'sampleRate', type: 'number' },
          { key: 'traceId', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const baseUrl = getBaseUrl(args)
        const headers = getHeaders(args)

        const body = {
          model: args.model || 'music-2.6',
          prompt: args.prompt,
          stream: false,
          output_format: args.outputFormat || 'url',
          ...(args.lyrics && { lyrics: args.lyrics }),
          ...(args.isInstrumental === 'true' && { is_instrumental: true }),
          ...(args.lyricsOptimizer === 'true' && { lyrics_optimizer: true }),
          ...(args.audioUrl && { audio_url: args.audioUrl }),
          ...(args.audioFormat && {
            audio_setting: {
              sample_rate: 44100,
              bitrate: 256000,
              format: args.audioFormat,
            },
          }),
        }

        ctx.logger.info(`音乐生成: 模型=${body.model}, 描述=${args.prompt.substring(0, 50)}`)
        const result = await ctx.api.postJson(`${baseUrl}/v1/music_generation`, { headers, body, timeout: 600000 })

        if (result.base_resp?.status_code !== 0) {
          throw new Error(`音乐生成失败: ${result.base_resp?.status_msg || '未知错误'} (code: ${result.base_resp?.status_code})`)
        }

        ctx.logger.info(`音乐生成完成: 时长=${result.extra_info?.music_duration}ms`)
        return {
          success: true,
          message: '音乐生成完成',
          data: {
            audioHex: result.data?.audio,
            duration: result.extra_info?.music_duration,
            sampleRate: result.extra_info?.music_sample_rate,
            traceId: result.trace_id,
          },
        }
      },
    },

    // ============================
    // 歌词生成
    // ============================
    {
      type: 'minimax_lyrics_generation',
      label: '歌词生成',
      category: 'MiniMax AI',
      icon: 'FileText',
      description: 'MiniMax 歌词生成：支持完整歌曲创作和歌词编辑/续写',
      properties: [
        { key: 'apiKey', label: 'API Key', type: 'text', required: true, default: '{{ __config__["workfox.minimax"]["apiKey"] }}' },
        { key: 'prompt', label: '描述', type: 'textarea', required: true, tooltip: '歌曲主题/风格描述，如"一首关于夏日海边的轻快情歌"' },
        { key: 'mode', label: '模式', type: 'select', default: 'write_full_song', options: [
          { label: '写完整歌曲', value: 'write_full_song' },
          { label: '编辑/续写', value: 'edit' },
        ] },
        { key: 'lyrics', label: '现有歌词', type: 'textarea', tooltip: '编辑模式下传入现有歌词用于续写/修改' },
        { key: 'title', label: '歌曲标题', type: 'text', tooltip: '指定标题后输出保持该标题不变' },
        { key: 'baseUrl', label: 'API地址', type: 'text', default: '{{ __config__["workfox.minimax"]["baseUrl"] }}' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'songTitle', type: 'string' },
          { key: 'styleTags', type: 'string' },
          { key: 'lyrics', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const baseUrl = getBaseUrl(args)
        const headers = getHeaders(args)

        const body = {
          mode: args.mode || 'write_full_song',
          prompt: args.prompt,
          ...(args.lyrics && { lyrics: args.lyrics }),
          ...(args.title && { title: args.title }),
        }

        ctx.logger.info(`歌词生成: 模式=${body.mode}, 描述=${args.prompt.substring(0, 50)}`)
        const result = await ctx.api.postJson(`${baseUrl}/v1/lyrics_generation`, { headers, body, timeout: 120000 })

        if (result.base_resp?.status_code !== 0) {
          throw new Error(`歌词生成失败: ${result.base_resp?.status_msg || '未知错误'} (code: ${result.base_resp?.status_code})`)
        }

        ctx.logger.info(`歌词生成完成: 标题=${result.song_title}, 风格=${result.style_tags}`)
        return {
          success: true,
          message: '歌词生成完成',
          data: {
            songTitle: result.song_title,
            styleTags: result.style_tags,
            lyrics: result.lyrics,
          },
        }
      },
    },

    // ============================
    // 文生视频
    // ============================
    {
      type: 'minimax_text_to_video',
      label: '文生视频',
      category: 'MiniMax AI',
      icon: 'Video',
      description: 'MiniMax 文生视频：通过文字描述生成视频，支持运镜控制指令',
      properties: [
        { key: 'apiKey', label: 'API Key', type: 'text', required: true, default: '{{ __config__["workfox.minimax"]["apiKey"] }}' },
        { key: 'prompt', label: '视频描述', type: 'textarea', required: true, tooltip: '视频文字描述（最大2000字符），支持 [左移] [推进] [固定] 等运镜指令' },
        { key: 'model', label: '模型', type: 'select', default: 'MiniMax-Hailuo-2.3', options: T2V_MODELS },
        { key: 'duration', label: '时长(秒)', type: 'select', default: 6, options: VIDEO_DURATIONS },
        { key: 'resolution', label: '分辨率', type: 'select', default: '768P', options: VIDEO_RESOLUTIONS },
        { key: 'promptOptimizer', label: '自动优化提示词', type: 'select', default: 'true', options: [
          { label: '是 (默认)', value: 'true' }, { label: '否', value: 'false' },
        ] },
        { key: 'baseUrl', label: 'API地址', type: 'text', default: '{{ __config__["workfox.minimax"]["baseUrl"] }}' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'taskId', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const baseUrl = getBaseUrl(args)
        const headers = getHeaders(args)

        const body = {
          model: args.model || 'MiniMax-Hailuo-2.3',
          prompt: args.prompt,
          duration: args.duration || 6,
          resolution: args.resolution || '768P',
          prompt_optimizer: args.promptOptimizer !== 'false',
        }

        ctx.logger.info(`文生视频: 模型=${body.model}, 时长=${body.duration}s, 分辨率=${body.resolution}`)
        const result = await ctx.api.postJson(`${baseUrl}/v1/video_generation`, { headers, body, timeout: 30000 })

        if (result.base_resp?.status_code !== 0) {
          throw new Error(`文生视频失败: ${result.base_resp?.status_msg || '未知错误'} (code: ${result.base_resp?.status_code})`)
        }

        ctx.logger.info(`文生视频任务已创建: taskId=${result.task_id}`)
        return {
          success: true,
          message: `视频生成任务已创建，taskId: ${result.task_id}`,
          data: { taskId: result.task_id },
        }
      },
    },

    // ============================
    // 图生视频
    // ============================
    {
      type: 'minimax_image_to_video',
      label: '图生视频',
      category: 'MiniMax AI',
      icon: 'Clapperboard',
      description: 'MiniMax 图生视频：基于图片和文字描述生成视频',
      properties: [
        { key: 'apiKey', label: 'API Key', type: 'text', required: true, default: '{{ __config__["workfox.minimax"]["apiKey"] }}' },
        { key: 'firstFrameImage', label: '首帧图片', type: 'textarea', required: true, tooltip: '首帧图片 URL 或 Base64 Data URL（JPG/PNG/WebP，<20MB）' },
        { key: 'prompt', label: '视频描述', type: 'textarea', tooltip: '视频文字描述（最大2000字符），支持运镜指令' },
        { key: 'model', label: '模型', type: 'select', default: 'MiniMax-Hailuo-2.3', options: I2V_MODELS },
        { key: 'duration', label: '时长(秒)', type: 'select', default: 6, options: VIDEO_DURATIONS },
        { key: 'resolution', label: '分辨率', type: 'select', default: '768P', options: VIDEO_RESOLUTIONS },
        { key: 'promptOptimizer', label: '自动优化提示词', type: 'select', default: 'true', options: [
          { label: '是 (默认)', value: 'true' }, { label: '否', value: 'false' },
        ] },
        { key: 'baseUrl', label: 'API地址', type: 'text', default: '{{ __config__["workfox.minimax"]["baseUrl"] }}' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'taskId', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const baseUrl = getBaseUrl(args)
        const headers = getHeaders(args)

        const body = {
          model: args.model || 'MiniMax-Hailuo-2.3',
          first_frame_image: args.firstFrameImage,
          prompt: args.prompt || '',
          duration: args.duration || 6,
          resolution: args.resolution || '768P',
          prompt_optimizer: args.promptOptimizer !== 'false',
        }

        ctx.logger.info(`图生视频: 模型=${body.model}, 时长=${body.duration}s`)
        const result = await ctx.api.postJson(`${baseUrl}/v1/video_generation`, { headers, body, timeout: 30000 })

        if (result.base_resp?.status_code !== 0) {
          throw new Error(`图生视频失败: ${result.base_resp?.status_msg || '未知错误'} (code: ${result.base_resp?.status_code})`)
        }

        ctx.logger.info(`图生视频任务已创建: taskId=${result.task_id}`)
        return {
          success: true,
          message: `图生视频任务已创建，taskId: ${result.task_id}`,
          data: { taskId: result.task_id },
        }
      },
    },

    // ============================
    // 首尾帧生成视频
    // ============================
    {
      type: 'minimax_start_end_to_video',
      label: '首尾帧视频',
      category: 'MiniMax AI',
      icon: 'Film',
      description: 'MiniMax 首尾帧生成视频：基于起始帧和结束帧图片生成过渡视频',
      properties: [
        { key: 'apiKey', label: 'API Key', type: 'text', required: true, default: '{{ __config__["workfox.minimax"]["apiKey"] }}' },
        { key: 'firstFrameImage', label: '首帧图片', type: 'textarea', required: true, tooltip: '起始帧图片 URL 或 Base64 Data URL' },
        { key: 'lastFrameImage', label: '尾帧图片', type: 'textarea', required: true, tooltip: '结束帧图片 URL 或 Base64 Data URL' },
        { key: 'prompt', label: '视频描述', type: 'textarea', tooltip: '视频文字描述，支持运镜指令' },
        { key: 'duration', label: '时长(秒)', type: 'select', default: 6, options: VIDEO_DURATIONS },
        { key: 'resolution', label: '分辨率', type: 'select', default: '768P', options: [
          { label: '768P (默认)', value: '768P' }, { label: '1080P', value: '1080P' },
        ] },
        { key: 'baseUrl', label: 'API地址', type: 'text', default: '{{ __config__["workfox.minimax"]["baseUrl"] }}' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'taskId', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const baseUrl = getBaseUrl(args)
        const headers = getHeaders(args)

        const body = {
          model: 'MiniMax-Hailuo-02',
          first_frame_image: args.firstFrameImage,
          last_frame_image: args.lastFrameImage,
          prompt: args.prompt || '',
          duration: args.duration || 6,
          resolution: args.resolution || '768P',
        }

        ctx.logger.info(`首尾帧视频: 时长=${body.duration}s, 分辨率=${body.resolution}`)
        const result = await ctx.api.postJson(`${baseUrl}/v1/video_generation`, { headers, body, timeout: 30000 })

        if (result.base_resp?.status_code !== 0) {
          throw new Error(`首尾帧视频失败: ${result.base_resp?.status_msg || '未知错误'} (code: ${result.base_resp?.status_code})`)
        }

        ctx.logger.info(`首尾帧视频任务已创建: taskId=${result.task_id}`)
        return {
          success: true,
          message: `首尾帧视频任务已创建，taskId: ${result.task_id}`,
          data: { taskId: result.task_id },
        }
      },
    },

    // ============================
    // 主体参考视频
    // ============================
    {
      type: 'minimax_subject_to_video',
      label: '主体参考视频',
      category: 'MiniMax AI',
      icon: 'UserRound',
      description: 'MiniMax 主体参考视频：基于人物主体图片生成视频（保持人物一致性）',
      properties: [
        { key: 'apiKey', label: 'API Key', type: 'text', required: true, default: '{{ __config__["workfox.minimax"]["apiKey"] }}' },
        { key: 'subjectImage', label: '人物图片', type: 'textarea', required: true, tooltip: '人物面部参考图片 URL（JPG/PNG/WebP，<20MB）' },
        { key: 'prompt', label: '视频描述', type: 'textarea', tooltip: '视频文字描述' },
        { key: 'baseUrl', label: 'API地址', type: 'text', default: '{{ __config__["workfox.minimax"]["baseUrl"] }}' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'taskId', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const baseUrl = getBaseUrl(args)
        const headers = getHeaders(args)

        const body = {
          model: 'S2V-01',
          prompt: args.prompt || '',
          subject_reference: [
            {
              type: 'character',
              image: [args.subjectImage],
            },
          ],
        }

        ctx.logger.info(`主体参考视频: 人物图片=${args.subjectImage.substring(0, 80)}`)
        const result = await ctx.api.postJson(`${baseUrl}/v1/video_generation`, { headers, body, timeout: 30000 })

        if (result.base_resp?.status_code !== 0) {
          throw new Error(`主体参考视频失败: ${result.base_resp?.status_msg || '未知错误'} (code: ${result.base_resp?.status_code})`)
        }

        ctx.logger.info(`主体参考视频任务已创建: taskId=${result.task_id}`)
        return {
          success: true,
          message: `主体参考视频任务已创建，taskId: ${result.task_id}`,
          data: { taskId: result.task_id },
        }
      },
    },

    // ============================
    // 查询视频任务状态
    // ============================
    {
      type: 'minimax_video_query',
      label: '视频任务查询',
      category: 'MiniMax AI',
      icon: 'Search',
      description: '查询 MiniMax 视频生成任务状态（Preparing/Queueing/Processing/Success/Fail）',
      properties: [
        { key: 'apiKey', label: 'API Key', type: 'text', required: true, default: '{{ __config__["workfox.minimax"]["apiKey"] }}' },
        { key: 'taskId', label: '任务ID', type: 'text', required: true, tooltip: '视频生成任务返回的 taskId' },
        { key: 'baseUrl', label: 'API地址', type: 'text', default: '{{ __config__["workfox.minimax"]["baseUrl"] }}' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'status', type: 'string' },
          { key: 'taskId', type: 'string' },
          { key: 'fileId', type: 'string' },
          { key: 'videoWidth', type: 'number' },
          { key: 'videoHeight', type: 'number' },
        ] },
      ],
      handler: async (ctx, args) => {
        const baseUrl = getBaseUrl(args)
        const headers = getHeaders(args)

        ctx.logger.info(`查询视频任务: taskId=${args.taskId}`)
        const result = await ctx.api.fetchJson(`${baseUrl}/v1/query/video_generation?task_id=${encodeURIComponent(args.taskId)}`, { headers, timeout: 30000 })

        if (result.base_resp?.status_code !== 0) {
          throw new Error(`查询失败: ${result.base_resp?.status_msg || '未知错误'} (code: ${result.base_resp?.status_code})`)
        }

        const status = result.status
        ctx.logger.info(`视频任务状态: ${status}, fileId=${result.file_id || '无'}`)
        return {
          success: true,
          message: `任务状态: ${status}`,
          data: {
            status,
            taskId: result.task_id,
            fileId: result.file_id,
            videoWidth: result.video_width,
            videoHeight: result.video_height,
          },
        }
      },
    },

    // ============================
    // 视频下载
    // ============================
    {
      type: 'minimax_video_download',
      label: '视频下载',
      category: 'MiniMax AI',
      icon: 'Download',
      description: '通过 fileId 获取 MiniMax 视频下载链接（有效期1小时）',
      properties: [
        { key: 'apiKey', label: 'API Key', type: 'text', required: true, default: '{{ __config__["workfox.minimax"]["apiKey"] }}' },
        { key: 'fileId', label: '文件ID', type: 'text', required: true, tooltip: '视频任务查询返回的 fileId' },
        { key: 'baseUrl', label: 'API地址', type: 'text', default: '{{ __config__["workfox.minimax"]["baseUrl"] }}' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'downloadUrl', type: 'string' },
          { key: 'fileName', type: 'string' },
          { key: 'fileSize', type: 'number' },
        ] },
      ],
      handler: async (ctx, args) => {
        const baseUrl = getBaseUrl(args)
        const headers = getHeaders(args)

        ctx.logger.info(`获取视频下载链接: fileId=${args.fileId}`)
        const result = await ctx.api.fetchJson(`${baseUrl}/v1/files/retrieve?file_id=${encodeURIComponent(args.fileId)}`, { headers, timeout: 30000 })

        if (result.base_resp?.status_code !== 0) {
          throw new Error(`获取下载链接失败: ${result.base_resp?.status_msg || '未知错误'} (code: ${result.base_resp?.status_code})`)
        }

        const file = result.file
        ctx.logger.info(`获取下载链接成功: ${file.filename}, 大小=${file.bytes}B`)
        return {
          success: true,
          message: `下载链接获取成功（有效期1小时）`,
          data: {
            downloadUrl: file.download_url,
            fileName: file.filename,
            fileSize: file.bytes,
          },
        }
      },
    },
  ],
}
