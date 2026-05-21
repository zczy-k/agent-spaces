import http from 'node:http'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers)
    res.end()
    return
  }

  if (req.method === 'POST') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      console.log('\n=== Captured Element ===')
      try {
        const data = JSON.parse(body)
        console.log(JSON.stringify(data, null, 2))
      } catch {
        console.log(body)
      }
      console.log('========================\n')
      res.writeHead(200, { 'Content-Type': 'application/json', ...headers })
      res.end('{"ok":true}')
    })
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain', ...headers })
    res.end('Mock server running')
  }
})

server.listen(3999, () => {
  console.log('Mock server listening on http://localhost:3999')
})
