# Findings & Decisions

## Requirements
- 根据 `docs/bot-notification-workflow.md` 扩展现有 workspace 通知体系。
- 参考 `/Users/Zhuanz/Downloads/wx-robot-ilink-main` 接入微信 iLink robot。
- 在 `packages/web/src/components/settings/project-settings-panel.tsx` 的 WeChat tab 展示配置二维码。

## Research Findings
- Shared 类型目前已有 `NotificationProvider = 'lark' | 'wechat'`，但 `WorkspaceNotificationSettings` 只有 `lark` 配置。
- 后端 `packages/server/src/services/notification-hub.ts` 只有 `LarkNotificationAdapter`，`startWorkspaceNotificationService()` 对 `wechat` 返回 unsupported。
- 现有抽象 `BotAdapter` 只要求 `start/stop/send/hasRecipients`，适合新增 WeChat adapter。
- 设置面板 WeChat tab 目前只显示 “reserved/todo” 文案。
- wx 参考项目关键接口：
  - `GET https://ilinkai.weixin.qq.com/ilink/bot/get_bot_qrcode?bot_type=3`
  - `GET .../ilink/bot/get_qrcode_status?qrcode=...`，header `iLink-App-ClientVersion: 1`
  - 确认后返回 `bot_token`、`baseurl`、`ilink_bot_id`、`ilink_user_id`
  - `POST ilink/bot/getupdates` 长轮询收消息
  - `POST ilink/bot/sendmessage` 发送文本
- 参考项目按 `from_user_id` 记录上下文 token；本项目可以按 workspace 存 `userIds` 作为主动通知收件人。

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Persist WeChat token/baseUrl/accountId/userIds in `workspace.notificationSettings.wechat` | Matches existing Lark persistence model and enables service restart recovery. |
| Add a QR status endpoint under workspace notifications routes | Frontend needs to fetch QR and poll login status without starting service manually. |
| Keep WeChat adapter platform-only and reuse `isBuiltInCommand/buildCommandResponse/runBotAgent` | Aligns notification workflow doc. |
