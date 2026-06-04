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
  tools: [
    {
      name: 'minimax_chat',
      description: 'MiniMax 文本合成：调用 MiniMax-M2.x 大语言模型进行文本生成。支持多轮对话、系统提示词、图片理解、思维链推理。模型包括 MiniMax-M2.7/M2.5/M2.1/M2 及其高速版。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'MiniMax API Key' },
          model: { type: 'string', description: '模型: MiniMax-M2.7(默认)/MiniMax-M2.7-highspeed/MiniMax-M2.5/MiniMax-M2.5-highspeed/MiniMax-M2.1/MiniMax-M2.1-highspeed/MiniMax-M2' },
          systemPrompt: { type: 'string', description: '系统提示词，定义 AI 的角色和行为约束' },
          messages: { type: 'string', description: 'JSON 数组格式的消息列表，如 [{"role":"user","content":"你好"}]。role: system/user/assistant/tool；content 支持文本和图片(image_url)' },
          temperature: { type: 'number', description: '温度 0-1，控制随机性，默认 0.7' },
          topP: { type: 'number', description: 'Top P 0-1，核采样参数，默认 0.95' },
          maxCompletionTokens: { type: 'number', description: '最大输出 token 数' },
          baseUrl: { type: 'string', description: 'API地址，默认 https://api.minimaxi.com' },
        },
        required: ['apiKey', 'messages'],
      },
    },
    {
      name: 'minimax_chat_her',
      description: 'MiniMax 角色对话（M2-her 模型）：支持角色扮演和沉浸式对话。可定义角色人设、用户设定、世界观和示例对话。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'MiniMax API Key' },
          systemPrompt: { type: 'string', description: '角色人设：定义 AI 的性格、背景、说话风格' },
          userSystem: { type: 'string', description: '用户角色设定（user_system role）' },
          group: { type: 'string', description: '世界观/场景设定（group role）' },
          sampleMessages: { type: 'string', description: 'JSON 数组格式的示例对话，使用 sample_message_user / sample_message_ai 角色' },
          messages: { type: 'string', description: 'JSON 数组格式的 user/assistant 消息列表' },
          temperature: { type: 'number', description: '温度 0-1，默认 1.0' },
          topP: { type: 'number', description: 'Top P 0-1，默认 0.95' },
          maxCompletionTokens: { type: 'number', description: '最大输出 token（上限 2048）' },
          baseUrl: { type: 'string', description: 'API地址，默认 https://api.minimaxi.com' },
        },
        required: ['apiKey', 'messages'],
      },
    },
    {
      name: 'minimax_tts',
      description: 'MiniMax 语音合成(TTS)：将文字转为语音。支持多种模型(speech-2.8-hd等)、音色、情绪(happy/sad/calm等)、语速(0.5-2.0)。输出音频URL（有效期24小时）或hex编码。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'MiniMax API Key' },
          text: { type: 'string', description: '待合成语音的文本（<10000字符）' },
          model: { type: 'string', description: 'TTS模型，默认 speech-2.8-hd，可选 speech-2.8-turbo/speech-2.6-hd/speech-2.6-turbo/speech-02-hd/speech-02-turbo' },
          voiceId: { type: 'string', description: '音色ID，默认 Chinese (Mandarin)_Lyrical_Voice' },
          speed: { type: 'number', description: '语速 0.5-2.0，默认 1.0' },
          vol: { type: 'number', description: '音量 0-10，默认 1.0' },
          pitch: { type: 'number', description: '语调 -12到12，默认 0' },
          emotion: { type: 'string', description: '情绪: happy/sad/angry/fearful/disgusted/surprised/calm/fluent/whisper' },
          audioFormat: { type: 'string', description: '音频格式: mp3(默认)/wav/flac/pcm' },
          outputFormat: { type: 'string', description: '输出格式: url(默认)/hex' },
          baseUrl: { type: 'string', description: 'API地址，默认 https://api.minimaxi.com' },
        },
        required: ['apiKey', 'text'],
      },
    },
    {
      name: 'minimax_music_generation',
      description: 'MiniMax 音乐生成：通过描述和歌词生成歌曲。支持文生音乐(music-2.6)和翻唱(music-cover)，支持纯音乐模式。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'MiniMax API Key' },
          prompt: { type: 'string', description: '音乐风格描述，如"流行音乐, 难过, 适合在下雨的晚上"' },
          lyrics: { type: 'string', description: '歌词，用 \\n 分隔，支持 [Verse] [Chorus] 等结构标签' },
          model: { type: 'string', description: '模型: music-2.6(默认)/music-cover/music-2.6-free/music-cover-free' },
          isInstrumental: { type: 'boolean', description: '是否纯音乐（无人声），默认 false' },
          lyricsOptimizer: { type: 'boolean', description: '是否根据描述自动生成歌词，默认 false' },
          audioUrl: { type: 'string', description: '翻唱模式专用：参考音频URL' },
          outputFormat: { type: 'string', description: '输出格式: url(默认)/hex' },
          baseUrl: { type: 'string', description: 'API地址，默认 https://api.minimaxi.com' },
        },
        required: ['apiKey', 'prompt'],
      },
    },
    {
      name: 'minimax_lyrics_generation',
      description: 'MiniMax 歌词生成：根据描述生成完整歌曲歌词或编辑/续写现有歌词。输出可直接用于音乐生成接口。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'MiniMax API Key' },
          prompt: { type: 'string', description: '歌曲主题/风格描述' },
          mode: { type: 'string', description: '模式: write_full_song(默认)/edit' },
          lyrics: { type: 'string', description: '编辑模式下的现有歌词' },
          title: { type: 'string', description: '指定歌曲标题' },
          baseUrl: { type: 'string', description: 'API地址，默认 https://api.minimaxi.com' },
        },
        required: ['apiKey', 'prompt'],
      },
    },
    {
      name: 'minimax_text_to_video',
      description: 'MiniMax 文生视频：通过文字描述生成视频。支持运镜控制指令（如[推进][左摇][固定]），模型 MiniMax-Hailuo-2.3 等。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'MiniMax API Key' },
          prompt: { type: 'string', description: '视频描述（最大2000字符），支持 [左移][推进][固定] 等运镜指令' },
          model: { type: 'string', description: '模型: MiniMax-Hailuo-2.3(默认)/MiniMax-Hailuo-02/T2V-01-Director/T2V-01' },
          duration: { type: 'number', description: '时长(秒): 6(默认) 或 10' },
          resolution: { type: 'string', description: '分辨率: 720P/768P(默认)/1080P' },
          promptOptimizer: { type: 'boolean', description: '是否自动优化提示词，默认 true' },
          baseUrl: { type: 'string', description: 'API地址，默认 https://api.minimaxi.com' },
        },
        required: ['apiKey', 'prompt'],
      },
    },
    {
      name: 'minimax_image_to_video',
      description: 'MiniMax 图生视频：基于图片和文字描述生成视频。模型 MiniMax-Hailuo-2.3/I2V-01 等。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'MiniMax API Key' },
          firstFrameImage: { type: 'string', description: '首帧图片 URL 或 Base64 Data URL' },
          prompt: { type: 'string', description: '视频描述，支持运镜指令' },
          model: { type: 'string', description: '模型: MiniMax-Hailuo-2.3(默认)/I2V-01-Director/I2V-01-live/I2V-01 等' },
          duration: { type: 'number', description: '时长(秒): 6(默认) 或 10' },
          resolution: { type: 'string', description: '分辨率: 720P/768P(默认)/1080P' },
          baseUrl: { type: 'string', description: 'API地址，默认 https://api.minimaxi.com' },
        },
        required: ['apiKey', 'firstFrameImage'],
      },
    },
    {
      name: 'minimax_start_end_to_video',
      description: 'MiniMax 首尾帧生成视频：基于起始帧和结束帧图片生成过渡视频。模型 MiniMax-Hailuo-02。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'MiniMax API Key' },
          firstFrameImage: { type: 'string', description: '起始帧图片 URL 或 Base64 Data URL' },
          lastFrameImage: { type: 'string', description: '结束帧图片 URL 或 Base64 Data URL' },
          prompt: { type: 'string', description: '视频描述，支持运镜指令' },
          duration: { type: 'number', description: '时长(秒): 6(默认) 或 10' },
          resolution: { type: 'string', description: '分辨率: 768P(默认)/1080P' },
          baseUrl: { type: 'string', description: 'API地址，默认 https://api.minimaxi.com' },
        },
        required: ['apiKey', 'firstFrameImage', 'lastFrameImage'],
      },
    },
    {
      name: 'minimax_subject_to_video',
      description: 'MiniMax 主体参考视频：基于人物主体图片生成视频，保持人物面部一致性。模型 S2V-01。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'MiniMax API Key' },
          subjectImage: { type: 'string', description: '人物面部参考图片 URL' },
          prompt: { type: 'string', description: '视频描述' },
          baseUrl: { type: 'string', description: 'API地址，默认 https://api.minimaxi.com' },
        },
        required: ['apiKey', 'subjectImage'],
      },
    },
    {
      name: 'minimax_video_query',
      description: '查询 MiniMax 视频生成任务状态。状态: Preparing/Queueing/Processing/Success/Fail。成功后返回 fileId 用于下载。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'MiniMax API Key' },
          taskId: { type: 'string', description: '视频生成任务ID' },
          baseUrl: { type: 'string', description: 'API地址，默认 https://api.minimaxi.com' },
        },
        required: ['apiKey', 'taskId'],
      },
    },
    {
      name: 'minimax_video_download',
      description: '通过 fileId 获取 MiniMax 视频下载链接。下载链接有效期1小时。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'MiniMax API Key' },
          fileId: { type: 'string', description: '视频文件ID（从查询接口获取）' },
          baseUrl: { type: 'string', description: 'API地址，默认 https://api.minimaxi.com' },
        },
        required: ['apiKey', 'fileId'],
      },
    },
  ],

  handler: async (name, args, api) => {
    const baseUrl = getBaseUrl(args)
    const headers = getHeaders(args)

    switch (name) {
      case 'minimax_chat': {
        let messages
        try {
          messages = typeof args.messages === 'string' ? JSON.parse(args.messages) : args.messages
        } catch {
          messages = [{ role: 'user', content: args.messages }]
        }

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

        const result = await api.postJson(`${baseUrl}/v1/text/chatcompletion_v2`, { headers, body, timeout: 120000 })
        const choice = result.choices?.[0]
        if (!choice) {
          return { success: false, message: `文本合成失败: 无有效响应` }
        }
        return {
          success: true,
          message: '文本合成完成',
          data: {
            content: choice.message?.content || '',
            reasoningContent: choice.message?.reasoning_content || '',
            toolCalls: choice.message?.tool_calls || null,
            totalTokens: result.usage?.total_tokens,
            id: result.id,
          },
        }
      }

      case 'minimax_chat_her': {
        let messages = []
        try {
          messages = typeof args.messages === 'string' ? JSON.parse(args.messages) : (args.messages || [])
        } catch {
          messages = [{ role: 'user', content: args.messages }]
        }
        messages = cleanHerMessages(messages)

        const builtMessages = []
        if (args.systemPrompt) builtMessages.push(...cleanHerMessages([{ role: 'system', content: args.systemPrompt }]))
        if (args.userSystem) builtMessages.push(...cleanHerMessages([{ role: 'user_system', content: args.userSystem }]))
        if (args.group) builtMessages.push(...cleanHerMessages([{ role: 'group', content: args.group }]))

        if (args.sampleMessages) {
          try {
            const samples = typeof args.sampleMessages === 'string'
              ? JSON.parse(args.sampleMessages)
              : args.sampleMessages
            builtMessages.push(...cleanHerMessages(samples, 'sample_message_user'))
          } catch { /* skip invalid samples */ }
        }

        builtMessages.push(...messages)

        const body = {
          model: 'M2-her',
          messages: builtMessages,
          ...(args.temperature != null && { temperature: Number(args.temperature) }),
          ...(args.topP != null && { top_p: Number(args.topP) }),
          ...(args.maxCompletionTokens && { max_completion_tokens: Number(args.maxCompletionTokens) }),
        }

        const result = await api.postJson(`${baseUrl}/v1/chat/completions`, { headers, body, timeout: 120000 })
        const choice = result.choices?.[0]
        if (!choice) {
          return { success: false, message: `角色对话失败: 无有效响应` }
        }
        return {
          success: true,
          message: '角色对话完成',
          data: {
            content: choice.message?.content || '',
            totalTokens: result.usage?.total_tokens,
            id: result.id,
          },
        }
      }

      case 'minimax_tts': {
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
            sample_rate: 32000,
            bitrate: 128000,
            format: args.audioFormat || 'mp3',
            channel: 1,
          },
          output_format: args.outputFormat || 'url',
        }

        const result = await api.postJson(`${baseUrl}/v1/t2a_v2`, { headers, body, timeout: 120000 })
        if (result.base_resp?.status_code !== 0) {
          return { success: false, message: `语音合成失败: ${result.base_resp?.status_msg}` }
        }
        return {
          success: true,
          message: '语音合成完成',
          data: {
            audioUrl: args.outputFormat === 'url' ? result.data?.audio : undefined,
            audioHex: args.outputFormat !== 'url' ? result.data?.audio : undefined,
            audioLength: result.extra_info?.audio_length,
            audioFormat: result.extra_info?.audio_format,
          },
        }
      }

      case 'minimax_music_generation': {
        const body = {
          model: args.model || 'music-2.6',
          prompt: args.prompt,
          stream: false,
          output_format: args.outputFormat || 'url',
          ...(args.lyrics && { lyrics: args.lyrics }),
          ...(args.isInstrumental && { is_instrumental: true }),
          ...(args.lyricsOptimizer && { lyrics_optimizer: true }),
          ...(args.audioUrl && { audio_url: args.audioUrl }),
        }
        const result = await api.postJson(`${baseUrl}/v1/music_generation`, { headers, body, timeout: 600000 })
        if (result.base_resp?.status_code !== 0) {
          return { success: false, message: `音乐生成失败: ${result.base_resp?.status_msg}` }
        }
        return {
          success: true,
          message: '音乐生成完成',
          data: {
            audioHex: result.data?.audio,
            duration: result.extra_info?.music_duration,
            sampleRate: result.extra_info?.music_sample_rate,
          },
        }
      }

      case 'minimax_lyrics_generation': {
        const body = {
          mode: args.mode || 'write_full_song',
          prompt: args.prompt,
          ...(args.lyrics && { lyrics: args.lyrics }),
          ...(args.title && { title: args.title }),
        }
        const result = await api.postJson(`${baseUrl}/v1/lyrics_generation`, { headers, body, timeout: 120000 })
        if (result.base_resp?.status_code !== 0) {
          return { success: false, message: `歌词生成失败: ${result.base_resp?.status_msg}` }
        }
        return {
          success: true,
          message: '歌词生成完成',
          data: {
            songTitle: result.song_title,
            styleTags: result.style_tags,
            lyrics: result.lyrics,
          },
        }
      }

      case 'minimax_text_to_video': {
        const body = {
          model: args.model || 'MiniMax-Hailuo-2.3',
          prompt: args.prompt,
          duration: args.duration || 6,
          resolution: args.resolution || '768P',
          prompt_optimizer: args.promptOptimizer !== false,
        }
        const result = await api.postJson(`${baseUrl}/v1/video_generation`, { headers, body, timeout: 30000 })
        if (result.base_resp?.status_code !== 0) {
          return { success: false, message: `文生视频失败: ${result.base_resp?.status_msg}` }
        }
        return {
          success: true,
          message: `视频生成任务已创建，taskId: ${result.task_id}`,
          data: { taskId: result.task_id },
        }
      }

      case 'minimax_image_to_video': {
        const body = {
          model: args.model || 'MiniMax-Hailuo-2.3',
          first_frame_image: args.firstFrameImage,
          prompt: args.prompt || '',
          duration: args.duration || 6,
          resolution: args.resolution || '768P',
        }
        const result = await api.postJson(`${baseUrl}/v1/video_generation`, { headers, body, timeout: 30000 })
        if (result.base_resp?.status_code !== 0) {
          return { success: false, message: `图生视频失败: ${result.base_resp?.status_msg}` }
        }
        return {
          success: true,
          message: `图生视频任务已创建，taskId: ${result.task_id}`,
          data: { taskId: result.task_id },
        }
      }

      case 'minimax_start_end_to_video': {
        const body = {
          model: 'MiniMax-Hailuo-02',
          first_frame_image: args.firstFrameImage,
          last_frame_image: args.lastFrameImage,
          prompt: args.prompt || '',
          duration: args.duration || 6,
          resolution: args.resolution || '768P',
        }
        const result = await api.postJson(`${baseUrl}/v1/video_generation`, { headers, body, timeout: 30000 })
        if (result.base_resp?.status_code !== 0) {
          return { success: false, message: `首尾帧视频失败: ${result.base_resp?.status_msg}` }
        }
        return {
          success: true,
          message: `首尾帧视频任务已创建，taskId: ${result.task_id}`,
          data: { taskId: result.task_id },
        }
      }

      case 'minimax_subject_to_video': {
        const body = {
          model: 'S2V-01',
          prompt: args.prompt || '',
          subject_reference: [{ type: 'character', image: [args.subjectImage] }],
        }
        const result = await api.postJson(`${baseUrl}/v1/video_generation`, { headers, body, timeout: 30000 })
        if (result.base_resp?.status_code !== 0) {
          return { success: false, message: `主体参考视频失败: ${result.base_resp?.status_msg}` }
        }
        return {
          success: true,
          message: `主体参考视频任务已创建，taskId: ${result.task_id}`,
          data: { taskId: result.task_id },
        }
      }

      case 'minimax_video_query': {
        const result = await api.fetchJson(`${baseUrl}/v1/query/video_generation?task_id=${encodeURIComponent(args.taskId)}`, { headers, timeout: 30000 })
        if (result.base_resp?.status_code !== 0) {
          return { success: false, message: `查询失败: ${result.base_resp?.status_msg}` }
        }
        return {
          success: true,
          message: `任务状态: ${result.status}`,
          data: {
            status: result.status,
            taskId: result.task_id,
            fileId: result.file_id,
            videoWidth: result.video_width,
            videoHeight: result.video_height,
          },
        }
      }

      case 'minimax_video_download': {
        const result = await api.fetchJson(`${baseUrl}/v1/files/retrieve?file_id=${encodeURIComponent(args.fileId)}`, { headers, timeout: 30000 })
        if (result.base_resp?.status_code !== 0) {
          return { success: false, message: `获取下载链接失败: ${result.base_resp?.status_msg}` }
        }
        return {
          success: true,
          message: '下载链接获取成功（有效期1小时）',
          data: {
            downloadUrl: result.file?.download_url,
            fileName: result.file?.filename,
            fileSize: result.file?.bytes,
          },
        }
      }

      default:
        return { success: false, message: `未知工具: ${name}` }
    }
  },
}
