const { createClient } = require('./client')

function pick(obj, keys) {
  const result = {}
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '' && obj[k] !== 'auto') result[k] = obj[k]
  }
  return result
}

module.exports = {
  tools: [
    {
      name: 'openai_create_image',
      description: 'OpenAI 文生图：通过文字描述生成图片。支持 gpt-image-1/dall-e-3/dall-e-2。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'OpenAI API Key' },
          prompt: { type: 'string', description: '图片描述文字' },
          model: { type: 'string', description: '模型，默认 gpt-image-1' },
          size: { type: 'string', description: '图片尺寸' },
          quality: { type: 'string', description: '质量' },
          n: { type: 'number', description: '生成数量，1-10' },
          output_format: { type: 'string', description: '输出格式：png/jpeg/webp' },
          background: { type: 'string', description: '背景：transparent/opaque/auto' },
          baseUrl: { type: 'string', description: 'API 基础地址' },
        },
        required: ['apiKey', 'prompt'],
      },
    },
    {
      name: 'openai_edit_image',
      description: 'OpenAI 图片编辑：基于输入图片和文字描述编辑图片，支持多图输入。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'OpenAI API Key' },
          prompt: { type: 'string', description: '编辑描述' },
          images: { type: 'array', items: { type: 'object', properties: { image_url: { type: 'string' } } }, description: '输入图片数组' },
          model: { type: 'string', description: '模型，默认 gpt-image-1' },
          size: { type: 'string', description: '图片尺寸' },
          quality: { type: 'string', description: '质量' },
          n: { type: 'number', description: '生成数量' },
          background: { type: 'string', description: '背景' },
          baseUrl: { type: 'string', description: 'API 基础地址' },
        },
        required: ['apiKey', 'prompt', 'images'],
      },
    },
    {
      name: 'openai_chat',
      description: 'OpenAI Chat Completions：与 GPT 模型对话，支持多轮对话、系统提示、工具调用、JSON 输出。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'OpenAI API Key' },
          messages: { type: 'array', items: { type: 'object', properties: { role: { type: 'string', description: 'system/user/assistant/developer' }, content: { type: 'string' } } }, description: '消息列表' },
          model: { type: 'string', description: '模型，默认 gpt-4o' },
          temperature: { type: 'number', description: '温度 0-2，默认 1' },
          max_tokens: { type: 'number', description: '最大输出 token 数' },
          response_format: { type: 'object', description: '输出格式，如 {"type":"json_object"}' },
          baseUrl: { type: 'string', description: 'API 基础地址' },
        },
        required: ['apiKey', 'messages'],
      },
    },
    {
      name: 'openai_embeddings',
      description: 'OpenAI Embeddings：生成文本向量嵌入，用于语义搜索、聚类、分类。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'OpenAI API Key' },
          input: { description: '文本或文本数组', oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
          model: { type: 'string', description: '模型，默认 text-embedding-3-small' },
          dimensions: { type: 'number', description: '输出维度' },
          baseUrl: { type: 'string', description: 'API 基础地址' },
        },
        required: ['apiKey', 'input'],
      },
    },
    {
      name: 'openai_tts',
      description: 'OpenAI TTS 文字转语音：将文本转为自然语音音频。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'OpenAI API Key' },
          input: { type: 'string', description: '要转换的文本' },
          model: { type: 'string', description: '模型，默认 tts-1' },
          voice: { type: 'string', description: '声音：alloy/ash/coral/echo/fable/onyx/nova/sage/shimmer' },
          speed: { type: 'number', description: '语速 0.25-4.0，默认 1.0' },
          response_format: { type: 'string', description: '输出格式：mp3/opus/aac/flac/wav/pcm' },
          baseUrl: { type: 'string', description: 'API 基础地址' },
        },
        required: ['apiKey', 'input'],
      },
    },
    {
      name: 'openai_stt',
      description: 'OpenAI STT 语音转文字：将音频文件转录为文本（Whisper）。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'OpenAI API Key' },
          file_url: { type: 'string', description: '音频文件 URL' },
          model: { type: 'string', description: '模型，默认 whisper-1' },
          language: { type: 'string', description: '语言代码，如 zh/en/ja' },
          response_format: { type: 'string', description: '输出格式：json/text/srt/verbose_json/vtt' },
          baseUrl: { type: 'string', description: 'API 基础地址' },
        },
        required: ['apiKey', 'file_url'],
      },
    },
    {
      name: 'openai_models',
      description: 'OpenAI 模型列表：列出可用的模型。',
      input_schema: {
        type: 'object',
        properties: {
          apiKey: { type: 'string', description: 'OpenAI API Key' },
          baseUrl: { type: 'string', description: 'API 基础地址' },
        },
        required: ['apiKey'],
      },
    },
  ],

  handler: async (name, args, api) => {
    const client = createClient(args)

    switch (name) {
      case 'openai_create_image': {
        const result = await client.images.generate({
          model: args.model || 'gpt-image-1',
          prompt: args.prompt,
          ...pick(args, ['size', 'quality', 'n', 'output_format', 'background']),
        })
        const images = (result.data || []).map(d => d.b64_json || d.url).filter(Boolean)
        return { success: true, message: `生成 ${images.length} 张图片`, data: { images, created: result.created, usage: result.usage } }
      }

      case 'openai_edit_image': {
        const images = Array.isArray(args.images) ? args.images : JSON.parse(args.images)
        const result = await client.images.edit({
          model: args.model || 'gpt-image-1',
          prompt: args.prompt,
          images,
          ...pick(args, ['size', 'quality', 'n', 'background']),
        })
        const outputImages = (result.data || []).map(d => d.b64_json || d.url).filter(Boolean)
        return { success: true, message: `图片编辑完成，生成 ${outputImages.length} 张图片`, data: { images: outputImages, created: result.created, usage: result.usage } }
      }

      case 'openai_chat': {
        const messages = Array.isArray(args.messages) ? args.messages : JSON.parse(args.messages)
        const params = {
          model: args.model || 'gpt-4o',
          messages,
          ...pick(args, ['temperature', 'max_tokens', 'response_format']),
        }
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
      }

      case 'openai_embeddings': {
        const input = Array.isArray(args.input) ? args.input : args.input
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
      }

      case 'openai_tts': {
        const Buffer = require('buffer').Buffer
        const result = await client.audio.speech.create({
          model: args.model || 'tts-1',
          input: args.input,
          voice: args.voice || 'alloy',
          ...pick(args, ['speed', 'response_format']),
        })
        const buffer = Buffer.from(await result.arrayBuffer())
        const base64 = buffer.toString('base64')
        const fmt = args.response_format || 'mp3'
        const mimeType = { mp3: 'audio/mpeg', wav: 'audio/wav', opus: 'audio/opus', aac: 'audio/aac', flac: 'audio/flac', pcm: 'audio/pcm' }[fmt] || 'audio/mpeg'
        return {
          success: true,
          message: `语音生成完成，${buffer.length} 字节`,
          data: { audio_base64: base64, mime_type: mimeType, format: fmt, size: buffer.length },
        }
      }

      case 'openai_stt': {
        const fetch = require('node:fetch' in globalThis ? 'node:fetch' : 'globalThis')
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
        return {
          success: true,
          message: text,
          data: typeof result === 'object' ? result : { text: result },
        }
      }

      case 'openai_models': {
        const result = await client.models.list()
        const models = []
        for await (const model of result) {
          models.push({ id: model.id, owned_by: model.owned_by, created: model.created })
        }
        return { success: true, message: `共 ${models.length} 个模型`, data: { models } }
      }

      default:
        return { success: false, message: `未知工具: ${name}` }
    }
  },
}
