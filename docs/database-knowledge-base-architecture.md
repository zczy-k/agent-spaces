# Database 知识库架构

本文档简要说明当前 Database 知识库的实现结构。Database 是 workspace 级能力，一个 workspace 可以包含多个知识库数据库，每个数据库拥有独立的文档树。

## 核心模型

共享类型定义在：

```text
packages/shared/src/types/database.ts
```

主要类型：

- `DatabaseMeta`：数据库元数据，包含 `id`、`workspaceId`、`name`、`description`、`embeddingModelId`、`createdAt`、`updatedAt`。
- `DocNode`：知识库节点，包含 `databaseId`、标题、图标、封面、内容、父节点、回收站状态和时间戳。
- `DatabaseVectorStats`：数据库向量索引统计，包含绑定的 `embeddingModelId`、节点数、已索引数量和最后索引时间。
- `DatabaseVectorIndexResult`：批量向量化结果，包含索引统计、实际索引数量和跳过数量。
- `DatabaseVectorSearchResult`：向量检索结果，包含节点 ID、标题、路径、相似度分数、内容和更新时间。

节点树通过 `DocNode.parentId` 表达：

- `parentId = null` 表示数据库根目录下的节点。
- 同一个 `databaseId` 内的节点组成一棵树。
- 不同 `databaseId` 的节点互相隔离，不允许跨数据库移动或查询。

## 存储层

实现位于：

```text
packages/server/src/storage/database-store.ts
```

SQLite 文件位于应用数据目录的 `database/database.sqlite`。当前使用三张表：

- `databases`：保存 workspace 下的数据库元数据，并通过 `embedding_model_id` 记录该数据库绑定的 embedding 模型。
- `doc_nodes`：保存文档和目录节点，使用 `database_id` 归属到具体数据库。
- `database_embeddings`：保存文档节点的本地向量索引，包含节点 ID、路径、索引文本、内容 hash、embedding JSON、模型 ID 和索引时间。

关键函数：

- `listDatabases(workspaceId)`
- `getDefaultDatabase(workspaceId)`
- `createDatabase(workspaceId, input)`
- `updateDatabase(workspaceId, databaseId, updates)`
- `deleteDatabase(workspaceId, databaseId)`
- `listNodes(workspaceId, databaseId?)`
- `getNode(workspaceId, nodeId, databaseId?)`
- `createNode(workspaceId, node)`
- `updateNode(workspaceId, nodeId, updates, databaseId?)`
- `getVectorStats(workspaceId, databaseId)`
- `setDatabaseEmbeddingModel(workspaceId, databaseId, embeddingModelId)`
- `upsertDatabaseEmbedding(workspaceId, databaseId, record)`
- `listDatabaseEmbeddings(workspaceId, databaseId)`
- `deleteStaleDatabaseEmbeddings(workspaceId, databaseId, activeNodeIds)`

向量服务位于：

```text
packages/server/src/services/database-vector.ts
```

主要职责：

- `indexDatabaseVectors(workspaceId, databaseId)`：对指定数据库的非回收站节点做批量 embedding，并写入 `database_embeddings`。
- `searchDatabaseVectors(workspaceId, databaseId, query, limit)`：对 query 生成 embedding，读取本地 SQLite 中的向量并用余弦相似度排序。
- embedding 请求通过 `embeddingModelId` 找到 `packages/server/src/storage/llm-store.ts` 中的模型，再通过模型的 `provider` 名称找到服务商，从服务商读取 `apiBase` 和 `apiKey`。
- embedding HTTP 请求使用 OpenAI-compatible `/embeddings` 接口，body 为 `{ model, input }`。
- 批量索引按固定批次执行，当前批大小为 16。
- 索引文本由节点标题和 HTML 去标签后的内容组成，单节点文本会截断到当前最大长度。
- 向量请求失败或响应格式异常时会抛出带 `debug` 字段的 `DatabaseVectorError`，路由会把脱敏后的调试上下文返回给调用方并写入服务端日志。

默认数据库策略：

- 如果调用方未传 `databaseId`，服务端使用 `getDefaultDatabase(workspaceId)`。
- 当 workspace 没有数据库时，会自动创建一个 `Default Database`。

升级策略：

- 旧版本只有 workspace 级单一节点表，没有 `database_id`。
- 当前不兼容旧数据。启动时如果检测到旧结构，会删除旧 `doc_nodes` 并重建新结构。
- 早期向量设置曾使用 `embedding_agent_id`；启动时如果检测到旧列，会把已有值迁移到 `embedding_model_id`，后续以模型绑定为准。

## HTTP API

路由位于：

```text
packages/server/src/routes/database.ts
```

挂载路径：

```text
/api/workspaces/:id/database
```

数据库管理 API：

- `GET /databases`：列出当前 workspace 的数据库。
- `POST /databases`：创建数据库。
- `PUT /databases/:databaseId`：编辑数据库名称和描述。
- `DELETE /databases/:databaseId`：删除数据库及其所有节点。

数据库向量 API：

- `GET /databases/:databaseId/vector`：读取当前数据库的向量配置和索引统计。
- `PUT /databases/:databaseId/vector`：绑定或清空当前数据库的 embedding 模型，body 为 `{ embeddingModelId }`。
- `POST /databases/:databaseId/vector/index`：手动触发当前数据库的批量向量化，并保存到本地 SQLite。

`POST /databases/:databaseId/vector/index` 失败时，如果是 embedding 请求或响应格式问题，会返回额外 `debug` 信息，例如：

- `providerName`、`modelId`、`requestUrl`
- `inputCount`、`inputLengths`
- `status`、`responseContentType`
- `responseDataCount`、`validEmbeddingCount`、`embeddingDimensions`
- `responseKeys`、`responsePreview`

节点 API：

- `GET /?databaseId=...`：列出指定数据库节点。
- `GET /:nodeId?databaseId=...`：读取节点。
- `POST /?databaseId=...`：创建节点。
- `PUT /:nodeId?databaseId=...`：更新节点内容或元数据。
- `PUT /:nodeId/move?databaseId=...`：移动节点。
- `PUT /:nodeId/trash?databaseId=...`：移入回收站。
- `PUT /:nodeId/restore?databaseId=...`：从回收站恢复。
- `DELETE /:nodeId?databaseId=...`：永久删除节点。

`databaseId` 是可选参数；省略时使用默认数据库。

## 前端状态

状态管理位于：

```text
packages/web/src/stores/database.ts
```

核心状态：

- `databases`：当前 workspace 的数据库列表。
- `activeDatabaseId`：当前选中的数据库。
- `nodes`：当前数据库的节点列表。
- `activeId`、`openTabs`、`recentIds`：当前数据库内的编辑状态。
- `vectorStats`：当前数据库的向量配置和索引统计。
- `vectorLoading`：向量统计加载状态。
- `vectorIndexing`：批量向量化执行状态。

切换数据库时会重新加载节点，并清空当前 tab、最近访问、展开目录和侧边栏搜索，避免跨数据库引用旧节点。

## 前端面板

主要 UI 位于：

```text
packages/web/src/components/database/database-panel.tsx
```

侧边栏 header 中的 dropdown 负责：

- 展示当前数据库。
- 切换数据库。
- 打开创建数据库对话框。
- 打开编辑数据库对话框。
- 打开数据库向量设置对话框。
- 删除当前数据库。

文档树、编辑器、回收站和搜索仍然只操作当前 `activeDatabaseId` 对应的数据。

向量设置对话框内使用：

```text
packages/web/src/components/common/model-picker-dialog.tsx
```

交互规则：

- 只允许选择一个 embedding 模型。
- 只展示 `LLMModel.embedding = true` 的模型。
- 模型通过 `provider` 名称关联服务商配置，服务端使用服务商的 `apiBase` 和 `apiKey` 发送 embedding 请求。
- 用户绑定模型后可手动点击 `Start indexing` 对当前数据库做批量向量化。
- 用户可清空当前数据库的模型绑定。

## Agent 内置工具

工具实现位于：

```text
packages/server/src/services/builtin-tools/database-tools.ts
```

当前所有 Database 节点工具都支持可选 `databaseId` 参数：

- `ListDatabaseNodes`
- `SearchDatabaseNodes`
- `QueryDatabaseVectors`
- `ReadDatabaseNode`
- `CreateDatabaseNode`
- `WriteDatabaseNode`
- `DeleteDatabaseNode`
- `MoveDatabaseNode`
- `UpdateDatabaseNodeMeta`

执行规则：

- 传入 `databaseId` 时，只在该数据库内查询和修改节点。
- 未传 `databaseId` 时，使用 workspace 默认数据库。
- `parentId`、`path`、子孙节点校验都限定在同一个数据库内。
- `QueryDatabaseVectors` 使用目标数据库绑定的 embedding 模型执行语义向量查询；调用前需要先完成该数据库的向量索引。
- 当 Agent 已启用任意 Database 工具时，服务端会自动补齐 `CreateDatabaseNode` 和 `QueryDatabaseVectors`，保证数据库读写和向量查询能力完整。

## 设计约束

- Database 是 workspace 内资源，不是文件系统资源。
- 多数据库之间数据隔离，节点不能跨数据库移动。
- 删除数据库会删除其全部节点。
- 删除数据库会删除其全部向量索引。
- 永久删除节点会同步删除该节点的向量索引。
- 旧单数据库数据不做兼容迁移。
- 前端切换数据库后不保留旧数据库编辑上下文。
- 向量索引是手动触发的本地 SQLite 索引，不会在文档编辑时自动增量更新。
- 向量检索依赖 OpenAI-compatible `/embeddings` 响应格式：`data[].embedding` 必须为数值数组，返回条数必须与输入条数一致。
