# 网页采集

网页采集是低成本入口，用来保存链接、选中文本和临时想法。它只把数据记录进
Personal OS，不会自己调用大模型、写 Wiki、建任务或发 Telegram。

## 产品边界

用户只是想先存下来，后面再让 Agent 判断，就用 `/capture`。

Agent 已经在工作，并且要马上把输入拆成 Wiki 笔记、任务、想法、项目进展或通知，
就用 `/api/intake`。

```text
浏览器页面 -> /capture -> InboxItem(status=new)
聊天/Agent 窗口 -> /api/intake -> InboxItem + AgentRun + Wiki/Task/Idea 输出
```

这样 token 成本由操作者控制。用户可以让 Agent 每几分钟、每几小时、每天一次，
或者只在明确要求时处理采集内容。Personal OS 本身只负责保留来源记录。

## 浏览器流程

打开：

```text
http://localhost:3000/capture
```

页面接受：

- URL
- 标题
- 选中文本
- 用户备注

保存后会生成一条 `InboxItem`：

```json
{
  "sourceType": "link",
  "sourcePlatform": "web",
  "status": "new",
  "createdBy": "user"
}
```

这条记录会留在输入箱里，直到用户或 Agent 处理它。

## 书签脚本

`/capture` 页面里提供了一个书签脚本，可以从当前浏览器页面打开预填好的采集表单：

```text
javascript:(()=>{const b="http://localhost:3000/capture";const q=new URLSearchParams({url:location.href,title:document.title,selection:String(getSelection())});open(b+"?"+q.toString(),"_blank","noopener,noreferrer");})();
```

正式部署时，把 `http://localhost:3000` 换成私有 Personal OS 地址。不要把写 token
放进书签脚本或浏览器 URL。

## Agent 处理策略

采集处理频率是 Agent 策略，不是应用硬规则。

合理默认值：

- 低成本个人配置：每天处理几次；
- 主动研究时段：用户正在工作时更频繁处理；
- 模型昂贵或上下文很大：先批量汇总，再处理；
- 手动模式：先留在输入箱，直到用户要求 Agent 处理。

关键规则是：被动采集不应该悄悄消耗 LLM token。Agent 应该先读取新的 Inbox 记录，
选择值得处理的内容，然后只在真正要分类和写入时调用 `POST /api/intake`。

## 浏览器插件模式

浏览器插件优先打开带查询参数的 `/capture`。如果必须后台写入，可以用
`PERSONAL_OS_API_TOKEN` 调 `POST /api/inbox/items`，但 token 必须只存在私有插件存储里，
不能出现在页面 JavaScript、URL、截图、日志或公开文档中。
