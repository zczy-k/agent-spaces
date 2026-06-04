const nodemailer = require('nodemailer')

function createTransporter(config) {
  const port = Number(config.port) || 465
  return nodemailer.createTransport({
    host: config.host,
    port,
    secure: port === 465,
    auth: { user: config.user, pass: config.pass },
  })
}

module.exports = {
  nodes: [
    {
      type: 'mail_send',
      label: '发送邮件',
      category: '邮件',
      icon: 'Mail',
      description: '通过 SMTP 发送邮件',
      properties: [
        { key: 'host', label: 'SMTP 服务器', type: 'text', required: true, default: '{{ __config__["workfox.mail"]["host"] }}' },
        { key: 'port', label: '端口', type: 'number', default: '{{ __config__["workfox.mail"]["port"] || 465 }}' },
        { key: 'user', label: '用户名', type: 'text', required: true, default: '{{ __config__["workfox.mail"]["user"] }}' },
        { key: 'pass', label: '密码/授权码', type: 'text', required: true, default: '{{ __config__["workfox.mail"]["pass"] }}' },
        { key: 'from', label: '发件人', type: 'text', default: '{{ __config__["workfox.mail"]["from"] }}', tooltip: '"名称 <地址>" 或纯地址' },
        { key: 'to', label: '收件人', type: 'text', required: true, tooltip: '多个用逗号分隔' },
        { key: 'cc', label: '抄送', type: 'text', tooltip: '多个用逗号分隔' },
        { key: 'bcc', label: '密送', type: 'text', tooltip: '多个用逗号分隔' },
        { key: 'subject', label: '主题', type: 'text', required: true },
        { key: 'body', label: '正文', type: 'textarea', required: true, tooltip: '纯文本或 HTML（勾选下方 HTML 开关）' },
        { key: 'html', label: 'HTML 正文', type: 'boolean', default: false, tooltip: '勾选则正文按 HTML 渲染' },
        { key: 'attachments', label: '附件路径', type: 'textarea', tooltip: '文件路径数组 JSON，如 ["/path/to/file.pdf"]' },
      ],
      outputs: [
        { key: 'success', type: 'boolean' },
        { key: 'message', type: 'string' },
        { key: 'data', type: 'object', children: [
          { key: 'messageId', type: 'string' },
          { key: 'response', type: 'string' },
        ] },
      ],
      handler: async (ctx, args) => {
        const config = { host: args.host, port: args.port, user: args.user, pass: args.pass }
        const transporter = createTransporter(config)

        const mailOptions = {
          from: args.from || args.user,
          to: args.to,
          subject: args.subject,
          ...(args.cc && { cc: args.cc }),
          ...(args.bcc && { bcc: args.bcc }),
        }

        mailOptions[args.html ? 'html' : 'text'] = args.body

        if (args.attachments) {
          const paths = Array.isArray(args.attachments) ? args.attachments : JSON.parse(args.attachments)
          mailOptions.attachments = paths.map(p => ({ path: p }))
        }

        ctx.logger.info(`发送邮件: ${mailOptions.from} -> ${mailOptions.to}, 主题: ${mailOptions.subject}`)
        const info = await transporter.sendMail(mailOptions)
        ctx.logger.info(`发送成功: ${info.messageId}`)
        transporter.close()

        return {
          success: true,
          message: `邮件已发送至 ${mailOptions.to}`,
          data: { messageId: info.messageId, response: info.response },
        }
      },
    },
  ],
}
