# Database 知识库架构

本文档简要说明当前 Database 知识库的实现结构。Database 是 workspace 级能力，一个 workspace 可以包含多个知识库数据库，每个数据库拥有独立的文档树。

## 核心模型

共享类型定义在：

```text
packages/shared/src/types/database.ts
```

主要类型：

- `DatabaseMeta`：数据库元数据，包含 `id`、`workspaceId`、`name`、`description`、`createdAt`、`updatedAt`。
- `DocNode`：知识库节点，包含 `databaseId`、标题、图标、封面、内容、父节点、回收站状态和时间戳。

节点树通过 `DocNode.parentId` 表达：

- `parentId = null` 表示数据库根目录下的节点。
- 同一个 `databaseId` 内的节点组成一棵树。
- 不同 `databaseId` 的节点互相隔离，不允许跨数据库移动或查询。

## 存储层

实现位于：

```text
packages/server/src/storage/database-store.ts
```

SQLite 文件位于应用数据目录的 `database/database.sqlite`。当前使用两张表：

- `databases`：保存 workspace 下的数据库元数据。
- `doc_nodes`：保存文档和目录节点，使用 `database_id` 归属到具体数据库。

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

默认数据库策略：

- 如果调用方未传 `databaseId`，服务端使用 `getDefaultDatabase(workspaceId)`。
- 当 workspace 没有数据库时，会自动创建一个 `Default Database`。

升级策略：

- 旧版本只有 workspace 级单一节点表，没有 `database_id`。
- 当前不兼容旧数据。启动时如果检测到旧结构，会删除旧 `doc_nodes` 并重建新结构。

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
- 删除当前数据库。

文档树、编辑器、回收站和搜索仍然只操作当前 `activeDatabaseId` 对应的数据。

## Agent 内置工具

工具实现位于：

```text
packages/server/src/services/builtin-tools/database-tools.ts
```

当前所有 Database 节点工具都支持可选 `databaseId` 参数：

- `ListDatabaseNodes`
- `SearchDatabaseNodes`
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

## 设计约束

- Database 是 workspace 内资源，不是文件系统资源。
- 多数据库之间数据隔离，节点不能跨数据库移动。
- 删除数据库会删除其全部节点。
- 旧单数据库数据不做兼容迁移。
- 前端切换数据库后不保留旧数据库编辑上下文。
