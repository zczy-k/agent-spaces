const {
  postForBuffer,
  postFormData,
  saveToTempFile,
  readAudioFile,
  getFormatExt,
  getMimeType,
  buildAuthHeader,
  resolveBaseUrl,
  resolveProxy,
} = require('./shared')

module.exports = {
  tools: [
    {
      name: 'fish_audio_tts',
      description: 'FishAudio 文字转语音（TTS）：将文字转换为自然语音音频。支持多种音色模型、音频格式（MP3/WAV/PCM/Opus）、语速和音量调节。通过 reference_id 指定音色，或使用零样本克隆。',
      input_schema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '要转换为语音的文字内容' },
          apiKey: { type: 'string', description: 'FishAudio API Key（也可在插件配置中全局设置）' },
          referenceId: { type: 'string', description: '音色模型 ID（可在 fish.audio 模型市场获取）' },
          model: { type: 'string', description: 'TTS 模型，默认 s2-pro，支持 s1/s2-pro' },
          format: { type: 'string', description: '音频格式，默认 mp3，支持 wav/mp3/pcm/opus' },
          sampleRate: { type: 'number', description: '采样率(Hz)，默认 44100（opus 为 48000）' },
          speed: { type: 'number', description: '语速倍率，0.5-2.0，默认 1.0' },
          volume: { type: 'number', description: '音量调整(dB)，正数放大负数减小，默认 0' },
          temperature: { type: 'number', description: '表现力控制，0-1，越高越丰富，默认 0.7' },
          topP: { type: 'number', description: '核采样参数，0-1，默认 0.7' },
          chunkLength: { type: 'number', description: '文本分片长度，100-300，默认 300' },
          latency: { type: 'string', description: '延迟模式：normal(最佳质量)/balanced(较低延迟)/low(最低延迟)' },
          baseUrl: { type: 'string', description: 'API 地址，默认 https://api.fish.audio' },
          proxy: { type: 'string', description: 'HTTP 代理地址，如 http://127.0.0.1:7890（也可在插件配置中全局设置）' },
        },
        required: ['text'],
      },
    },
    {
      name: 'fish_audio_stt',
      description: 'FishAudio 语音转文字（STT）：将音频文件转录为文字。支持多种音频格式（WAV/MP3/FLAC），可指定语言。',
      input_schema: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '音频文件的本地路径' },
          apiKey: { type: 'string', description: 'FishAudio API Key' },
          language: { type: 'string', description: '音频语言，如 zh/en/ja/ko 等，不填则自动检测' },
          ignoreTimestamps: { type: 'boolean', description: '是否忽略精确时间戳，默认 true' },
          baseUrl: { type: 'string', description: 'API 地址，默认 https://api.fish.audio' },
          proxy: { type: 'string', description: 'HTTP 代理地址，如 http://127.0.0.1:7890（也可在插件配置中全局设置）' },
        },
        required: ['filePath'],
      },
    },
  ],

  handler: async (name, args, api) => {
    const baseUrl = resolveBaseUrl(args)
    const proxy = resolveProxy(args)

    switch (name) {
      case 'fish_audio_tts': {
        const headers = buildAuthHeader(args.apiKey)
        const model = args.model || 's2-pro'
        const format = args.format || 'mp3'

        const body = {
          text: args.text,
          ...(args.referenceId && { reference_id: args.referenceId }),
          temperature: args.temperature ?? 0.7,
          top_p: args.topP ?? 0.7,
          ...(args.sampleRate && { sample_rate: args.sampleRate }),
          ...(args.chunkLength && { chunk_length: args.chunkLength }),
          format,
          normalize: true,
          ...(args.latency && { latency: args.latency }),
          prosody: {
            speed: args.speed ?? 1,
            volume: args.volume ?? 0,
            normalize_loudness: true,
          },
        }

        const { buffer, mimeType } = await postForBuffer(`${baseUrl}/v1/tts`, {
          headers: { ...headers, 'model': model },
          body,
          timeout: 120000,
          proxy,
        })

        const ext = getFormatExt(format)
        const filePath = saveToTempFile(buffer, ext)

        return {
          success: true,
          message: `语音合成完成，音频已保存`,
          data: { filePath, format, size: buffer.length, mimeType },
        }
      }

      case 'fish_audio_stt': {
        const headers = buildAuthHeader(args.apiKey)
        const audioBuffer = readAudioFile(args.filePath)

        const ext = require('path').extname(args.filePath).toLowerCase()
        const mimeType = getMimeType(ext)

        const result = await postFormData(`${baseUrl}/v1/asr`, {
          headers,
          file: { buffer: audioBuffer, mimeType },
          language: args.language || null,
          timeout: 120000,
          proxy,
        })

        return {
          success: true,
          message: `语音识别完成，时长 ${result.duration?.toFixed(1) || '?'}秒`,
          data: {
            text: result.text,
            duration: result.duration,
            segments: result.segments || [],
          },
        }
      }

      default:
        return { success: false, message: `未知工具: ${name}` }
    }
  },
}
