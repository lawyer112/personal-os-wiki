stopping personal-wiki for fallback simulation
 Container personal-os-wiki-main-personal-wiki-1 Stopping 
 Container personal-os-wiki-main-personal-wiki-1 Stopped 
{
  "stamp": "20260623T095455Z",
  "intake_status": 201,
  "ok": true,
  "agentRunId": "cmqqgx8kr000d0jo5oinikuhf",
  "wiki_write_status": {
    "status": "failed",
    "requested": 1,
    "succeeded": 0,
    "failed": 1,
    "errors": [
      {
        "title": "生产回归 Wiki failure fallback 20260623T095455Z",
        "error": "fetch failed"
      }
    ]
  },
  "created_task_id": "cmqqgx8wi000g0jo5ru0m8x29",
  "created_task_wiki_links": []
}
restarting personal-wiki
time="2026-06-23T09:54:57Z" level=warning msg="volume \"personal-os-wiki-main_personal_wiki_data\" already exists but was not created by Docker Compose. Use `external: true` to use an existing volume"
 Container personal-os-wiki-main-personal-wiki-1 Starting 
 Container personal-os-wiki-main-personal-wiki-1 Started 
NAME                                    IMAGE                                 COMMAND                  SERVICE         CREATED        STATUS                  PORTS
personal-os-wiki-main-personal-wiki-1   personal-os-wiki-main-personal-wiki   "python /app/api/ser…"   personal-wiki   18 hours ago   Up Less than a second   0.0.0.0:3422->3422/tcp
