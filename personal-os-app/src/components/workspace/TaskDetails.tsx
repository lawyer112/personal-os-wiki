"use client";
import { useState } from "react";
import { AgentContextPanel } from "@/components/AgentContextPanel";
import type { TaskView } from "@/lib/view-models";
import { claimReasons, displayTime, label, leaseState, taskStage } from "@/lib/workspace";
import type { AgentSummary, WorkTask } from "@/lib/workspace";
import { Badge, Empty, EvidenceLink, Field, Loading, Notice, requestJson, useAction, useLiveData } from "./shared";
export type DetailedTask = TaskView & WorkTask & { requiredOutput?: string | null };
type DetailResponse = { task: DetailedTask; agents: AgentSummary[]; writable: boolean; historyLimit: number };
export function TaskDetails({ id, onClose, onChanged, initialAgent = "" }: { id: string; onClose?: () => void; onChanged?: () => void; initialAgent?: string }) {
  const live = useLiveData<DetailResponse>(`/api/workspace?view=task&id=${encodeURIComponent(id)}`);
  const [tab, setTab] = useState("requirements");
  const [agentId, setAgentId] = useState(initialAgent);
  const action = useAction();
  const data = live.data?.task.id === id ? live.data : null;
  const task = data?.task;
  const changed = () => { live.reload(); onChanged?.(); };
  const command = (commandAction: string, extra: object = {}) => requestJson("/api/workspace/actions", { method: "POST", body: JSON.stringify({ action: commandAction, taskId: id, ...extra }) });
  return <aside className="os-inspector" aria-label="任务详情"><header className="os-inspector-heading"><strong>任务详情</strong><div><a className="os-link" href={`/tasks/${encodeURIComponent(id)}`}>独立打开 ↗</a>{onClose && <button aria-label="关闭任务详情" onClick={onClose}>×</button>}</div></header>{live.error && <Notice error>{live.error}</Notice>}{!task || !data ? <Loading /> : <>
    <div className="os-inspector-body"><div className="os-meta"><Badge value={taskStage(task)} /><Badge value={task.priority} /><Badge value={task.riskLevel} /></div><h2>{task.title}</h2><dl className="os-detail-facts"><div><dt>所属项目</dt><dd>{task.project?.name ?? "未归属项目"}</dd></div><div><dt>执行方式</dt><dd>{label(task.executionMode)}</dd></div><div><dt>当前执行者</dt><dd>{data.agents.find(a => a.id === task.ownerAgent)?.displayName ?? task.ownerAgent ?? "尚未认领"}</dd></div><div><dt>任务租约</dt><dd>{leaseState(task)}</dd></div><div><dt>最近心跳</dt><dd>{displayTime(task.lastHeartbeatAt)}</dd></div><div><dt>截止时间</dt><dd>{task.dueDate ? displayTime(task.dueDate) : "未设置期限"}</dd></div></dl>{!data.writable && <Notice>当前为只读访问。需要管理凭证才能调整任务或复核成果。</Notice>}</div>
    <div className="os-tabs" role="tablist" aria-label="任务内容">{[["requirements", "任务要求"], ["knowledge", "参考知识"], ["execution", "执行过程"], ["delivery", "交付成果"], ["review", "复核记录"]].map(([key, text]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{text}</button>)}</div>
    <div className="os-inspector-body" role="tabpanel">
      {tab === "requirements" && <><h3>目标与背景</h3><p>{task.description || "尚未补充背景。"}</p><h3>下一步</h3><p>{task.nextAction}</p><h3>验收标准</h3><p>{task.definitionOfDone}</p>{task.requiredOutput && <><h3>必须交付</h3><p>{task.requiredOutput}</p></>}
      {taskStage(task) === "intake" && <div className="os-actions"><button className="os-btn os-btn-primary" disabled={!data.writable || action.busy} onClick={() => void action.run(async () => { await command("confirm"); changed(); })}>确认需求，进入任务池</button></div>}
      {["todo", "doing"].includes(task.status) && <><h3>指定执行者认领</h3><Field title="执行者"><select value={agentId} onChange={event => setAgentId(event.target.value)}><option value="">选择已登记的执行者</option>{data.agents.map(agent => <option key={agent.id} value={agent.id}>{agent.displayName}{agent.enabled ? "" : "（已停用）"}</option>)}</select></Field>{claimReasons(task, data.agents.find(agent => agent.id === agentId)).map(reason => <p className="os-inline-note" key={reason}>· {reason}</p>)}<button className="os-btn os-btn-primary" disabled={!data.writable || action.busy || claimReasons(task, data.agents.find(a => a.id === agentId)).length > 0} onClick={() => void action.run(async () => { await command("claim", { agentId }); changed(); })}>认领此任务</button><p className="os-inline-note">此操作登记执行责任，不会在浏览器中启动模型。后台执行器需另行接入。</p></>}
      {data.writable && !["done", "archived"].includes(task.status) && taskStage(task) !== "submitted" && <details><summary className="os-link">人工调整阶段与下一步</summary><form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void action.run(async () => { await command("update", { payload: { status: String(form.get("status")), nextAction: String(form.get("nextAction")) } }); changed(); }); }}><Field title="目标阶段"><select name="status" defaultValue={task.status === "review" ? "todo" : task.status}><option value="todo">可执行</option><option value="doing">执行中</option><option value="waiting">等待中</option><option value="blocked">已阻塞</option></select></Field><Field title="下一步／阻塞原因"><textarea name="nextAction" required defaultValue={task.nextAction} /></Field><button className="os-btn" disabled={action.busy}>保存调整</button></form></details>}
      {taskStage(task) === "submitted" && <ReviewForm key={`${task.id}:${task.submittedAt}:${task.runs?.[0]?.id}`} task={task} writable={data.writable} onChanged={changed} />}</>}
      {tab === "knowledge" && <><h3>固定引用的知识</h3>{task.wikiLinks?.length ? task.wikiLinks.map(note => <EvidenceLink key={note.id} url={note.notePath ? `/wiki?path=${encodeURIComponent(note.notePath)}${pinnedRevision(note.noteUrl)}` : note.noteUrl ?? ""} title={note.noteTitle} />) : <Empty title="尚未绑定知识页面">在创建任务时，从手册加入执行依据。</Empty>}<AgentContextPanel taskId={id} /></>}
      {tab === "execution" && <><Notice>心跳只证明执行器仍在回应，不代表工作已经取得进展。下面显示最近 {data.historyLimit} 条相关记录。</Notice><h3>执行批次</h3>{task.runs?.length ? <ol className="os-timeline">{task.runs.map(run => <li key={run.id}><strong>{data.agents.find(a => a.id === run.agentId)?.displayName ?? run.agentId}</strong> <Badge value={run.status} /><time>{displayTime(run.startedAt)}</time>{run.resultSummary && <p>{run.resultSummary}</p>}<small className="os-code">批次：{run.id}</small></li>)}</ol> : <Empty title="还没有执行批次" />}<h3>操作记录</h3><ol className="os-timeline">{task.agentActionLogs?.map(log => <li key={log.id}><strong>{label(log.action, "执行操作")}</strong><p>{log.summary || "已记录操作。"}</p><time>{displayTime(log.createdAt)} · {log.agentId}</time></li>)}</ol></>}
      {tab === "delivery" && <><h3>交付物</h3>{task.artifacts?.length ? task.artifacts.map(artifact => <div key={artifact.id}><EvidenceLink url={artifact.url} title={artifact.title} /><Badge value={artifact.verification} /></div>) : <Empty title="尚未提交交付物">不能仅凭“已完成”的文字判断任务完成。</Empty>}<h3>进展与证据</h3><ol className="os-timeline">{task.contributions?.map(item => <li key={item.id}><strong>{item.agentId}</strong><p>{item.summary}</p>{item.evidenceLinks?.map(url => <EvidenceLink key={url} url={url} />)}{item.artifactUrls?.map(url => <EvidenceLink key={url} url={url} />)}{item.nextRecommendation && <p>建议下一步：{item.nextRecommendation}</p>}<time>{displayTime(item.createdAt)}</time></li>)}</ol></>}
      {tab === "review" && <>{taskStage(task) === "submitted" && <ReviewForm key={`${task.id}:${task.submittedAt}:${task.runs?.[0]?.id}`} task={task} writable={data.writable} onChanged={changed} />}<h3>历史复核</h3>{task.reviews?.length ? <ol className="os-timeline">{task.reviews.map(review => <li key={review.id}><Badge value={review.decision} /><p>{review.comment || "未补充意见"}</p><time>{label(review.reviewer, "复核者")} · {displayTime(review.createdAt)}</time></li>)}</ol> : <Empty title="尚无复核记录" />}</>}
      {action.message && <Notice error>{action.message}</Notice>}
    </div>
  </>}</aside>;
}
function ReviewForm({ task, writable, onChanged }: { task: DetailedTask; writable: boolean; onChanged: () => void }) {
  const [checked, setChecked] = useState(false);
  const [comment, setComment] = useState("");
  const action = useAction();
  const runId = task.runs?.[0]?.id ?? null;
  const evidence = task.contributions?.some(c => (!runId || c.taskRunId === runId) && ((c.evidenceLinks?.length ?? 0) + (c.artifactUrls?.length ?? 0) > 0));
  const review = (decision: string) => void action.run(async () => {
    if (decision !== "approve" && !comment.trim()) throw new Error("请先填写返工或阻塞原因。");
    await requestJson("/api/workspace/actions", { method: "POST", body: JSON.stringify({ action: "review", taskId: task.id, expectedSubmittedAt: task.submittedAt ? new Date(task.submittedAt).toISOString() : undefined, expectedRunId: runId, evidenceChecked: checked, payload: { decision, comment, reviewer: "user" } }) }); onChanged();
  });
  return <section><h3>验收本次提交</h3><Notice>先检查“交付成果”中的证据，再作出决定。通过只代表人工确认当前提交，不是系统自动运行了测试。</Notice><Field title="复核意见"><textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="记录检查结果；返工时说明需要修改什么" /></Field><label className="os-review-check"><input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} /><span>我已核对本次提交的验收标准和证据，确认可以通过。</span></label>{!evidence && <p className="os-inline-note">当前批次未找到证据链接，暂不能通过验收。</p>}{action.message && <Notice error>{action.message}</Notice>}<div className="os-actions"><button className="os-btn os-btn-primary" disabled={!writable || action.busy || !checked || !evidence} onClick={() => review("approve")}>验收通过</button><button className="os-btn" disabled={!writable || action.busy} onClick={() => review("request_changes")}>要求返工</button><button className="os-btn os-btn-danger" disabled={!writable || action.busy} onClick={() => review("block")}>标记阻塞</button></div></section>;
}

function pinnedRevision(url?: string | null) {
  try { const revision = new URL(url || "", "https://internal.invalid").searchParams.get("revision"); return revision && /^[a-f0-9]{64}$/.test(revision) ? `&revision=${revision}` : ""; } catch { return ""; }
}
