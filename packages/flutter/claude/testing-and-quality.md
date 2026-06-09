[根目录](../../../CLAUDE.md) > [packages](../../) > [flutter](../) > **claude/testing-and-quality.md**

# 测试与质量

## 测试现状

测试覆盖极少。仅有 2 个测试文件：

| 文件 | 类型 | 说明 |
|------|------|------|
| `test/widget_test.dart` | Widget 测试 | 冒烟测试：验证 App 可构建（`AgentSpacesApp` 能成功 pumpWidget，无异常） |
| `test/services/file_sources/webdav_url_test.dart` | 单元测试 | 测试 `normalizeWebDavBaseUrl` 函数：自动添加 http 前缀、保留显式 scheme、trim 空白 |

## 测试环境配置

`widget_test.dart` 中的测试环境：

- 使用 `SharedPreferences.setMockInitialValues({})` mock 持久化
- 使用 `InMemorySharedPreferencesAsync.empty()` mock 异步持久化
- 使用 `EasyLocalization` 包裹测试 Widget

## 验证命令

```bash
flutter test              # 运行测试
flutter analyze           # 静态分析
flutter build <platform>  # 构建指定平台
```

## 质量工具

- **Lint**：`flutter_lints` 规则集（analysis_options.yaml）
- **静态分析**：`flutter analyze`
- 目前无集成 CI/CD 配置

## 测试缺口

- 所有 Provider/StateNotifier 缺少单元测试
- 所有 Screen 缺少 Widget 测试
- 所有 Service 缺少单元测试（特别是 StorageService 的序列化/反序列化）
- FileSource 实现类（SFTP/FTP/Storage/WebDAV）缺少集成测试
- JsBridge 缺少测试
- 终端相关组件缺少测试
