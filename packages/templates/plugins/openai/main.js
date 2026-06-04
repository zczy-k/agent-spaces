exports.activate = (context) => {
  context.logger.info('OpenAI 插件已激活')
}

exports.deactivate = (context) => {
  context.logger.info('OpenAI 插件已停用')
}
