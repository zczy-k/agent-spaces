# Robot Accounts 全局账号管理设计

## 目标

将飞书/企微 Bot 凭证从 Workspace 级别的 `notificationSettings` 中抽离为全局 Robot Account 列表，各 Workspace 通过引用 `robotAccountId` 来配置通知渠道，避免重复配置凭证。

## 数据模型

### 新增 RobotAccount

存储位置：`~/.agent-spaces-data/robot-accounts.json`

```typescript
interface RobotAccount {
  id: string;
  name: string;            // 用户自定义名称，如 "公司飞书Bot"
  type: 'lark' | 'wechat';
  lark?: {
    appId: string;
    appSecret: string;
  };
  wechat?: {
    token: string;
    baseUrl?: string;
    accountId: string;
    userId?: string;
  };
  createdAt: string;
  updatedAt: string;
}
```

### WorkspaceNotificationSettings 扩展

新增 `robotAccountId` 字段，保留现有 `lark`/`wechat` 字段用于运行时状态和向后兼容。

```typescript
interface WorkspaceNotificationSettings {
  // ... 现有字段不变 ...
  robotAccountId?: string;  // 引用全局 RobotAccount.id
}
```

### 凭证解析逻辑

`resolveCredentials(settings)`：
1. 若 `settings.robotAccountId` 存在，从 `robot-accounts.json` 查找对应账号返回凭证
2. 否则 fallback 到 `settings.lark` / `settings.wechat` 内嵌凭证（兼容旧数据）

## 后端改动

### 新增文件

| 文件 | 职责 |
|------|------|
| `storage/robot-account-store.ts` | JSON CRUD（robot-accounts.json） |
| `services/robot-account.ts` | CRUD + resolveCredentials |
| `routes/robot-account.ts` | `/api/robot-accounts` REST API |

### API

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/robot-accounts` | GET | 列出所有账号 |
| `/api/robot-accounts` | POST | 创建账号 |
| `/api/robot-accounts/:id` | PUT | 更新账号 |
| `/api/robot-accounts/:id` | DELETE | 删除账号 |

### 改造文件

| 文件 | 改动 |
|------|------|
| `services/notification-hub/service.ts` | 启动通知时调用 `resolveCredentials()` 获取凭证再构造 adapter |
| `services/notification-hub/lark-adapter.ts` | 构造函数接受凭证参数（或从外部传入） |
| `services/notification-hub/wechat-adapter.ts` | 同上 |
| `routes/workspace.ts` | 企微 QR 登录时绑定到 robotAccountId |
| `app.ts` | 注册 robot-account 路由 |

## 前端改动

### settings-dialog.tsx

新增 `robots` Tab（Robot 图标），渲染 `<RobotAccountsTab />`。

### 新建 `components/settings/robot-accounts-tab.tsx`

- 列出所有 Robot 账号（飞书/企微分组或统一列表）
- 添加飞书账号：表单输入 name + appId + appSecret
- 添加企微账号：输入 name → QR 扫码登录获取 token/accountId
- 编辑名称 / 删除账号

### notification-settings-tab.tsx 改造

- **飞书 Tab**：去掉 appId/appSecret 输入框，改为 select 下拉选择已有飞书 Robot 账号
- **企微 Tab**：去掉 QR 登录区域，改为 select 下拉选择已有企微 Robot 账号
- 保留 start/stop/test 按钮和事件配置
- 选择账号后调用 `patchNotifications({ robotAccountId: account.id })`

## 兼容性

- 旧 Workspace 无 `robotAccountId` 时，后端 `resolveCredentials()` fallback 读取内嵌凭证
- 前端 notification-settings-tab 检测无 `robotAccountId` 但有内嵌凭证时，显示兼容提示
- 飞书部署教程对话框保留在 notification-settings-tab 中

## shared 类型新增

`packages/shared/src/types/workspace.ts` 新增 `RobotAccount` 接口，`WorkspaceNotificationSettings` 新增 `robotAccountId` 字段。
