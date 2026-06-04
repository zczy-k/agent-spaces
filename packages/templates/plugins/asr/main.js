exports.activate = (context) => {
  context.logger.info('语音识别ASR插件已激活')
}

exports.deactivate = (context) => {
  context.logger.info('语音识别ASR插件已停用')
}
