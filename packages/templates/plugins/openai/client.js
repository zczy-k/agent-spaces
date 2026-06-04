const OpenAI = require('openai')

function createClient(args) {
  const apiKey = args.apiKey
  if (!apiKey) throw new Error('缺少 apiKey')
  return new OpenAI({
    apiKey,
    baseURL: args.baseUrl || 'https://api.openai.com',
  })
}

module.exports = { createClient }
