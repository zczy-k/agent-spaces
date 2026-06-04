exports.activate = (context) => {
  context.logger.info('FFmpeg插件已激活')
}

exports.deactivate = (context) => {
  context.logger.info('FFmpeg插件已停用')
}
