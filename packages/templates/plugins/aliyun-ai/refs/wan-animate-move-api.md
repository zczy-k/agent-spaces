万相-图生动作模型，可基于人物图片和参考视频，生成人物动作视频。

-   **功能简述：**将视频角色的动作/表情迁移到图片角色中，赋予图片角色动态表现力。
    
-   **适用场景：**复刻舞蹈、复刻高难度肢体动作、复刻影视剧表演表情及肢体动作细节，低成本动捕替代。
    

## **模型效果**

万相-图生动作模型wan2.2-animate-move提供标准模式`wan-std`和专业模式`wan-pro`两种服务模式，不同模式在效果和计费上存在差异，请参见[模型调用计费](https://help.aliyun.com/zh/model-studio/model-pricing#1f708fcd62rdc)。

| **人物图片** | **参考视频** | **输出视频（标准模式**`**wan-std**`**）** | **输出视频（专业模式**`**wan-pro**`**）** |
| --- | --- | --- | --- |
| ![move_input_image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9815528571/p1008736.jpeg) |     |     |     |

## **前提条件**

您需要已[获取API Key](https://help.aliyun.com/zh/model-studio/get-api-key)并[配置API Key到环境变量](https://help.aliyun.com/zh/model-studio/configure-api-key-through-environment-variables)。

**重要**

北京和新加坡地域拥有独立的 **API Key** 与**请求地址**，不可混用，跨地域调用将导致鉴权失败或服务报错。

## HTTP调用

由于视频生成任务耗时较长，API采用异步调用。整个流程包含 “创建任务 -> 轮询获取” 两个核心步骤，具体如下：

### 步骤1：创建任务获取任务ID

**北京地域**：`POST https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis`

**新加坡地域**：`POST https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis`

**说明**

-   创建成功后，使用接口返回的 `task_id` 查询结果，task\_id 有效期为 24 小时。**请勿重复创建任务**，轮询获取即可。
    
-   新手指引请参见[Postman](https://help.aliyun.com/zh/model-studio/first-call-to-image-and-video-api)。
    

| #### 请求参数 | ## 图生动作 以下为北京地域 base\\_url，若使用新加坡地域的模型，需将 base\\_url 替换为：`https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis` ``` curl --location 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis' \\ --header 'X-DashScope-Async: enable' \\ --header "Authorization: Bearer $DASHSCOPE_API_KEY" \\ --header 'Content-Type: application/json' \\ --data '{ "model": "wan2.2-animate-move", "input": { "image_url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250919/adsyrp/move_input_image.jpeg", "video_url": "https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250919/kaakcn/move_input_video.mp4", "watermark": true }, "parameters": { "mode": "wan-std" } }' ``` |
| --- | --- |
| ##### 请求头（Headers） |
| **Content-Type** `*string*` **（必选）** 请求内容类型。此参数必须设置为`application/json`。 |
| **Authorization** `*string*`**（必选）** 请求身份认证。接口使用阿里云百炼API-Key进行身份认证。示例值：Bearer sk-xxxx。 |
| **X-DashScope-Async** `*string*` **（必选）** 异步处理配置参数。HTTP请求只支持异步，**必须设置为**`**enable**`。 **重要** 缺少此请求头将报错：“current user api does not support synchronous calls”。 |
| ##### 请求体（Request Body） |
| **model** `*string*` **（必选）** 模型名称，必须设置为`wan2.2-animate-move`。 |
| **input** `*object*` **（必选）** 输入参数对象，包含以下字段： **属性** **image\\_url** `*string*` **（必选）** 输入图像的公网可访问的HTTP/HTTPS链接，不能包含中文等非ASCII字符，否则需要进行编码后再传入。 本地文件可通过[上传文件获取临时URL](https://help.aliyun.com/zh/model-studio/get-temporary-file-url)。 - **格式**：JPG、JPEG、PNG、BMP、WEBP。 - **尺寸**：图像的宽度和高度**都**在`[200,4096]`像素范围内，宽高比在1:3至3:1范围内。 - **文件大小**：不超过5MB。 - **内容**：画面中仅有一人，正对镜头，人脸完整无遮挡，且在画面中的占比适中，避免过大或过小。 - **示例值**：`https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250919/adsyrp/move_input_image.jpeg` **video\\_url** `*string*` **（必选）** 输入视频的公网可访问的HTTP/HTTPS链接，不能包含中文等非ASCII字符，否则需要进行编码后再传入。 本地文件可通过[上传文件获取临时URL](https://help.aliyun.com/zh/model-studio/get-temporary-file-url)。 **建议：**提高参考视频的分辨率和帧率，可有效提升生成视频的画质效果。 - **格式**：MP4、AVI、MOV。 - **时长**：2～30s。 - **尺寸**：视频的宽度和高度**都**在`[200, 2048]`像素范围内，宽高比在1:3至3:1范围内。 - **文件大小**：不超过200MB。 - **内容**：画面中仅有一人，正对镜头，人脸完整无遮挡，且在画面中的占比适中，避免过大或过小。 - **示例值**：`https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20250919/kaakcn/move_input_video.mp4` **watermark** `*bool*` （可选） 是否添加水印标识，水印位于图片右下角，文案为“千问AI生成”。 - `false`（默认值）：不添加水印。 - `true`：添加水印。 |
| **parameters** `*object*` **（必选）** **属性** **check\\_image** `*bool*` （可选） 是否进行图像检测。 - `true`：**默认值**，接口将对传入的图片进行检测。 - `false`：跳过图片检测环节，直接对图片进行后续处理。 **mode** `*string*` **（必选）** 模型服务模式选择，支持两种模式。 - `wan-std`：标准模式，生成速度较快，性价比高，适用于快速预览和基础动画场景。 - `wan-pro`：专业模式，动画流畅度更高，效果更佳，但处理时间和费用也相应增加。 详情请参见[模型效果](#55a79354d2s4j)和[计费与限流](#ce68f54f7bbqe)。 |

| #### 响应参数 | ### 成功响应 请保存 task\\_id，用于查询任务状态与结果。 ``` { "output": { "task_status": "PENDING", "task_id": "0385dc79-5ff8-4d82-bcb6-xxxxxx" }, "request_id": "4909100c-7b5a-9f92-bfe5-xxxxxx" } ``` ### 异常响应 创建任务失败，请参见[错误信息](https://help.aliyun.com/zh/model-studio/error-code)进行解决。 ``` { "code": "InvalidApiKey", "message": "No API-key provided.", "request_id": "7438d53d-6eb8-4596-8835-xxxxxx" } ``` |
| --- | --- |
| **output** `*object*` 任务输出信息。 **属性** **task\\_id** `*string*` 任务ID。查询有效期24小时。 **task\\_status** `*string*` 任务状态。 **枚举值** - PENDING：任务排队中 - RUNNING：任务处理中 - SUCCEEDED：任务执行成功 - FAILED：任务执行失败 - CANCELED：任务已取消 - UNKNOWN：任务不存在或状态未知 |
| **request\\_id** `*string*` 请求唯一标识。可用于请求明细溯源和问题排查。 |
| **message** `*string*` 请求失败的详细信息。请求成功时不会返回此参数，详情请参见[错误信息](https://help.aliyun.com/zh/model-studio/error-code)。 |     |
| **code** `*string*` 请求失败的错误码。请求成功时不会返回此参数，详情请参见[错误信息](https://help.aliyun.com/zh/model-studio/error-code)。 |     |

### 步骤2：根据任务ID查询结果

**北京地域**：`GET https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}`

**新加坡地域**：`GET https://dashscope-intl.aliyuncs.com/api/v1/tasks/{task_id}`

**说明**

-   **轮询建议**：视频生成过程约需数分钟，建议采用**轮询**机制，并设置合理的查询间隔（如 15 秒）来获取结果。
    
-   **任务状态流转**：PENDING（排队中）→ RUNNING（处理中）→ SUCCEEDED（成功）/ FAILED（失败）。
    
-   **结果链接**：任务成功后返回视频链接，有效期为 **24 小时**。建议在获取链接后立即下载并转存至永久存储（如[阿里云 OSS](https://help.aliyun.com/zh/oss/user-guide/what-is-oss)）。
    
-   **task\_id 有效期**：**24小时**，超时后将无法查询结果，接口将返回任务状态为`UNKNOWN`。
    
-   **RPS 限制**：查询接口默认RPS为20。如需更高频查询或事件通知，建议[配置异步任务回调](https://help.aliyun.com/zh/model-studio/async-task-api)。
    
-   **更多操作**：如需批量查询、取消任务等操作，请参见[管理异步任务](https://help.aliyun.com/zh/model-studio/manage-asynchronous-tasks#f26499d72adsl)。
    

| #### 请求参数 | ## 查询任务结果 您需要将`0385dc79-5ff8-4d82-bcb6-xxxxxx`替换为真实的task\\_id。 > 以下为北京地域 base\\_url，若使用新加坡地域的模型，需将 base\\_url 替换为：`https://dashscope-intl.aliyuncs.com/api/v1/tasks/0385dc79-5ff8-4d82-bcb6-xxxxxx` ``` curl -X GET https://dashscope.aliyuncs.com/api/v1/tasks/0385dc79-5ff8-4d82-bcb6-xxxxxx \\ --header "Authorization: Bearer $DASHSCOPE_API_KEY" ``` |
| --- | --- |
| ##### **请求头（Headers）** |
| **Authorization** `*string*`**（必选）** 请求身份认证。接口使用阿里云百炼API-Key进行身份认证。示例值：Bearer sk-xxxx。 |
| ##### **URL路径参数（Path parameters）** |
| **task\\_id** `*string*`**（必选）** 任务ID。 |

| #### **响应参数** | ## 任务执行成功 视频URL仅保留24小时，超时后会被自动清除，请及时保存生成的视频。 ``` { "request_id": "a67f8716-18ef-447c-a286-xxxxxx", "output": { "task_id": "0385dc79-5ff8-4d82-bcb6-xxxxxx", "task_status": "SUCCEEDED", "submit_time": "2025-09-18 15:32:00.105", "scheduled_time": "2025-09-18 15:32:15.066", "end_time": "2025-09-18 15:34:41.898", "results": { "video_url": "http://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/xxxxx.mp4?Expires=xxxxxx" } }, "usage": { "video_duration": 5.2, "video_ratio": "standard" } } ``` ## 任务执行失败 若任务执行失败，task\\_status将置为 FAILED，并提供错误码和信息。请参见[错误信息](https://help.aliyun.com/zh/model-studio/error-code)进行解决。 ``` { "request_id": "daad9007-6acd-9fb3-a6bc-xxxxxx", "output": { "task_id": "fe8aa114-d9f1-4f76-b598-xxxxxx", "task_status": "FAILED", "code": "InternalError", "message": "xxxxxx" } } ``` |
| --- | --- |
| **output** `*object*` 任务输出信息。 **属性** **task\\_id** `*string*` 任务ID。查询有效期24小时。 **task\\_status** `*string*` 任务状态。 **枚举值** - PENDING：任务排队中 - RUNNING：任务处理中 - SUCCEEDED：任务执行成功 - FAILED：任务执行失败 - CANCELED：任务已取消 - UNKNOWN：任务不存在或状态未知 **submit\\_time** `*string*` 任务提交时间。格式为 YYYY-MM-DD HH:mm:ss.SSS。 **scheduled\\_time** `*string*` 任务执行时间。格式为 YYYY-MM-DD HH:mm:ss.SSS。 **end\\_time** `*string*` 任务完成时间。格式为 YYYY-MM-DD HH:mm:ss.SSS。 **results** `*object*` **属性** **video\\_url** `*string*` 视频URL。仅在 task\\_status 为 SUCCEEDED 时返回。 链接有效期24小时，可通过此URL下载视频。视频格式为MP4（H.264 编码）。 **code** `*string*` 请求失败的错误码。请求成功时不会返回此参数，详情请参见[错误信息](https://help.aliyun.com/zh/model-studio/error-code)。 **message** `*string*` 请求失败的详细信息。请求成功时不会返回此参数，详情请参见[错误信息](https://help.aliyun.com/zh/model-studio/error-code)。 |
| **usage** `*object*` 输出信息统计。只对成功的结果计数。 **属性** **video\\_duration** `*float*` 本次请求生成视频时长计量，单位：秒。 **video\\_ratio** `*string*` 本次请求视频服务模式选择，**枚举值：** `standard`，`pro`。 若选择标准模式`wan-std`为`standard`，选择专业模式`wan-pro`则为`pro`。 |
| **request\\_id** `*string*` 请求唯一标识。可用于请求明细溯源和问题排查。 |

## **使用限制**

**数据时效**：任务task\_id和视频URL均只保留 24 小时，过期后将无法查询或下载，请及时[下载视频到本地](#866ccf3fa3y1p)。

**内容审核**：输入与输出内容均会经过内容安全审核，包含违规内容的请求将报错“IPInfringementSuspect”或“DataInspectionFailed”，具体参见[错误信息](https://help.aliyun.com/zh/model-studio/error-code)。

## **计费与限流**

-   模型免费额度和计费单价请参见[万相-图生动作](https://help.aliyun.com/zh/model-studio/model-pricing#1f708fcd62rdc)。
    
-   模型限流请参见[万相系列](https://help.aliyun.com/zh/model-studio/rate-limit#a729d7b6bar7y)。
    
-   计费说明：
    
    -   输入不计费，输出计费。按成功生成的 视频秒数 计费。
        
    -   模型调用失败或处理错误不产生任何费用，也不消耗[新人免费额度](https://help.aliyun.com/zh/model-studio/new-free-quota)。
        

## **错误码**

如果模型调用失败并返回报错信息，请参见[错误信息](https://help.aliyun.com/zh/model-studio/error-code)进行解决。

## **常见问题**

#### **Q: 如何优化生成视频的效果?**

A: 可参考以下建议

1.  确保输入图片与参考视频中的人物画幅占比相似。
    
2.  尽量保持图片和视频中人物的身材比例一致。
    
3.  使用高清素材，避免使用模糊图片和低帧率视频，确保细节识别准确。
    

#### **Q: 如何将临时的视频链接转为永久链接？**

A: 不能直接转换该链接。正确的做法是：后端服务获取到url后，通过代码下载该视频文件，然后将其上传到永久对象存储服务（如阿里云 OSS），生成一个新的、永久访问链接。

**示例代码：下载视频到本地**

```
import requests

def download_and_save_video(video_url, save_path):
    try:
        response = requests.get(video_url, stream=True, timeout=300) # 设置超时
        response.raise_for_status() # 如果HTTP状态码不是200，则引发异常
        with open(save_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"视频已成功下载到: {save_path}")
        # 此处可以接上传到永久存储的逻辑
    except requests.exceptions.RequestException as e:
        print(f"下载视频失败: {e}")

if __name__ == '__main__':
    video_url = "http://dashscope-result-sh.oss-cn-shanghai.aliyuncs.com/xxxx"
    save_path = "video.mp4"
    download_and_save_video(video_url, save_path)
```

#### **Q: 返回的视频链接可以在浏览器中直接播放吗？**

A: 不建议这样做，因为链接会在 24 小时后失效。最佳实践是后端下载转存后，使用永久链接进行视频播放。

#### **Q：如何获取视频存储的访问域名白名单？**

A： 模型生成的视频存储于阿里云OSS，API将返回一个临时的公网URL。**若需要对该下载地址进行防火墙白名单配置**，请注意：由于底层存储会根据业务情况进行动态变更，为避免过期信息影响访问，文档不提供固定的OSS域名白名单。如有安全管控需求，请联系客户经理获取最新OSS域名列表。

/\* 调整 table 宽度 \*/ .aliyun-docs-content table.medium-width { max-width: 1018px; width: 100%; } .aliyun-docs-content table.table-no-border tr td:first-child { padding-left: 0; } .aliyun-docs-content table.table-no-border tr td:last-child { padding-right: 0; } /\* 支持吸顶 \*/ div:has(.aliyun-docs-content), .aliyun-docs-content .markdown-body { overflow: visible; } .stick-top { position: sticky; top: 46px; } /\*\*代码块字体\*\*/ /\* 减少表格中的代码块 margin，让表格信息显示更紧凑 \*/ .unionContainer .markdown-body table .help-code-block { margin: 0 !important; } /\* 减少表格中的代码块字号，让表格信息显示更紧凑 \*/ .unionContainer .markdown-body .help-code-block pre { font-size: 12px !important; } /\* 减少表格中的代码块字号，让表格信息显示更紧凑 \*/ .unionContainer .markdown-body .help-code-block pre code { font-size: 12px !important; } /\*\* API Reference 表格 \*\*/ .aliyun-docs-content table.api-reference tr td:first-child { margin: 0px; border-bottom: 1px solid #d8d8d8; } .aliyun-docs-content table.api-reference tr:last-child td:first-child { border-bottom: none; } .aliyun-docs-content table.api-reference p { color: #6e6e80; } .aliyun-docs-content table.api-reference b, i { color: #181818; } .aliyun-docs-content table.api-reference .collapse { border: none; margin-top: 4px; margin-bottom: 4px; } .aliyun-docs-content table.api-reference .collapse .expandable-title-bold { padding: 0; } .aliyun-docs-content table.api-reference .collapse .expandable-title { padding: 0; } .aliyun-docs-content table.api-reference .collapse .expandable-title-bold .title { margin-left: 16px; } .aliyun-docs-content table.api-reference .collapse .expandable-title .title { margin-left: 16px; } .aliyun-docs-content table.api-reference .collapse .expandable-title-bold i.icon { position: absolute; color: #777; font-weight: 100; } .aliyun-docs-content table.api-reference .collapse .expandable-title i.icon { position: absolute; color: #777; font-weight: 100; } .aliyun-docs-content table.api-reference .collapse.expanded .expandable-content { padding: 10px 14px 10px 14px !important; margin: 0; border: 1px solid #e9e9e9; } .aliyun-docs-content table.api-reference .collapse .expandable-title-bold b { font-size: 13px; font-weight: normal; color: #6e6e80; } .aliyun-docs-content table.api-reference .collapse .expandable-title b { font-size: 13px; font-weight: normal; color: #6e6e80; } .aliyun-docs-content table.api-reference .tabbed-content-box { border: none; } .aliyun-docs-content table.api-reference .tabbed-content-box section { padding: 8px 0 !important; } .aliyun-docs-content table.api-reference .tabbed-content-box.mini .tab-box { /\* position: absolute; left: 40px; right: 0; \*/ } .aliyun-docs-content .margin-top-33 { margin-top: 33px !important; } .aliyun-docs-content .two-codeblocks pre { max-height: calc(50vh - 136px) !important; height: auto; } .expandable-content section { border-bottom: 1px solid #e9e9e9; padding-top: 6px; padding-bottom: 4px; } .expandable-content section:last-child { border-bottom: none; } .expandable-content section:first-child { padding-top: 0; }

 span.aliyun-docs-icon { color: transparent !important; font-size: 0 !important; } span.aliyun-docs-icon:before { color: black; font-size: 16px; } span.aliyun-docs-icon.icon-size-20:before { font-size: 20px; } span.aliyun-docs-icon.icon-size-22:before { font-size: 22px; } span.aliyun-docs-icon.icon-size-24:before { font-size: 24px; } span.aliyun-docs-icon.icon-size-26:before { font-size: 26px; } span.aliyun-docs-icon.icon-size-28:before { font-size: 28px; }