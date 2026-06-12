# 文案库插件（Copywriting Library）设计

- **日期**：2026-06-12
- **目标项目**：`~/.agent-spaces-data/workflows-ui/wui_1781260164_4147b9ff`（`type: react`，`mainFile: index.jsx`）
- **参考 UI**：`account_center/frontend/src/views/CopywritingView.vue`
- **能力依赖**：`workflow-ui-renderer`（SQLite + 任务事件 + 插件调用）、`workflow.aliyun-ai` 的 `asr_file_recognition`、`workflow.aliyun-oss` 的 `oss_upload_file`

## 1. 目标

在 workflow-ui 平台复刻 CopywritingView 的「文案库」体验：

- 支持 **音频 / 视频 / 文本** 三种文案类型
- 音视频：上传 → OSS 转公网 → 阿里云 ASR 转写为文字
- 文本：手动输入标题 + 正文
- 卡片瀑布流 + 侧边栏筛选（关键词 / 类型 / 标签 / 时长排序）
- 音视频播放器、编辑（标题 / 内容 / 转写稿 / 标签）、删除、转写失败重试
- 数据持久化于 **SQLite**（`data/db/copywriting.sqlite`）

**不含** AI 改写模式（侧边栏始终用于筛选；可作为后续扩展）。

## 2. 架构与数据流

```
[新建文案]
 ├─ 文本：表单 {title, content, tags} → INSERT(status='done')
 └─ 音视频：
     ① AgentSpaces.uploadFile(file)              → { path, httpPath }   本地落盘
     ② callPluginTool('workflow.aliyun-oss','oss_upload_file',{filePath:path}) → oss_url
     ③ INSERT(title, type, media_url=httpPath, oss_url, status='transcribing') → id
     ④ callPluginTool('workflow.aliyun-ai','asr_file_recognition',
         {model:'paraformer-v2', fileUrls:[oss_url]}, {taskId, meta:{id,title}})
        └─ 工具 run 内部自动轮询（≤10min），返回 data.text
     ⑤ UPDATE SET transcription=text, status='done'   失败 → status='failed'
```

### 2.1 插件 config 自动注入（已核实）

`executePluginTool` 实现（`packages/server/src/services/plugin.ts:1038`）：

```js
const mergedArgs = Object.assign({}, getPluginConfig(pluginId), args);
```

直接 `callPluginTool` execute 时，平台把该插件的 config（用户在平台配置的 `apiKey`、`baseUrl` 等）合并进 args。因此前端**无需**传 `apiKey`/`baseUrl`，只传业务参数。`model` 缺省时工具 `run` 内部回退 `paraformer-v2`。

### 2.2 `callPluginTool` 返回结构（已核实）

宿主 `use-workflow-ui-host-api.ts:211` 自动剥壳：响应含 `result` 键则返回内层。因此 `callPluginTool` 直接返回工具输出 `{ success, message, data }`，取值 `result.data.url` / `result.data.text`，与 `plugin-faq.md` 示例一致。

## 3. 异步转写状态管理（方案 A：平台任务事件）

`asr_file_recognition` 单次 execute 内部 auto-poll，完成即触发 `workflowUi.taskFinished`。利用平台的任务事件机制做 UI 同步：

- 发起方：`await callPluginTool(..., { taskId, meta:{id,title} })` 拿结果落库；await 期间卡片按 `meta.id` 显示「转写中」
- `onTaskEvent`：订阅 `taskSnapshot`（重连恢复）/ `taskFinished` / `taskFailed`，按 `executorId === getExecutorId()` 过滤、按 `meta.id` 定位卡片
- 不在项目内自建轮询（符合 `workflow-ui-renderer.md`「收敛在宿主层」原则）

发起方仍以 `await` 拿结果为主路径，事件仅用于跨标签 / 刷新恢复的 UI 同步。

## 4. 文件结构

```
src/
  index.jsx                    # 入口：瀑布流 + 侧边栏布局、编排、事件订阅
  components/
    Toolbar.jsx                # 标题 / 计数 / 「新建文案」按钮
    CopywritingCard.jsx        # 瀑布流卡片：标题 / 预览 / 类型角标 / 标签 / 播放 / 重试 / 转写中态
    FilterSidebar.jsx          # 关键词 / 类型 / 标签 / 时长排序 + 清除
    CopywritingForm.jsx        # 新建 + 编辑弹窗：标题 / 类型切换 / 文件选择或正文 / 标签
    PlayerDialog.jsx           # 音视频播放弹窗（<video> / <audio>）
  hooks/
    useCopywritingDb.js        # SQLite CRUD + 过滤 + 事务
    useSettings.js             # JSON config 偏好（恢复上次筛选）
  utils/
    db.js                      # db('copywriting') + initSchema 幂等建表
    settings.js                # readConfigJson / writeConfigJson
    transcribe.js              # uploadFile / oss_upload_file / asr_file_recognition 编排
```

## 5. 数据模型（SQLite）

库文件：`data/db/copywriting.sqlite`

```sql
CREATE TABLE IF NOT EXISTS copywriting (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'text',   -- 'audio' | 'video' | 'text'
  content       TEXT DEFAULT '',                 -- 文本类型正文
  transcription TEXT DEFAULT '',                 -- 音视频 ASR 转写（可编辑）
  tags          TEXT DEFAULT '',                 -- 逗号分隔，LIKE 过滤
  media_url     TEXT DEFAULT '',                 -- 本地播放路径（httpPath）
  oss_url       TEXT DEFAULT '',                 -- OSS 公网 URL（转写用，重试复用）
  duration      INTEGER DEFAULT 0,              -- 秒；时长排序
  status        TEXT DEFAULT 'done',            -- 'transcribing' | 'done' | 'failed'
  created_at    INTEGER,
  updated_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_cw_type   ON copywriting(type);
CREATE INDEX IF NOT EXISTS idx_cw_status ON copywriting(status);
```

文案正文取值：`type === 'text' ? content : transcription`（对齐 CopywritingView 的 `getItemText`）。

## 6. 组件职责

- **index.jsx**：持有筛选状态、列表、转写中 id 集合；编排新建 / 编辑 / 删除 / 重试 / 播放；`onTaskEvent` 订阅；布局为左瀑布流 + 右 `FilterSidebar`。
- **CopywritingCard**：展示标题、正文预览（前 N 字）、类型角标、标签、创建时间；音视频显示播放按钮；`status==='transcribing'` 显示 spinner，`'failed'` 显示重试；点击卡片打开编辑。
- **CopywritingForm**（Dialog）：新建 / 编辑共用；类型切换：
  - `text`：标题 + 正文 Textarea
  - `audio`/`video`：标题 + `<Input type="file" accept="audio/*,video/*">`（新建必选；编辑时只读，不可改文件）
  - 标签输入（回车追加，逗号分隔存储）
  - 编辑模式下音视频显示可编辑转写稿 Textarea
- **FilterSidebar**：关键词输入（回车 / 清除）、类型 chip（全部 / 音频 / 视频 / 文本）、标签 chip（来自库内 distinct）、时长排序（默认 / 短→长 / 长→短）、清除全部。
- **PlayerDialog**（Dialog）：根据 `type` 渲染 `<video controls>` 或 `<audio controls>`，`src = media_url`。
- **Toolbar**：标题「文案管理」、总条数、「新建文案」按钮。

## 7. 前置条件

1. 平台已安装并**配置凭据**：
   - `workflow.aliyun-ai`：`apiKey`（阿里云百炼 DashScope）
   - `workflow.aliyun-oss`：`region` / `accessKeyId` / `accessKeySecret` / `bucket`（bucket 对象需公网可读，供 DashScope 拉取）
2. server 与 OSS 上传插件在同一机器（`/api/upload` 返回的 `path` 仅本机可读）。

## 8. 错误处理

- 文件未选 / 标题为空：表单内联校验，禁用提交
- `uploadFile` 失败：提示「上传失败」，终止
- OSS 失败：提示「转存公网失败」，终止（不写库）
- ASR 失败 / 超时：`UPDATE status='failed'`，卡片显示「重试」；重试复用已存的 `oss_url`，仅重新发起 ASR，不重新上传
- `apiKey` 缺失（config 未配）：ASR 返回 401，catch 后提示「请在平台配置 aliyun-ai 插件凭据」

## 9. 验证（手动，平台无自动化测试）

1. 配置好两个插件凭据
2. 新建文本文案 → 列表出现 → 编辑改内容 → 删除
3. 新建音频文案（小 mp3）→ 卡片显示「转写中」→ 完成后出现转写文字 → 点播放听原音 → 编辑转写稿
4. 筛选：关键词命中、类型过滤、标签过滤、时长排序、清除
5. 断网 / 关 ASR 凭据制造失败 → 卡片显示「重试」→ 恢复后重试成功
6. 数据落盘核对：`data/db/copywriting.sqlite` 有对应行；`configs/settings.json` 记录上次筛选
