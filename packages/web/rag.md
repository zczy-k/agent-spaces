我想给知识库做rag检索，大概的逻辑是：
在 packages/web/src/components/database/database-panel.tsx:357~365 右侧增加一个打开数据库向量设置的对话框，可以给当前数据库绑定一个embedding模型(packages\web\src\components\common\agent-picker-dialog.tsx)，绑定后可以手动点击开始进行对文档的批量向量化并保存到本地sqlite
在 packages\server\src\services\builtin-tools\database-tools.ts 增加一个向量查询的工具，调用数据库绑定的agent来进行查询并输出到工具结果


**最小实现方案 (Node.js)**

```bash
npm install openai sqlite3
```

**db.js**
```js
import sqlite3 from 'sqlite3';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const db = new sqlite3.Database('kb.db');

db.exec(`CREATE TABLE IF NOT EXISTS docs (
  id INTEGER PRIMARY KEY,
  text TEXT,
  embedding TEXT
)`);

async function embed(text) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });
  return JSON.stringify(res.data[0].embedding);
}

async function add(text) {
  const emb = await embed(text);
  db.run("INSERT INTO docs (text, embedding) VALUES (?, ?)", [text, emb]);
}

function cosine(a, b) {
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] * a[i];
    mb += b[i] * b[i];
  }
  return dot / (Math.sqrt(ma) * Math.sqrt(mb));
}

async function search(query, limit = 5) {
  const qemb = JSON.parse(await embed(query));
  return new Promise((resolve) => {
    db.all("SELECT id, text, embedding FROM docs", [], (err, rows) => {
      const results = rows.map(row => ({
        id: row.id,
        text: row.text,
        score: cosine(qemb, JSON.parse(row.embedding))
      })).sort((a, b) => b.score - a.score).slice(0, limit);
      resolve(results);
    });
  });
}

export { add, search };
```

**用法**:
```js
import { add, search } from './db.js';

await add("你的文本内容");
const results = await search("查询问题");
console.log(results);
```

纯SQLite + 手动余弦相似度，最轻量。推荐小规模使用（<10k条）。