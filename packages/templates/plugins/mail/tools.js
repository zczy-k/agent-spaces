const nodemailer = require('nodemailer')

function createTransporter(args) {
  const port = Number(args.port) || 465
  return nodemailer.createTransport({
    host: args.host,
    port,
    secure: port === 465,
    auth: { user: args.user, pass: args.pass },
  })
}

module.exports = {
  tools: [
    {
      name: 'mail_send',
      description: '通过 SMTP 发送邮件。支持纯文本/HTML 正文、抄送/密送、附件。',
      input_schema: {
        type: 'object',
        properties: {
          host: { type: 'string', description: 'SMTP 服务器地址' },
          port: { type: 'number', description: 'SMTP 端口，默认 465' },
          user: { type: 'string', description: 'SMTP 用户名' },
          pass: { type: 'string', description: 'SMTP 密码或授权码' },
          from: { type: 'string', description: '发件人，"名称 <地址>" 或纯地址' },
          to: { type: 'string', description: '收件人，多个用逗号分隔' },
          cc: { type: 'string', description: '抄送，多个用逗号分隔' },
          bcc: { type: 'string', description: '密送，多个用逗号分隔' },
          subject: { type: 'string', description: '邮件主题' },
          body: { type: 'string', description: '邮件正文' },
          html: { type: 'boolean', description: '正文是否为 HTML，默认 false' },
          attachments: { type: 'array', items: { type: 'string' }, description: '附件文件路径数组' },
        },
        required: ['host', 'user', 'pass', 'to', 'subject', 'body'],
      },
    },
  ],

  handler: async (name, args, api) => {
    if (name !== 'mail_send') {
      return { success: false, message: `未知工具: ${name}` }
    }

    const transporter = createTransporter(args)
    const mailOptions = {
      from: args.from || args.user,
      to: args.to,
      subject: args.subject,
      ...(args.cc && { cc: args.cc }),
      ...(args.bcc && { bcc: args.bcc }),
    }

    mailOptions[args.html ? 'html' : 'text'] = args.body

    if (args.attachments?.length) {
      mailOptions.attachments = args.attachments.map(p => ({ path: p }))
    }

    const info = await transporter.sendMail(mailOptions)
    transporter.close()

    return {
      success: true,
      message: `邮件已发送至 ${mailOptions.to}`,
      data: { messageId: info.messageId, response: info.response },
    }
  },
}
