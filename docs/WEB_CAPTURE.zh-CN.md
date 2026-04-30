# 网页采集

网页采集是最低摩擦的输入入口。用户只给 Personal OS 一个原始东西：通常是一个
URL，有时是一段短文字。Personal OS 负责记录，后面的识别和整理由 Agent 做。

## 产品边界

用户只是想先把入口甩进来，然后继续做别的事，就用 `/capture`。

Agent 已经在工作，并且要马上把输入拆成 Wiki 笔记、任务、想法、项目进展或通知，
就用 `/api/intake`。

```text
浏览器 / 链接 / 分享入口 -> /capture -> InboxItem(status=new)
聊天 / Agent 窗口      -> /api/intake -> InboxItem + AgentRun + Wiki/Task/Idea 输出
```

采集入口不能要求用户填写元数据。标题、平台识别、正文提取、摘要、Wiki 笔记、任务、
标签、概念和提醒文案，都是 Agent 的工作。

## 浏览器流程

打开：

```text
http://localhost:3000/capture
```

粘贴或拖入一个值：

```text
https://example.com/article
```

保存后生成一条 `InboxItem`：

```json
{
  "sourceType": "link",
  "sourcePlatform": "web",
  "sourceUrl": "https://example.com/article",
  "rawText": "https://example.com/article",
  "status": "new",
  "createdBy": "user"
}
```

如果用户粘贴的是没有 URL 的纯文字，则保存为 `sourceType: "text"`，同样等待 Agent
后续整理。

## 书签脚本

`/capture` 页面提供书签脚本，可以从当前浏览器页面打开单输入框采集表单：

```text
javascript:(()=>{const b="http://localhost:3000/capture";const q=new URLSearchParams({content:location.href});open(b+"?"+q.toString(),"_blank","noopener,noreferrer");})();
```

正式部署时，把 `http://localhost:3000` 换成私有 Personal OS 地址。不要把写 token
放进书签脚本或浏览器 URL。

## Agent 后处理

采集处理频率是 Agent 策略，不是应用硬规则。

后处理 worker 可以：

- 识别平台，例如博客、X、小红书、抖音、YouTube、GitHub 或普通网站；
- 在平台允许时抓取标题、元数据、转写、正文或可读文章内容；
- 总结材料；
- 判断它应该进入 Personal Wiki、Personal OS 任务、想法、项目进展、通知，还是只保留
  原始输入；
- 只有真正开始处理和写入时，才调用 `POST /api/intake`。

关键规则是：被动采集不应该悄悄消耗 LLM token。实时处理、批量处理、每天处理或纯手动，
都只是操作者策略。

## 浏览器插件模式

浏览器插件优先打开 `/capture?content=<url>`。如果必须后台写入，可以用
`PERSONAL_OS_API_TOKEN` 调 `POST /api/inbox/items`，但 token 必须只存在私有插件存储里，
不能出现在页面 JavaScript、URL、截图、日志或公开文档中。
