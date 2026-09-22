"""在真实构建上检查中文 UI，接口使用明确的虚构数据，不连接生产服务。"""
from __future__ import annotations
import asyncio
import json
import os
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from playwright.async_api import async_playwright

OUTPUT = Path(os.environ.get("UI_OUTPUT_DIR", "/mnt/data/os-ui-review"))
BASE = os.environ.get("UI_BASE_URL", "http://127.0.0.1:3180")
NOW = "2026-09-22T03:00:00.000Z"
PROJECTS = [
    {"id": "demo-project-1", "name": "知识工作台升级", "goal": "让知识有出处，让任务有负责人，让成果可以验收。", "currentFocus": "完善知识手册与任务协作闭环", "status": "active", "priority": "P1", "_count": {"tasks": 12}},
    {"id": "demo-project-2", "name": "自动化实验室", "goal": "验证多执行者协作与安全停止机制。", "currentFocus": "完成独立凭证与批次校验", "status": "active", "priority": "P2", "_count": {"tasks": 8}},
    {"id": "demo-project-3", "name": "内部运维手册", "goal": "将反复操作沉淀为可验证的步骤。", "currentFocus": "梳理备份和恢复操作", "status": "waiting", "priority": "P2", "_count": {"tasks": 6}},
]
AGENTS = [
    {"id": "demo-docs", "displayName": "知识整理助手", "enabled": True, "tags": ["文档", "整理"], "allowedRiskLevel": "low", "canWriteTasks": True, "canWriteWiki": True, "capabilities": ["资料归类", "手册维护"]},
    {"id": "demo-builder", "displayName": "工程执行助手", "enabled": True, "tags": ["前端", "测试"], "allowedRiskLevel": "medium", "canWriteTasks": True, "capabilities": ["代码修改", "回归测试"]},
    {"id": "demo-reviewer", "displayName": "独立复核助手", "enabled": True, "tags": ["复核"], "allowedRiskLevel": "low", "canWriteTasks": True, "capabilities": ["证据核对"]},
]
TITLES = ["整理知识手册目录与归属", "验证任务认领与批次隔离", "补齐备份恢复验收清单", "复核本轮界面调整成果", "确认资料归档边界", "等待测试环境访问权限", "完成中文导航与页面联动"]
STATUSES = ["todo", "doing", "blocked", "review", "review", "waiting", "done"]
TASKS = []
for index, title in enumerate(TITLES):
    TASKS.append({"id": f"demo-task-{index + 1}", "title": title, "status": STATUSES[index], "priority": "P1" if index < 4 else "P2", "riskLevel": "low", "executionMode": "agent_allowed", "agentTags": ["文档"], "description": "本条任务为界面测试使用的虚构数据。将操作要求、知识引用与验证证据整理在同一处。", "nextAction": ["按知识空间、手册和章节整理现有资料。", "检查两个执行者同时领取时的服务端裁决。", "需要管理员确认恢复测试所用的隔离环境。", "核对桌面与窄屏页面，以及提交的测试记录。", "确认哪些资料可以归档，哪些必须保留来源。", "获得测试环境权限后继续验证。", "已完成导航和详情的站内联动。"][index], "definitionOfDone": "提交变更清单；相关测试通过；保留可核验的结果。", "ownerAgent": None if index in (0, 4) else AGENTS[index % 3]["id"], "leaseUntil": "2099-09-22T05:00:00.000Z" if index == 1 else None, "lastHeartbeatAt": NOW if index == 1 else None, "submittedAt": NOW if index == 3 else None, "updatedAt": NOW, "dueDate": "2026-09-24T12:00:00.000Z", "project": PROJECTS[index % 3]})
COUNTS = [{"status": status, "_count": {"_all": sum(item["status"] == status for item in TASKS)}} for status in set(STATUSES)]
REVISION = "a" * 64
NOTE_PATH = "vault/20_notes/manuals/demo-guide.md"
NOTE = {"id": "demo-manual", "path": NOTE_PATH, "title": "任务执行与独立验收手册", "content": "## 适用范围\n\n本手册用于内部任务协作。工作应有明确的输入、负责人和交付标准。\n\n## 执行流程\n\n1. 读取任务要求与固定版本的知识。\n2. 认领任务，记录执行批次。\n3. 执行过程中维持心跳并提交进展。\n4. 提交产物与证据，等待独立验收。\n\n> 心跳正常不代表工作已有进展。提交成果不代表验收通过。\n\n## 验收清单\n\n| 检查项 | 验收依据 |\n| --- | --- |\n| 要求明确 | 任务目标与完成标准 |\n| 过程可追踪 | 执行批次与操作记录 |\n| 成果可核验 | 交付物与测试证据 |\n\n## 异常处理\n\n权限失效或知识版本缺失时停止执行，不要绕过限制。", "revision": REVISION, "currentRevision": REVISION, "historical": False, "frontmatter": {"space": "知识工作台", "book": "协作操作手册", "chapter": "任务执行", "owner": "资料维护人", "status": "published", "confidence": "verified", "sensitivity": "internal", "updated": NOW, "tags": ["任务协作", "验收"]}, "history": [{"revision": REVISION, "savedAt": NOW}]}
SUMMARIES = [{"id": f"demo-note-{i}", "path": NOTE_PATH if i == 0 else f"vault/20_notes/manuals/demo-{i}.md", "title": title, "excerpt": "记录可执行的步骤、前置条件和验收依据，保留明确的来源。", "revision": REVISION, "space": "知识工作台", "book": "协作操作手册", "chapter": "任务执行" if i < 2 else "系统运维", "status": "published" if i < 2 else "draft", "updated": NOW, "tags": ["内部资料"]} for i, title in enumerate([NOTE["title"], "知识整理与发布规范", "备份恢复操作指南", "执行者接入与权限说明"])]

async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    errors = []
    results = []
    writable = True
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True, executable_path=os.environ.get("CHROMIUM_EXECUTABLE") or None, args=["--no-sandbox"])
        context = await browser.new_context(viewport={"width": 1600, "height": 1100}, locale="zh-CN", device_scale_factor=1)
        await context.add_cookies([{"name": "personal_os_read", "value": os.environ.get("UI_ACCESS_TOKEN", "demo-management-token-for-ui-review"), "url": BASE, "httpOnly": True, "sameSite": "Lax"}])
        page = await context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        async def mock(route):
            nonlocal writable
            request = route.request
            parsed = urlparse(request.url)
            query = {key: values[0] for key, values in parse_qs(parsed.query).items()}
            view = query.get("view", "tasks")
            data = {"ok": True, "writable": writable, "asOf": NOW}
            if parsed.path == "/api/agent/context":
                data.update({"context": {"wiki": {"status": "empty", "candidates": [], "failedQueries": []}, "searchQueries": [], "relatedIdeas": []}})
            elif parsed.path.endswith("knowledge"):
                if query.get("path"):
                    data.update({"note": NOTE, "tasks": TASKS[:3]})
                else:
                    notes = [note for note in SUMMARIES if query.get("q", "") in note["title"]]
                    data.update({"notes": notes, "page": 1, "pageSize": 30, "total": len(notes), "tree": [{"space": "知识工作台", "book": "协作操作手册", "chapter": name, "count": 2} for name in ["任务执行", "系统运维"]]})
            elif request.method == "POST":
                data.update({"task": TASKS[0]})
            elif view == "overview":
                data.update({"counts": COUNTS, "submitted": 1, "tasks": TASKS[:6], "projects": 2, "expired": 0, "activity": [{"id": str(i), "action": action, "targetType": "task", "targetId": TASKS[i]["id"], "createdAt": NOW} for i, action in enumerate(["task.submitted", "task.claimed", "task.reviewed", "task.created"])]})
            elif view == "tasks":
                tasks = TASKS
                if query.get("q"): tasks = [task for task in tasks if query["q"] in task["title"]]
                stage = query.get("stage")
                if stage and stage != "all": tasks = [task for task in tasks if ("submitted" if task["submittedAt"] else "intake" if task["status"] == "review" else task["status"]) == stage]
                data.update({"tasks": tasks, "agents": AGENTS, "projects": PROJECTS, "page": 1, "pageSize": 30, "total": len(tasks)})
            elif view == "task":
                task = next(item for item in TASKS if item["id"] == query.get("id"))
                detailed = {**task, "runs": [{"id": "demo-run", "agentId": "demo-builder", "status": "submitted" if task["submittedAt"] else "running", "startedAt": NOW}], "wikiLinks": [{"id": "demo-reference", "noteTitle": NOTE["title"], "notePath": NOTE_PATH, "noteUrl": f"{BASE}/wiki?path={NOTE_PATH}&revision={REVISION}"}], "claims": [], "reviews": [], "agentActionLogs": [], "contributions": [{"id": "demo-contribution", "taskRunId": "demo-run", "agentId": "demo-builder", "summary": "已补齐界面联动，并记录回归检查结果。", "evidenceLinks": ["https://example.invalid/demo-test-report"], "artifactUrls": [], "createdAt": NOW}], "artifacts": [{"id": "demo-artifact", "title": "界面回归检查报告", "url": "https://example.invalid/demo-report", "verification": "unverified"}]}
                data.update({"task": detailed, "agents": AGENTS, "historyLimit": 30})
            elif view == "agents":
                data.update({"agents": AGENTS, "tasks": TASKS, "runs": [{"id": "demo-run", "agentId": "demo-builder", "taskId": TASKS[1]["id"], "status": "running", "startedAt": NOW}], "taskLimit": 200})
            elif view == "projects":
                data.update({"projects": PROJECTS, "counts": [{"projectId": project["id"], "status": "done", "_count": {"_all": 4}} for project in PROJECTS] + [{"projectId": project["id"], "status": "todo", "_count": {"_all": 5}} for project in PROJECTS]})
            elif view == "system":
                data.update({"database": True, "wiki": {"ok": True, "notes": 4}, "configured": {key: True for key in ["read", "write", "wikiRead", "wikiWrite", "agentCredentials"]}})
            await route.fulfill(status=200, content_type="application/json", body=json.dumps(data, ensure_ascii=False))
        await page.route("**/api/workspace**", mock)
        await page.route("**/api/agent/context?**", mock)
        for path, title, name in [("/", "工作总览", "01-overview"), ("/tasks", "任务中心", "02-tasks"), ("/projects", "项目进度", "03-projects"), ("/agents", "智能体中心", "04-agents"), ("/wiki", "知识手册", "05-knowledge"), ("/reviews", "交付与复核", "06-review"), ("/settings", "系统管理", "07-settings")]:
            await page.goto(BASE + path)
            await page.get_by_role("heading", name=title, exact=True).wait_for()
            await page.wait_for_timeout(350)
            assert await page.locator("html").get_attribute("lang") == "zh-CN"
            assert await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), f"页面横向溢出：{path}"
            await page.screenshot(path=str(OUTPUT / f"{name}.png"), full_page=True)
            results.append({"case": f"桌面页面 {title}", "passed": True})
        await page.goto(BASE + "/tasks")
        await page.locator(".os-card").filter(has_text=TITLES[0]).click()
        await page.locator(".os-inspector h2").filter(has_text=TITLES[0]).wait_for()
        await page.get_by_role("tab", name="参考知识").click()
        await page.get_by_role("link", name=NOTE["title"]).first.wait_for()
        assert "revision=" in (await page.get_by_role("link", name=NOTE["title"]).first.get_attribute("href"))
        await page.screenshot(path=str(OUTPUT / "08-task-detail.png"), full_page=True)
        results.append({"case": "任务详情联动及固定知识版本", "passed": True})
        await page.goto(BASE + "/wiki")
        await page.locator(".os-note-entry").first.click()
        await page.locator(".os-manual-article h1").first.wait_for()
        await page.screenshot(path=str(OUTPUT / "09-manual-reader.png"), full_page=True)
        await page.get_by_role("button", name="编辑页面", exact=True).click()
        await page.get_by_role("textbox", name="页面标题").wait_for()
        results.append({"case": "站内阅读与中文编辑表单", "passed": True})
        await page.goto(BASE + "/reviews")
        await page.get_by_role("button", name=TITLES[3], exact=True).click()
        await page.get_by_role("button", name="验收通过", exact=True).wait_for()
        assert await page.get_by_role("button", name="验收通过", exact=True).is_disabled()
        await page.get_by_role("checkbox").last.check()
        assert await page.get_by_role("button", name="验收通过", exact=True).is_enabled()
        results.append({"case": "验收必须先确认检查证据", "passed": True})
        writable = False
        await page.goto(BASE + "/tasks")
        await page.get_by_role("heading", name="任务中心", exact=True).wait_for()
        await page.wait_for_timeout(200)
        assert await page.get_by_role("button", name="新建任务").is_disabled()
        results.append({"case": "只读访问禁用写入操作", "passed": True})
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.goto(BASE + "/")
        await page.get_by_role("heading", name="工作总览", exact=True).wait_for()
        await page.wait_for_timeout(200)
        assert await page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
        await page.screenshot(path=str(OUTPUT / "10-mobile.png"), full_page=True)
        await page.get_by_role("button", name="展开导航", exact=True).click()
        await page.wait_for_timeout(250)
        assert await page.locator(".os-sidebar").evaluate("node => node.getBoundingClientRect().left >= 0")
        results.append({"case": "窄屏布局与导航抽屉", "passed": True})
        await page.goto(BASE + "/auth/read")
        await page.get_by_role("heading", name="进入知行工作台", exact=True).wait_for()
        await page.screenshot(path=str(OUTPUT / "11-login.png"), full_page=True)
        results.append({"case": "中文登录页", "passed": True})
        if errors: raise AssertionError("浏览器运行错误：" + "\n".join(errors))
        await browser.close()
    report = {"data": "虚构接口数据，真实生产构建，不代表生产数据库联调", "cases": results, "browser_errors": errors}
    (OUTPUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == "__main__": asyncio.run(main())
