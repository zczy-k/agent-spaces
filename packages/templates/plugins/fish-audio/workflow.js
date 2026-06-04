const path = require('path')
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
  nodes: [
    {
      type: 'fish_audio_tts',
      label: 'AI文字转语音',
      category: 'FishAudio',
      icon: 'AudioWaveform',
      description: '使用 FishAudio 将文字转换为自然语音（TTS）',
      properties: [
        { key: 'apiKey', label: 'API Key', type: 'text', required: true, tooltip: 'FishAudio API Key（默认从插件配置读取）', default: '{{ __config__["workfox.fish-audio"]["apiKey"] }}' },
        { key: 'text', label: '文字内容', type: 'textarea', required: true, tooltip: '要转换为语音的文字' },
        { key: 'referenceId', label: '音色模型 ID', type: 'text', tooltip: '音色模型 ID（默认从插件配置读取）', default: '{{ __config__["workfox.fish-audio"]["referenceId"] }}' },
        { key: 'model', label: 'TTS 模型', type: 'select', default: 's2-pro', options: [
          { label: 'S2-Pro（推荐）', value: 's2-pro' },
          { label: 'S1', value: 's1' },
        ] },
        { key: 'format', label: '音频格式', type: 'select', default: 'mp3', options: [
          { label: 'MP3（默认）', value: 'mp3' },
          { label: 'WAV', value: 'wav' },
          { label: 'PCM', value: 'pcm' },
          { label: 'Opus', value: 'opus' },
        ] },
        { key: 'sampleRate', label: '采样率(Hz)', type: 'select', default: '44100', options: [
          { label: '44100 Hz（默认）', value: '44100' },
          { label: '16000 Hz', value: '16000' },
          { label: '24000 Hz', value: '24000' },
          { label: '32000 Hz', value: '32000' },
          { label: '48000 Hz（Opus 推荐）', value: '48000' },
        ] },
        { key: 'speed', label: '语速(0.5-2.0)', type: 'number', default: 1, tooltip: '1.0 为正常语速' },
        { key: 'volume', label: '音量(dB)', type: 'number', default: 0, tooltip: '0 为不变，正数放大，负数减小' },
        { key: 'temperature', label: '表现力(0-1)', type: 'number', default: 0.7, tooltip: '越高越丰富多变' },
        { key: 'latency', label: '延迟模式', type: 'select', default: 'normal', options: [
          { label: 'Normal（最佳质量）', value: 'normal' },
          { label: 'Balanced（较低延迟）', value: 'balanced' },
          { label: 'Low（最低延迟）', value: 'low' },
        ] },
        { key: 'baseUrl', label: 'API 地址', type: 'text', default: '{{ __config__["workfox.fish-audio"]["baseUrl"] }}', tooltip: 'FishAudio API 基础地址' },
        { key: 'proxy', label: 'HTTP 代理', type: 'text', tooltip: 'HTTP 代理地址，默认从插件配置读取', default: '{{ __config__["workfox.fish-audio"]["httpProxy"] }}', placeholder: 'http://127.0.0.1:7890' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'filePath', type: 'string' },
          { key: 'format', type: 'string' },
          { key: 'size', type: 'number' },
          { key: 'mimeType', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const baseUrl = resolveBaseUrl(args)
        const proxy = resolveProxy(args)
        const headers = buildAuthHeader(args.apiKey)

        const model = args.model || 's2-pro'
        const format = args.format || 'mp3'
        const sampleRate = parseInt(args.sampleRate) || 44100

        const body = {
          text: args.text,
          ...(args.referenceId && { reference_id: args.referenceId }),
          temperature: args.temperature ?? 0.7,
          top_p: 0.7,
          sample_rate: sampleRate,
          format,
          normalize: true,
          ...(args.latency && { latency: args.latency }),
          prosody: {
            speed: args.speed ?? 1,
            volume: args.volume ?? 0,
            normalize_loudness: true,
          },
        }

        ctx.logger.info(`TTS 请求: ${baseUrl}/v1/tts${proxy ? ` (代理: ${proxy})` : ''}`)
        ctx.logger.info(`模型: ${model}, 格式: ${format}, 采样率: ${sampleRate}Hz`)
        ctx.logger.info(`语速: ${body.prosody.speed}, 表现力: ${body.temperature}`)
        ctx.logger.info(`文字长度: ${args.text.length} 字符`)

        const { buffer, mimeType } = await postForBuffer(`${baseUrl}/v1/tts`, {
          headers: { ...headers, 'model': model },
          body,
          timeout: 120000,
          proxy,
        })

        const ext = getFormatExt(format)
        const filePath = saveToTempFile(buffer, ext)

        ctx.logger.info(`TTS 完成: ${filePath} (${(buffer.length / 1024).toFixed(1)}KB)`)

        return {
          success: true,
          message: `语音合成完成，音频已保存 (${(buffer.length / 1024).toFixed(1)}KB)`,
          data: { filePath, format, size: buffer.length, mimeType },
        }
      },
    },
    {
      type: 'fish_audio_stt',
      label: 'AI语音转文字',
      category: 'FishAudio',
      icon: 'Mic',
      description: '使用 FishAudio 将音频文件转录为文字（STT）',
      properties: [
        { key: 'apiKey', label: 'API Key', type: 'text', required: true, tooltip: 'FishAudio API Key（默认从插件配置读取）', default: '{{ __config__["workfox.fish-audio"]["apiKey"] }}' },
        { key: 'filePath', label: '音频文件路径', type: 'text', required: true, tooltip: '本地音频文件路径（支持 WAV/MP3/FLAC）' },
        { key: 'language', label: '语言', type: 'select', default: 'auto', options: [
          { label: '自动检测', value: 'auto' },
          { label: '中文', value: 'zh' },
          { label: '英文', value: 'en' },
          { label: '日文', value: 'ja' },
          { label: '韩文', value: 'ko' },
          { label: '法文', value: 'fr' },
          { label: '德文', value: 'de' },
          { label: '西班牙文', value: 'es' },
        ] },
        { key: 'baseUrl', label: 'API 地址', type: 'text', default: '{{ __config__["workfox.fish-audio"]["baseUrl"] }}', tooltip: 'FishAudio API 基础地址' },
        { key: 'proxy', label: 'HTTP 代理', type: 'text', tooltip: 'HTTP 代理地址，默认从插件配置读取', default: '{{ __config__["workfox.fish-audio"]["httpProxy"] }}', placeholder: 'http://127.0.0.1:7890' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'text', type: 'string' },
          { key: 'duration', type: 'number' },
          { key: 'segments', type: 'object', children: [] },
        ] },
      ],
      handler: async (ctx, args) => {
        const baseUrl = resolveBaseUrl(args)
        const proxy = resolveProxy(args)
        const headers = buildAuthHeader(args.apiKey)

        const audioBuffer = readAudioFile(args.filePath)
        const ext = path.extname(args.filePath).toLowerCase()
        const mimeType = getMimeType(ext)

        ctx.logger.info(`STT 请求: ${baseUrl}/v1/asr${proxy ? ` (代理: ${proxy})` : ''}`)
        ctx.logger.info(`文件: ${args.filePath} (${(audioBuffer.length / 1024).toFixed(1)}KB, ${mimeType})`)
        ctx.logger.info(`语言: ${args.language || '自动检测'}`)

        const result = await postFormData(`${baseUrl}/v1/asr`, {
          headers,
          file: { buffer: audioBuffer, mimeType },
          language: (args.language && args.language !== 'auto') ? args.language : null,
          timeout: 120000,
          proxy,
        })

        ctx.logger.info(`STT 完成: 时长 ${result.duration?.toFixed(1) || '?'}秒, 文字长度 ${result.text?.length || 0}`)

        return {
          success: true,
          message: `语音识别完成，时长 ${result.duration?.toFixed(1) || '?'}秒`,
          data: {
            text: result.text,
            duration: result.duration,
            segments: result.segments || [],
          },
        }
      },
    },
  ],
}
