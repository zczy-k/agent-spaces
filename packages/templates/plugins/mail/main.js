exports.activate = (context) => {
  context.logger.info('邮件插件已激活')
}

exports.deactivate = (context) => {
  context.logger.info('邮件插件已停用')
}
