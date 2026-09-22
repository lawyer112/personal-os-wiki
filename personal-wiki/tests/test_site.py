"""独立 Wiki 页面与原有知识接口的隔离回归，不访问真实资料。"""
from __future__ import annotations
import http.client
import json
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlencode

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'api'))
import server as wiki
import workspace_server as knowledge
import site_server as site

class WikiSiteTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); root = Path(self.temp.name)
        settings = {'DATA_DIR':root,'VAULT_DIR':root/'vault','SOURCES_DIR':root/'vault/10_sources','NOTES_DIR':root/'vault/20_notes','ARCHIVE_DIR':root/'vault/90_archive','PUBLIC_DIR':root/'public','NOTE_INDEX_PATH':root/'public/note-index.json','SOURCE_INDEX_PATH':root/'public/source-index.json','GRAPH_PATH':root/'public/graph-data.json','READ_TOKEN':'isolated-site-read','API_TOKEN':'isolated-site-write','REQUIRE_PAGE_READ_AUTH':True,'REQUIRE_API_READ_AUTH':True,'TRUST_LOCALHOST_READ_AUTH':False,'ALLOW_UNAUTHENTICATED_WRITE':False}
        self.patches = [patch.object(wiki,k,v) for k,v in settings.items()]
        for p in self.patches: p.start()
        knowledge._CACHE.clear()
        self.payload = {'requestId':'isolated-site-test-01','title':'隔离知识手册','content':'## 核心结论\n\n安全的中文知识。\n\n## 操作步骤\n\n1. 阅读要求\n2. 留存证据\n\n[[版本管理]]', 'tags':['测试'], 'metadata':{'book':'独立手册','space':'测试空间'}}
        self.note = knowledge.write_managed_note(self.payload)['note']
        self.server = wiki.ThreadingHTTPServer(('127.0.0.1',0),site.Handler)
        self.thread = threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join()
        for p in reversed(self.patches):p.stop()
        self.temp.cleanup()
    def request(self,path,method='GET',body=None,headers=None,authenticated=True):
        request_headers={'Cookie':'personal_wiki_read=isolated-site-read'} if authenticated else {}
        request_headers.update(headers or {})
        conn=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=5)
        conn.request(method,path,body,request_headers);resp=conn.getresponse();result=(resp.status,dict(resp.getheaders()),resp.read().decode('utf-8'));conn.close();return result
    def test_all_independent_pages_are_chinese_html(self):
        for route in ['/', '/notes','/graph','/tags','/concepts','/manual','/edit','/note?'+urlencode({'path':self.note['path']}),'/auth/read']:
            with self.subTest(route=route):
                status,headers,body=self.request(route)
                self.assertEqual(status,200);self.assertIn('text/html',headers['Content-Type']);self.assertIn('lang="zh-CN"',body);self.assertIn('/assets/wiki.css',body)
    def test_read_auth_is_required_for_every_knowledge_page(self):
        for route in ['/', '/notes','/graph','/tags','/concepts','/manual','/edit','/note?'+urlencode({'path':self.note['path']})]:
            status,headers,body=self.request(route,authenticated=False)
            self.assertEqual(status,302);self.assertTrue(headers['Location'].startswith('/auth/read?'));self.assertNotIn(self.note['title'],body)
    def test_graph_json_still_requires_read_token(self):
        self.assertEqual(self.request('/api/graph',authenticated=False)[0],401)
        self.assertEqual(self.request('/api/graph')[0],200)
    def test_login_failure_is_chinese_and_never_echoes_credentials(self):
        status,_,body=self.request('/auth/read','POST',urlencode({'token':'wrong-sensitive-value'}),{'Content-Type':'application/x-www-form-urlencoded'},False)
        self.assertEqual(status,401);self.assertIn('读取凭证不正确',body);self.assertNotIn('wrong-sensitive-value',body)
    def test_login_preserves_safe_destination(self):
        target='/notes?tag=test'
        status,headers,_=self.request('/auth/read','POST',urlencode({'token':'isolated-site-read','next':target}),{'Content-Type':'application/x-www-form-urlencoded'},False)
        self.assertEqual(status,303);self.assertEqual(headers['Location'],target);self.assertIn('HttpOnly',headers['Set-Cookie']);self.assertNotIn('isolated-site-read',headers['Location'])
    def test_login_rejects_open_redirect_variants(self):
        for target in ['//untrusted.invalid','/\\untrusted.invalid','/\nLocation:bad','javascript:bad','https://untrusted.invalid','/auth/read']:
            self.assertEqual(site.local_next(target),'/')
    def test_page_has_csp_no_store_and_no_secrets(self):
        _,headers,body=self.request('/')
        self.assertEqual(headers['Cache-Control'],'no-store');self.assertIn("frame-ancestors 'none'",headers['Content-Security-Policy'])
        for secret in ['isolated-site-read','isolated-site-write']:self.assertNotIn(secret,body)
    def test_static_assets_are_allowlisted(self):
        for route in ['/assets/wiki.css','/assets/wiki.js']:self.assertEqual(self.request(route,authenticated=False)[0],200)
        self.assertEqual(self.request('/assets/../site_server.py',authenticated=False)[0],404)
    def test_search_facets_and_empty_states(self):
        body=self.request('/notes?'+urlencode({'q':'安全的中文'}))[2];self.assertIn('隔离知识手册',body)
        self.assertIn('没有找到匹配内容',self.request('/notes?q=no-result-999')[2])
        self.assertIn('测试',self.request('/tags')[2]);self.assertIn('版本管理',self.request('/concepts')[2])
    def test_markdown_is_safe_and_supports_structure(self):
        source='## 标题\n\n<script>alert(1)</script>\n\n[x](javascript:alert)\n\n```html\n<img onerror=bad>\n```\n\n| 项目 | 结果 |\n| --- | --- |\n| 验证 | 通过 |\n\n- [x] 已完成'
        rendered,toc=site.markdown(source)
        self.assertNotIn('<script>',rendered);self.assertNotIn('href="javascript:',rendered);self.assertNotIn('<img ',rendered);self.assertIn('<table>',rendered);self.assertIn('<pre>',rendered);self.assertIn('section-1',toc)
    def test_script_serialization_does_not_allow_breakout(self):
        result=site.data_script('test',{'value':'</script><script>alert(1)</script>'})
        self.assertEqual(result.count('</script>'),1);self.assertNotIn('<script>alert',result)
    def test_backlinks_and_historical_version_reader(self):
        knowledge.write_managed_note({**self.payload,'requestId':'backlink-note-request-02','title':'关联笔记','content':'[[隔离知识手册]]'})
        body=self.request('/note?'+urlencode({'path':self.note['path']}))[2]
        self.assertIn('1 篇笔记引用此页',body);self.assertIn('关联笔记',body)
        knowledge.write_managed_note({**self.payload,'path':self.note['path'],'expectedRevision':self.note['revision'],'content':'新版本'})
        _,_,old=self.request('/note?'+urlencode({'path':self.note['path'],'revision':self.note['revision']}))
        self.assertIn('历史快照',old);self.assertIn('安全的中文知识',old)
        self.assertEqual(self.request('/note?'+urlencode({'path':self.note['path'],'revision':'0'*64}))[0],404)
    def test_reader_blocks_vault_escape(self):
        self.assertEqual(self.request('/note?'+urlencode({'path':'../../etc/passwd'}))[0],400)
        self.assertEqual(self.request('/note?'+urlencode({'path':'vault/10_sources/raw.md'}))[0],400)
    def test_read_cookie_cannot_save(self):
        status,_,_=self.request('/api/workspace/note','POST',json.dumps(self.payload),{'Content-Type':'application/json'})
        self.assertEqual(status,401)
    def test_write_api_keeps_version_conflict_protection(self):
        headers={'Authorization':'Bearer isolated-site-write','Content-Type':'application/json'}
        value={**self.payload,'path':self.note['path'],'expectedRevision':self.note['revision'],'content':'修改后的内容'}
        self.assertEqual(self.request('/api/workspace/note','POST',json.dumps(value),headers)[0],200)
        self.assertEqual(self.request('/api/workspace/note','POST',json.dumps(value),headers)[0],409)
    def test_manual_raw_markdown_and_existing_api_remain_available(self):
        self.assertIn('text/markdown',self.request('/docs/USAGE.md')[1]['Content-Type'])
        for route in ['/api/notes','/api/tags','/api/concepts','/api/graph','/api/health']:
            self.assertEqual(self.request(route)[0],200)
    def test_unknown_page_is_html_but_unknown_api_is_json(self):
        self.assertEqual(self.request('/missing')[0],404);self.assertIn('text/html',self.request('/missing')[1]['Content-Type'])
        self.assertEqual(self.request('/api/missing')[0],404);self.assertIn('application/json',self.request('/api/missing')[1]['Content-Type'])
    def test_unsafe_workbench_url_is_not_linked(self):
        for value in ['javascript:alert(1)','https://user:pass@example.invalid','https://example.invalid?token=secret']:
            with patch.dict('os.environ',{'WIKI_OS_URL':value}):self.assertEqual(site.os_url(),'')

if __name__=='__main__':unittest.main()
