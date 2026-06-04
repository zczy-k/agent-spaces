const ffmpeg = require('@ts-ffmpeg/fluent-ffmpeg')
const path = require('path')
const fs = require('fs')

function setFfmpegPath(ffmpegPath) {
  if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath)
}

function runCommand(cmd, outputPath, ctx) {
  return new Promise((resolve, reject) => {
    cmd
      .on('start', (line) => ctx.logger.info(`命令: ${line}`))
      .on('progress', (p) => ctx.logger.info(`进度: ${Math.round(p.percent || 0)}%`))
      .on('error', (err) => {
        ctx.logger.error(err.message)
        reject(err)
      })
      .on('end', () => resolve())
      .save(outputPath)
  })
}

module.exports = {
  nodes: [
    {
      type: 'ffmpeg_format_convert',
      label: '格式转换',
      category: 'FFmpeg',
      icon: 'FileVideo',
      description: '音视频格式转换，支持常见音视频格式互转',
      properties: [
        { key: 'inputPath', label: '输入文件路径', type: 'text', required: true, tooltip: '输入文件的绝对路径' },
        { key: 'outputFormat', label: '输出格式', type: 'select', required: true, default: 'mp4', options: [
          { label: 'MP4', value: 'mp4' },
          { label: 'AVI', value: 'avi' },
          { label: 'MKV', value: 'mkv' },
          { label: 'MOV', value: 'mov' },
          { label: 'WebM', value: 'webm' },
          { label: 'FLV', value: 'flv' },
          { label: 'GIF', value: 'gif' },
          { label: 'MP3', value: 'mp3' },
          { label: 'WAV', value: 'wav' },
          { label: 'AAC', value: 'aac' },
          { label: 'FLAC', value: 'flac' },
          { label: 'OGG', value: 'ogg' },
        ] },
        { key: 'videoCodec', label: '视频编码器', type: 'select', options: [
          { label: '自动', value: '' },
          { label: 'H.264', value: 'libx264' },
          { label: 'H.265', value: 'libx265' },
          { label: 'VP9', value: 'libvpx-vp9' },
          { label: 'AV1', value: 'libaom-av1' },
          { label: 'MPEG-4', value: 'mpeg4' },
        ] },
        { key: 'audioCodec', label: '音频编码器', type: 'select', options: [
          { label: '自动', value: '' },
          { label: 'AAC', value: 'aac' },
          { label: 'MP3', value: 'libmp3lame' },
          { label: 'FLAC', value: 'flac' },
          { label: 'Vorbis', value: 'libvorbis' },
          { label: 'Opus', value: 'libopus' },
        ] },
        { key: 'outputPath', label: '输出文件路径', type: 'text', tooltip: '留空则自动生成（同目录，换扩展名）' },
        { key: 'ffmpegPath', label: 'FFmpeg路径', type: 'text', default: '{{ __config__["workfox.ffmpeg"]["ffmpegPath"] }}', tooltip: '留空使用系统PATH' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'outputPath', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const inputPath = args.inputPath
        if (!fs.existsSync(inputPath)) {
          return { success: false, message: `输入文件不存在: ${inputPath}` }
        }
        setFfmpegPath(args.ffmpegPath)

        const ext = args.outputFormat || 'mp4'
        const outputPath = args.outputPath || inputPath.replace(/\.[^.]+$/, `_converted.${ext}`)
        const audioOnly = ['mp3', 'wav', 'aac', 'flac', 'ogg'].includes(ext)

        let cmd = ffmpeg(inputPath).format(ext)
        if (args.videoCodec) cmd = cmd.videoCodec(args.videoCodec)
        if (args.audioCodec) cmd = cmd.audioCodec(args.audioCodec)
        if (audioOnly) cmd = cmd.noVideo()

        ctx.logger.info(`格式转换: ${inputPath} -> ${outputPath}`)

        try {
          await runCommand(cmd, outputPath, ctx)
          return { success: true, message: '格式转换完成', data: { outputPath } }
        } catch (err) {
          return { success: false, message: `转换失败: ${err.message}` }
        }
      },
    },
    {
      type: 'ffmpeg_merge',
      label: '音视频合并',
      category: 'FFmpeg',
      icon: 'Combine',
      description: '将独立的音频和视频文件合并为一个文件',
      properties: [
        { key: 'videoPath', label: '视频文件路径', type: 'text', required: true, tooltip: '视频文件的绝对路径' },
        { key: 'audioPath', label: '音频文件路径', type: 'text', required: true, tooltip: '音频文件的绝对路径' },
        { key: 'outputPath', label: '输出文件路径', type: 'text', required: true, tooltip: '合并后输出路径' },
        { key: 'reEncode', label: '重新编码', type: 'boolean', default: false, tooltip: '关闭则直接拷贝流（速度更快，但格式必须兼容）' },
        { key: 'videoCodec', label: '视频编码器', type: 'select', options: [
          { label: 'H.264', value: 'libx264' },
          { label: 'H.265', value: 'libx265' },
          { label: 'VP9', value: 'libvpx-vp9' },
        ] },
        { key: 'audioCodec', label: '音频编码器', type: 'select', options: [
          { label: 'AAC', value: 'aac' },
          { label: 'MP3', value: 'libmp3lame' },
          { label: 'Opus', value: 'libopus' },
        ] },
        { key: 'shortest', label: '以最短流为准', type: 'boolean', default: true, tooltip: '音视频长度不同时，以较短者为准截断' },
        { key: 'ffmpegPath', label: 'FFmpeg路径', type: 'text', default: '{{ __config__["workfox.ffmpeg"]["ffmpegPath"] }}', tooltip: '留空使用系统PATH' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'outputPath', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        if (!fs.existsSync(args.videoPath)) {
          return { success: false, message: `视频文件不存在: ${args.videoPath}` }
        }
        if (!fs.existsSync(args.audioPath)) {
          return { success: false, message: `音频文件不存在: ${args.audioPath}` }
        }
        setFfmpegPath(args.ffmpegPath)

        let cmd = ffmpeg()
          .input(args.videoPath)
          .input(args.audioPath)

        if (args.shortest !== false) {
          cmd = cmd.outputOptions('-shortest')
        }

        if (args.reEncode) {
          if (args.videoCodec) cmd = cmd.videoCodec(args.videoCodec)
          if (args.audioCodec) cmd = cmd.audioCodec(args.audioCodec)
        } else {
          cmd = cmd.outputOptions(['-c:v', 'copy', '-c:a', 'copy'])
        }

        ctx.logger.info(`音视频合并: video=${args.videoPath}, audio=${args.audioPath}`)

        try {
          await runCommand(cmd, args.outputPath, ctx)
          return { success: true, message: '音视频合并完成', data: { outputPath: args.outputPath } }
        } catch (err) {
          return { success: false, message: `合并失败: ${err.message}` }
        }
      },
    },
    {
      type: 'ffmpeg_demux',
      label: '音视频分离',
      category: 'FFmpeg',
      icon: 'Split',
      description: '从视频中提取音频轨道或去除音频轨道',
      properties: [
        { key: 'inputPath', label: '输入文件路径', type: 'text', required: true, tooltip: '输入音视频文件的绝对路径' },
        { key: 'mode', label: '分离模式', type: 'select', required: true, default: 'extract_audio', options: [
          { label: '提取音频', value: 'extract_audio' },
          { label: '去除音频（保留纯视频）', value: 'extract_video' },
          { label: '同时提取音频和视频', value: 'extract_both' },
        ] },
        { key: 'audioFormat', label: '音频格式', type: 'select', default: 'mp3', options: [
          { label: 'MP3', value: 'mp3' },
          { label: 'WAV', value: 'wav' },
          { label: 'AAC', value: 'aac' },
          { label: 'FLAC', value: 'flac' },
          { label: 'OGG', value: 'ogg' },
        ] },
        { key: 'audioOutputPath', label: '音频输出路径', type: 'text', tooltip: '留空自动生成' },
        { key: 'videoOutputPath', label: '视频输出路径', type: 'text', tooltip: '留空自动生成' },
        { key: 'ffmpegPath', label: 'FFmpeg路径', type: 'text', default: '{{ __config__["workfox.ffmpeg"]["ffmpegPath"] }}', tooltip: '留空使用系统PATH' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'audioPath', type: 'string' },
          { key: 'videoPath', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        if (!fs.existsSync(args.inputPath)) {
          return { success: false, message: `输入文件不存在: ${args.inputPath}` }
        }
        setFfmpegPath(args.ffmpegPath)

        const dir = path.dirname(args.inputPath)
        const base = path.basename(args.inputPath, path.extname(args.inputPath))
        const mode = args.mode || 'extract_audio'
        const audioExt = args.audioFormat || 'mp3'
        const audioOut = args.audioOutputPath || path.join(dir, `${base}.${audioExt}`)
        const videoOut = args.videoOutputPath || path.join(dir, `${base}_noaudio${path.extname(args.inputPath)}`)

        const tasks = []

        if (mode === 'extract_audio' || mode === 'extract_both') {
          ctx.logger.info(`提取音频: ${args.inputPath} -> ${audioOut}`)
          const audioCmd = ffmpeg(args.inputPath).noVideo().format(audioExt)
          tasks.push(
            runCommand(audioCmd, audioOut, ctx)
              .then(() => ({ audioOut }))
          )
        }

        if (mode === 'extract_video' || mode === 'extract_both') {
          ctx.logger.info(`去除音频: ${args.inputPath} -> ${videoOut}`)
          const videoCmd = ffmpeg(args.inputPath).noAudio().outputOptions('-c:v', 'copy')
          tasks.push(
            runCommand(videoCmd, videoOut, ctx)
              .then(() => ({ videoOut }))
          )
        }

        try {
          await Promise.all(tasks)
          return {
            success: true,
            message: '音视频分离完成',
            data: {
              audioPath: (mode === 'extract_audio' || mode === 'extract_both') ? audioOut : '',
              videoPath: (mode === 'extract_video' || mode === 'extract_both') ? videoOut : '',
            },
          }
        } catch (err) {
          return { success: false, message: `分离失败: ${err.message}` }
        }
      },
    },
  ],
}
