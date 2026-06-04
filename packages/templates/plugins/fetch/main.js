exports.activate = (context) => {
  context.logger.info('网络请求插件已激活')
}

exports.deactivate = (context) => {
  context.logger.info('网络请求插件已停用')
}
