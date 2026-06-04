exports.activate = (context) => {
  context.logger.info('阿里云OSS插件已激活')
}

exports.deactivate = (context) => {
  context.logger.info('阿里云OSS插件已停用')
}
