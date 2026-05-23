# 文件源 Tab 功能说明

## 概述

Docking Tab 现在支持新增文件源类型，用统一文件树界面浏览和管理不同来源的文件。

支持的文件源：

- SFTP
- FTP
- Storage：本地文件系统
- WebDAV

## 使用方式

在右上角 Tab 菜单中选择对应入口：

- New SFTP Tab
- New FTP Tab
- New Storage Tab
- New WebDAV Tab

创建时填写连接名称、根路径，以及对应协议需要的连接信息。

## 文件树操作

文件源 Tab 使用 `animated_tree_view` 渲染统一文件树。

右上角按钮支持：

- 创建文件
- 创建文件夹
- 刷新

长按文件或文件夹会弹出操作菜单：

- Rename：改名
- Copy：复制
- Move：移动
- Download：下载到本地路径
- Delete：删除
- Info：查看路径、类型、大小、修改时间

## 实现结构

核心抽象位于：

- `lib/services/file_sources/file_source.dart`

具体实现位于：

- `lib/services/file_sources/sftp_file_source.dart`
- `lib/services/file_sources/ftp_file_source.dart`
- `lib/services/file_sources/storage_file_source.dart`
- `lib/services/file_sources/webdav_file_source.dart`

统一文件树界面位于：

- `lib/widgets/file_source_tree.dart`

## 已知限制

- FTP 使用的 `ftpconnect` 没有直接复制 API，当前 FTP Copy 返回不支持。
- SFTP Copy 当前支持文件流式复制，目录递归复制尚未实现。
- 下载操作会要求输入目标本地文件路径。
