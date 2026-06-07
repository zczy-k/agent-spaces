const { createClient } = require('./client')

function pick(obj, keys) {
  const result = {}
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '' && obj[k] !== 'auto') result[k] = obj[k]
  }
  return result
}

const CONFIG_APIKEY = '{{ __config__["workflow.openai"]["apiKey"] }}'
const CONFIG_BASEURL = '{{ __config__["workflow.openai"]["baseUrl"] }}'

module.exports = [
  {
    name: 'openai_create_image',
    label: 'OpenAI 文生图',
    category: 'OpenAI',
    icon: 'Image',
    description: '通过文字描述使用 OpenAI 生成图片',
    toolProperties: [
      { key: 'apiKey', type: 'string', description: 'OpenAI API Key', required: true },
      { key: 'prompt', type: 'string', description: '图片描述文字', required: true },
      { key: 'model', type: 'string', description: '模型，默认 gpt-image-1' },
      { key: 'size', type: 'string', description: '图片尺寸' },
      { key: 'quality', type: 'string', description: '质量' },
      { key: 'n', type: 'number', description: '生成数量，1-10' },
      { key: 'output_format', type: 'string', description: '输出格式：png/jpeg/webp' },
      { key: 'background', type: 'string', description: '背景：transparent/opaque/auto' },
      { key: 'baseUrl', type: 'string', description: 'API 基础地址' },
    ],
    properties: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true, tooltip: 'OpenAI API Key', default: CONFIG_APIKEY },
      { key: 'prompt', label: '图片描述', type: 'textarea', required: true, tooltip: '描述你想生成的图片内容' },
      { key: 'model', label: '模型', type: 'select', default: 'gpt-image-1', options: [
        { label: 'gpt-image-2', value: 'gpt-image-2' },
        { label: 'gpt-image-1 (默认)', value: 'gpt-image-1' },
        { label: 'gpt-image-1.5', value: 'gpt-image-1.5' },
        { label: 'gpt-image-1-mini', value: 'gpt-image-1-mini' },
        { label: 'dall-e-3', value: 'dall-e-3' },
        { label: 'dall-e-2', value: 'dall-e-2' },
      ] },
      { key: 'size', label: '尺寸', type: 'select', default: 'auto', options: [
        { label: '自动', value: 'auto' },
        { label: '1024x1024', value: '1024x1024' },
        { label: '1536x1024 (横版)', value: '1536x1024' },
        { label: '1024x1536 (竖版)', value: '1024x1536' },
        { label: '256x256 (dall-e-2)', value: '256x256' },
        { label: '512x512 (dall-e-2)', value: '512x512' },
        { label: '1792x1024 (dall-e-3)', value: '1792x1024' },
        { label: '1024x1792 (dall-e-3)', value: '1024x1792' },
      ] },
      { key: 'quality', label: '质量', type: 'select', default: 'auto', options: [
        { label: '自动', value: 'auto' },
        { label: '高', value: 'high' },
        { label: '中', value: 'medium' },
        { label: '低', value: 'low' },
        { label: 'HD (dall-e-3)', value: 'hd' },
        { label: 'Standard (dall-e-3)', value: 'standard' },
      ] },
      { key: 'n', label: '数量', type: 'number', default: 1, tooltip: '1-10，dall-e-3 仅支持 1' },
      { key: 'output_format', label: '输出格式', type: 'select', default: 'png', options: [
        { label: 'PNG (默认)', value: 'png' },
        { label: 'JPEG', value: 'jpeg' },
        { label: 'WebP', value: 'webp' },
      ] },
      { key: 'background', label: '背景', type: 'select', default: 'auto', options: [
        { label: '自动', value: 'auto' },
        { label: '透明', value: 'transparent' },
        { label: '不透明', value: 'opaque' },
      ] },
      { key: 'baseUrl', label: 'API 地址', type: 'text', default: CONFIG_BASEURL, tooltip: 'OpenAI API 基础地址' },
    ],
    outputs: [
      { key: 'success', type: 'boolean' },
      { key: 'message', type: 'string' },
      { key: 'data', type: 'object', children: [
        { key: 'images', type: 'object', children: [] },
        { key: 'created', type: 'number' },
        { key: 'usage', type: 'object', children: [] },
      ] },
    ],
    run: async (ctx, args) => {
      const client = createClient(args)
      ctx.logger.info(`文生图 - 模型: ${args.model || 'gpt-image-1'}, 提示词: ${args.prompt}`)
      const result = await client.images.generate({
        model: args.model || 'gpt-image-1',
        prompt: args.prompt,
        ...pick(args, ['size', 'quality', 'n', 'output_format', 'background']),
      })
      const images = (result.data || []).map(d => d.b64_json || d.url).filter(Boolean)
      ctx.logger.info(`生成完成，共 ${images.length} 张图片`)
      return { success: true, message: `生成 ${images.length} 张图片`, data: { images, created: result.created, usage: result.usage } }
    },
  },
  {
    name: 'openai_edit_image',
    label: 'OpenAI 图片编辑',
    category: 'OpenAI',
    icon: 'Wand2',
    description: '基于输入图片和描述进行 AI 图片编辑',
    toolProperties: [
      { key: 'apiKey', type: 'string', description: 'OpenAI API Key', required: true },
      { key: 'prompt', type: 'string', description: '编辑描述', required: true },
      { key: 'images', type: 'array', items: { type: 'object', properties: { image_url: { type: 'string' } } }, description: '输入图片数组', required: true },
      { key: 'model', type: 'string', description: '模型，默认 gpt-image-1' },
      { key: 'size', type: 'string', description: '图片尺寸' },
      { key: 'quality', type: 'string', description: '质量' },
      { key: 'n', type: 'number', description: '生成数量' },
      { key: 'background', type: 'string', description: '背景' },
      { key: 'baseUrl', type: 'string', description: 'API 基础地址' },
    ],
    properties: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true, tooltip: 'OpenAI API Key', default: CONFIG_APIKEY },
      { key: 'prompt', label: '编辑描述', type: 'textarea', required: true, tooltip: '描述你想要的编辑效果' },
      { key: 'images', label: '图片 URL', type: 'textarea', required: true, tooltip: '输入图片 URL 数组，如 [{"image_url":"https://..."}]' },
      { key: 'model', label: '模型', type: 'select', default: 'gpt-image-1', options: [
        { label: 'gpt-image-1 (默认)', value: 'gpt-image-1' },
        { label: 'gpt-image-1.5', value: 'gpt-image-1.5' },
        { label: 'gpt-image-1-mini', value: 'gpt-image-1-mini' },
        { label: 'chatgpt-image-latest', value: 'chatgpt-image-latest' },
      ] },
      { key: 'size', label: '尺寸', type: 'select', default: 'auto', options: [
        { label: '自动', value: 'auto' },
        { label: '1024x1024', value: '1024x1024' },
        { label: '1536x1024', value: '1536x1024' },
        { label: '1024x1536', value: '1024x1536' },
      ] },
      { key: 'quality', label: '质量', type: 'select', default: 'auto', options: [
        { label: '自动', value: 'auto' },
        { label: '高', value: 'high' },
        { label: '中', value: 'medium' },
        { label: '低', value: 'low' },
      ] },
      { key: 'n', label: '数量', type: 'number', default: 1 },
      { key: 'background', label: '背景', type: 'select', default: 'auto', options: [
        { label: '自动', value: 'auto' },
        { label: '透明', value: 'transparent' },
        { label: '不透明', value: 'opaque' },
      ] },
      { key: 'baseUrl', label: 'API 地址', type: 'text', default: CONFIG_BASEURL, tooltip: 'OpenAI API 基础地址' },
    ],
    outputs: [
      { key: 'success', type: 'boolean' },
      { key: 'message', type: 'string' },
      { key: 'data', type: 'object', children: [
        { key: 'images', type: 'object', children: [] },
        { key: 'created', type: 'number' },
        { key: 'usage', type: 'object', children: [] },
      ] },
    ],
    run: async (ctx, args) => {
      const client = createClient(args)
      const images = Array.isArray(args.images) ? args.images : JSON.parse(args.images)
      ctx.logger.info(`图片编辑 - 模型: ${args.model || 'gpt-image-1'}, 输入图片: ${images.length} 张`)
      const result = await client.images.edit({
        model: args.model || 'gpt-image-1',
        prompt: args.prompt,
        images,
        ...pick(args, ['size', 'quality', 'n', 'background']),
      })
      const outputImages = (result.data || []).map(d => d.b64_json || d.url).filter(Boolean)
      ctx.logger.info(`编辑完成，共 ${outputImages.length} 张图片`)
      return { success: true, message: `图片编辑完成，生成 ${outputImages.length} 张图片`, data: { images: outputImages, created: result.created, usage: result.usage } }
    },
  },
  {
    name: 'openai_chat',
    label: 'OpenAI Chat',
    category: 'OpenAI',
    icon: 'MessageSquare',
    description: '使用 GPT 模型进行对话，支持多轮对话和 JSON 输出',
    toolProperties: [
      { key: 'apiKey', type: 'string', description: 'OpenAI API Key', required: true },
      { key: 'messages', type: 'array', items: { type: 'object', properties: { role: { type: 'string', description: 'system/user/assistant/developer' }, content: { type: 'string' } } }, description: '消息列表', required: true },
      { key: 'model', type: 'string', description: '模型，默认 gpt-4o' },
      { key: 'temperature', type: 'number', description: '温度 0-2，默认 1' },
      { key: 'max_tokens', type: 'number', description: '最大输出 token 数' },
      { key: 'response_format', type: 'object', description: '输出格式，如 {"type":"json_object"}' },
      { key: 'baseUrl', type: 'string', description: 'API 基础地址' },
    ],
    properties: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true, tooltip: 'OpenAI API Key', default: CONFIG_APIKEY },
      { key: 'messages', label: '消息列表', type: 'array', required: true, tooltip: '对话消息列表', fields: [
        { key: 'role', label: '角色', type: 'select', options: [
          { label: '用户', value: 'user' },
          { label: '助手', value: 'assistant' },
          { label: '系统', value: 'system' },
          { label: '开发者', value: 'developer' },
        ], default: 'user' },
        { key: 'content', label: '内容', type: 'text', placeholder: '消息内容' },
      ] },
      { key: 'system', label: '系统提示', type: 'textarea', rows: 3, tooltip: '系统提示词（会作为第一条 system 消息插入）' },
      { key: 'model', label: '模型', type: 'select', default: 'gpt-4o', options: [
        { label: 'gpt-4o (默认)', value: 'gpt-4o' },
        { label: 'gpt-4o-mini', value: 'gpt-4o-mini' },
        { label: 'gpt-4.1', value: 'gpt-4.1' },
        { label: 'gpt-4.1-mini', value: 'gpt-4.1-mini' },
        { label: 'gpt-4.1-nano', value: 'gpt-4.1-nano' },
        { label: 'o3', value: 'o3' },
        { label: 'o4-mini', value: 'o4-mini' },
        { label: 'gpt-5', value: 'gpt-5' },
        { label: 'gpt-5-mini', value: 'gpt-5-mini' },
        { label: 'gpt-5.1', value: 'gpt-5.1' },
        { label: 'gpt-5.1-thinking', value: 'gpt-5.1-thinking' },
        { label: 'gpt-5.2', value: 'gpt-5.2' },
        { label: 'gpt-5.2-pro', value: 'gpt-5.2-pro' },
        { label: 'gpt-5.4', value: 'gpt-5.4' },
        { label: 'gpt-5.4-mini', value: 'gpt-5.4-mini' },
        { label: 'gpt-5.4-nano', value: 'gpt-5.4-nano' },
        { label: 'gpt-5.4-pro', value: 'gpt-5.4-pro' },
        { label: 'gpt-5.5', value: 'gpt-5.5' },
      ] },
      { key: 'temperature', label: '温度', type: 'range', default: 1, min: 0, max: 2, step: 0.1, tooltip: '0-2，越高越随机' },
      { key: 'max_tokens', label: '最大 Token', type: 'number', tooltip: '最大输出 token 数' },
      { key: 'response_format', label: '输出格式', type: 'select', default: 'text', options: [
        { label: '文本', value: 'text' },
        { label: 'JSON', value: 'json_object' },
      ] },
      { key: 'baseUrl', label: 'API 地址', type: 'text', default: CONFIG_BASEURL, tooltip: 'OpenAI API 基础地址' },
    ],
    outputs: [
      { key: 'success', type: 'boolean' },
      { key: 'message', type: 'string' },
      { key: 'thinking', type: 'string' },
      { key: 'data', type: 'object', children: [
        { key: 'content', type: 'string' },
        { key: 'thinking', type: 'string' },
        { key: 'role', type: 'string' },
        { key: 'finish_reason', type: 'string' },
        { key: 'model', type: 'string' },
        { key: 'usage', type: 'object', children: [] },
      ] },
    ],
    run: async (ctx, args) => {
      try {
        const client = createClient(args)
        let messages = args.messages
        if (typeof messages === 'string') {
          try { messages = JSON.parse(messages) } catch { messages = [{ role: 'user', content: messages }] }
        }
        if (!Array.isArray(messages)) messages = [messages]
        messages = messages.map(m => ({
          role: m.role || 'user',
          content: m.content,
        }))
        if (args.system) {
          messages = [{ role: 'system', content: args.system }, ...messages]
        }
        const params = {
          model: args.model || 'gpt-4o',
          messages,
          ...pick(args, ['temperature', 'max_tokens']),
        }
        if (args.response_format === 'json_object') {
          params.response_format = { type: 'json_object' }
        }
        ctx.logger.info(`Chat - 模型: ${params.model}, 消息数: ${messages.length}`)
        const result = await client.chat.completions.create(params)
        const choice = result.choices?.[0]
        let thinking = choice?.message?.reasoning_content || ''
        let content = choice?.message?.content || ''
        if (!thinking) {
          const match = content.match(/^<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>\s*/i)
          if (match) {
            thinking = match[0].replace(/^<think(?:ing)?>\s*/i, '').replace(/<\/think(?:ing)?>\s*$/i, '').trim()
            content = content.slice(match[0].length).trim()
          }
        }
        ctx.logger.info(`Chat 完成, finish_reason: ${choice?.finish_reason}`)
        return {
          success: true,
          message: content,
          thinking,
          data: {
            content,
            thinking,
            role: choice?.message?.role,
            finish_reason: choice?.finish_reason,
            usage: result.usage,
            model: result.model,
          },
        }
      } catch (err) {
        ctx.logger.error(`Chat 失败: ${err.message}`)
        return { success: false, message: `Chat 失败: ${err.message}`, data: {} }
      }
    },
  },
  {
    name: 'openai_embeddings',
    label: 'OpenAI Embeddings',
    category: 'OpenAI',
    icon: 'Binary',
    description: '生成文本向量嵌入，用于语义搜索、聚类、分类',
    toolProperties: [
      { key: 'apiKey', type: 'string', description: 'OpenAI API Key', required: true },
      { key: 'input', description: '文本或文本数组', oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], required: true },
      { key: 'model', type: 'string', description: '模型，默认 text-embedding-3-small' },
      { key: 'dimensions', type: 'number', description: '输出维度' },
      { key: 'baseUrl', type: 'string', description: 'API 基础地址' },
    ],
    properties: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true, tooltip: 'OpenAI API Key', default: CONFIG_APIKEY },
      { key: 'input', label: '输入文本', type: 'textarea', required: true, tooltip: '文本或 JSON 文本数组' },
      { key: 'model', label: '模型', type: 'select', default: 'text-embedding-3-small', options: [
        { label: 'text-embedding-3-small (默认)', value: 'text-embedding-3-small' },
        { label: 'text-embedding-3-large', value: 'text-embedding-3-large' },
        { label: 'text-embedding-ada-002', value: 'text-embedding-ada-002' },
      ] },
      { key: 'dimensions', label: '维度', type: 'number', tooltip: '输出向量维度' },
      { key: 'baseUrl', label: 'API 地址', type: 'text', default: CONFIG_BASEURL, tooltip: 'OpenAI API 基础地址' },
    ],
    outputs: [
      { key: 'success', type: 'boolean' },
      { key: 'message', type: 'string' },
      { key: 'data', type: 'object', children: [
        { key: 'embeddings', type: 'object', children: [] },
        { key: 'model', type: 'string' },
        { key: 'usage', type: 'object', children: [] },
      ] },
    ],
    run: async (ctx, args) => {
      const client = createClient(args)
      let input = args.input
      try { input = JSON.parse(input) } catch {}
      ctx.logger.info(`Embeddings - 模型: ${args.model || 'text-embedding-3-small'}`)
      const result = await client.embeddings.create({
        model: args.model || 'text-embedding-3-small',
        input,
        ...pick(args, ['dimensions']),
      })
      return {
        success: true,
        message: `生成 ${result.data.length} 条嵌入向量`,
        data: {
          embeddings: result.data.map(d => ({ index: d.index, embedding: d.embedding })),
          model: result.model,
          usage: result.usage,
        },
      }
    },
  },
  {
    name: 'openai_tts',
    label: 'OpenAI 语音合成',
    category: 'OpenAI',
    icon: 'Volume2',
    description: '将文本转为自然语音音频',
    toolProperties: [
      { key: 'apiKey', type: 'string', description: 'OpenAI API Key', required: true },
      { key: 'input', type: 'string', description: '要转换的文本', required: true },
      { key: 'model', type: 'string', description: '模型，默认 tts-1' },
      { key: 'voice', type: 'string', description: '声音：alloy/ash/coral/echo/fable/onyx/nova/sage/shimmer' },
      { key: 'speed', type: 'number', description: '语速 0.25-4.0，默认 1.0' },
      { key: 'response_format', type: 'string', description: '输出格式：mp3/opus/aac/flac/wav/pcm' },
      { key: 'baseUrl', type: 'string', description: 'API 基础地址' },
    ],
    properties: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true, tooltip: 'OpenAI API Key', default: CONFIG_APIKEY },
      { key: 'input', label: '文本', type: 'textarea', required: true, tooltip: '要转换的文本' },
      { key: 'model', label: '模型', type: 'select', default: 'tts-1', options: [
        { label: 'tts-1 (默认)', value: 'tts-1' },
        { label: 'tts-1-hd', value: 'tts-1-hd' },
        { label: 'gpt-4o-mini-tts', value: 'gpt-4o-mini-tts' },
      ] },
      { key: 'voice', label: '声音', type: 'select', default: 'alloy', options: [
        { label: 'Alloy', value: 'alloy' },
        { label: 'Ash', value: 'ash' },
        { label: 'Coral', value: 'coral' },
        { label: 'Echo', value: 'echo' },
        { label: 'Fable', value: 'fable' },
        { label: 'Onyx', value: 'onyx' },
        { label: 'Nova', value: 'nova' },
        { label: 'Sage', value: 'sage' },
        { label: 'Shimmer', value: 'shimmer' },
      ] },
      { key: 'speed', label: '语速', type: 'number', default: 1, tooltip: '0.25-4.0' },
      { key: 'response_format', label: '输出格式', type: 'select', default: 'mp3', options: [
        { label: 'MP3', value: 'mp3' },
        { label: 'WAV', value: 'wav' },
        { label: 'Opus', value: 'opus' },
        { label: 'AAC', value: 'aac' },
        { label: 'FLAC', value: 'flac' },
      ] },
      { key: 'baseUrl', label: 'API 地址', type: 'text', default: CONFIG_BASEURL, tooltip: 'OpenAI API 基础地址' },
    ],
    outputs: [
      { key: 'success', type: 'boolean' },
      { key: 'message', type: 'string' },
      { key: 'data', type: 'object', children: [
        { key: 'audio_base64', type: 'string' },
        { key: 'mime_type', type: 'string' },
        { key: 'format', type: 'string' },
        { key: 'size', type: 'number' },
      ] },
    ],
    run: async (ctx, args) => {
      const client = createClient(args)
      const Buffer = require('buffer').Buffer
      ctx.logger.info(`TTS - 模型: ${args.model || 'tts-1'}, 声音: ${args.voice || 'alloy'}`)
      const result = await client.audio.speech.create({
        model: args.model || 'tts-1',
        input: args.input,
        voice: args.voice || 'alloy',
        ...pick(args, ['speed', 'response_format']),
      })
      const buffer = Buffer.from(await result.arrayBuffer())
      const base64 = buffer.toString('base64')
      const fmt = args.response_format || 'mp3'
      const mimeType = { mp3: 'audio/mpeg', wav: 'audio/wav', opus: 'audio/opus', aac: 'audio/aac', flac: 'audio/flac' }[fmt] || 'audio/mpeg'
      ctx.logger.info(`TTS 完成，${buffer.length} 字节`)
      return {
        success: true,
        message: `语音生成完成，${buffer.length} 字节`,
        data: { audio_base64: base64, mime_type: mimeType, format: fmt, size: buffer.length },
      }
    },
  },
  {
    name: 'openai_stt',
    label: 'OpenAI 语音识别',
    category: 'OpenAI',
    icon: 'Mic',
    description: '将音频文件转录为文本（Whisper）',
    toolProperties: [
      { key: 'apiKey', type: 'string', description: 'OpenAI API Key', required: true },
      { key: 'file_url', type: 'string', description: '音频文件 URL', required: true },
      { key: 'model', type: 'string', description: '模型，默认 whisper-1' },
      { key: 'language', type: 'string', description: '语言代码，如 zh/en/ja' },
      { key: 'response_format', type: 'string', description: '输出格式：json/text/srt/verbose_json/vtt' },
      { key: 'baseUrl', type: 'string', description: 'API 基础地址' },
    ],
    properties: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true, tooltip: 'OpenAI API Key', default: CONFIG_APIKEY },
      { key: 'file_url', label: '音频 URL', type: 'text', required: true, tooltip: '音频文件 URL' },
      { key: 'model', label: '模型', type: 'select', default: 'whisper-1', options: [
        { label: 'whisper-1 (默认)', value: 'whisper-1' },
      ] },
      { key: 'language', label: '语言', type: 'select', default: '', options: [
        { label: '自动检测', value: '' },
        { label: '中文', value: 'zh' },
        { label: '英文', value: 'en' },
        { label: '日文', value: 'ja' },
        { label: '韩文', value: 'ko' },
      ] },
      { key: 'response_format', label: '输出格式', type: 'select', default: 'json', options: [
        { label: 'JSON', value: 'json' },
        { label: '纯文本', value: 'text' },
        { label: 'SRT', value: 'srt' },
        { label: 'VTT', value: 'vtt' },
        { label: '详细 JSON', value: 'verbose_json' },
      ] },
      { key: 'baseUrl', label: 'API 地址', type: 'text', default: CONFIG_BASEURL, tooltip: 'OpenAI API 基础地址' },
    ],
    outputs: [
      { key: 'success', type: 'boolean' },
      { key: 'message', type: 'string' },
      { key: 'data', type: 'object', children: [
        { key: 'text', type: 'string' },
      ] },
    ],
    run: async (ctx, args) => {
      const client = createClient(args)
      const Buffer = require('buffer').Buffer
      ctx.logger.info(`STT - 文件: ${args.file_url}`)
      const resp = await globalThis.fetch(args.file_url)
      if (!resp.ok) throw new Error(`下载音频失败: ${resp.status}`)
      const audioBuffer = Buffer.from(await resp.arrayBuffer())
      const audioBlob = new Blob([audioBuffer])
      const result = await client.audio.transcriptions.create({
        model: args.model || 'whisper-1',
        file: audioBlob,
        ...pick(args, ['language', 'response_format']),
      })
      const text = typeof result === 'string' ? result : result.text
      ctx.logger.info(`STT 完成`)
      return {
        success: true,
        message: text,
        data: typeof result === 'object' ? result : { text: result },
      }
    },
  },
  {
    name: 'openai_models',
    label: 'OpenAI 模型列表',
    category: 'OpenAI',
    icon: 'List',
    description: '列出可用的模型',
    tool: false,
    toolProperties: [
      { key: 'apiKey', type: 'string', description: 'OpenAI API Key', required: true },
      { key: 'baseUrl', type: 'string', description: 'API 基础地址' },
    ],
    properties: [
      { key: 'apiKey', label: 'API Key', type: 'text', required: true, tooltip: 'OpenAI API Key', default: CONFIG_APIKEY },
      { key: 'baseUrl', label: 'API 地址', type: 'text', default: CONFIG_BASEURL, tooltip: 'OpenAI API 基础地址' },
    ],
    outputs: [
      { key: 'success', type: 'boolean' },
      { key: 'message', type: 'string' },
      { key: 'data', type: 'object', children: [
        { key: 'models', type: 'object', children: [] },
      ] },
    ],
    run: async (ctx, args) => {
      const client = createClient(args)
      const result = await client.models.list()
      const models = []
      for await (const model of result) {
        models.push({ id: model.id, owned_by: model.owned_by, created: model.created })
      }
      ctx.logger.info(`模型列表: 共 ${models.length} 个模型`)
      return { success: true, message: `共 ${models.length} 个模型`, data: { models } }
    },
  },
]
