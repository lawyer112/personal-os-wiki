#!/usr/bin/env python3
"""真实 Python Wiki 服务的浏览器回归；只使用临时数据目录。"""
from __future__ import annotations
import json
import os
import sys
import tempfile
import threading
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlencode
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'api'))
import server as wiki
import workspace_server as knowledge
import site_server as site
from demo_data import seed


def main():
    output=Path(os.environ.get('WIKI_UI_OUTPUT_DIR',str(ROOT.parent/'artifacts/wiki'))).resolve();output.mkdir(parents=True,exist_ok=True)
    cases=[];errors=[]
    with tempfile.TemporaryDirectory(prefix='wiki-ui-isolated-') as directory:
        root=Path(directory)
        settings={'DATA_DIR':root,'VAULT_DIR':root/'vault','SOURCES_DIR':root/'vault/10_sources','NOTES_DIR':root/'vault/20_notes','ARCHIVE_DIR':root/'vault/90_archive','PUBLIC_DIR':root/'public','NOTE_INDEX_PATH':root/'public/note-index.json','SOURCE_INDEX_PATH':root/'public/source-index.json','GRAPH_PATH':root/'public/graph-data.json','READ_TOKEN':'wiki-ui-read-fixture','API_TOKEN':'wiki-ui-write-fixture','REQUIRE_PAGE_READ_AUTH':True,'REQUIRE_API_READ_AUTH':True,'TRUST_LOCALHOST_READ_AUTH':False,'ALLOW_UNAUTHENTICATED_WRITE':False}
        patches=[patch.object(wiki,k,v) for k,v in settings.items()]
        for p in patches:p.start()
        knowledge._CACHE.clear();notes,original=seed(knowledge)
        httpd=wiki.ThreadingHTTPServer(('127.0.0.1',0),site.Handler);thread=threading.Thread(target=httpd.serve_forever,daemon=True);thread.start();base=f'http://127.0.0.1:{httpd.server_port}'
        def passed(name):cases.append({'name':name,'passed':True});print('通过：'+name)
        try:
            with sync_playwright() as driver:
                options={'headless':True,'args':['--no-sandbox']}
                if os.environ.get('CHROMIUM_PATH'):options['executable_path']=os.environ['CHROMIUM_PATH']
                browser=driver.chromium.launch(**options)
                context=browser.new_context(viewport={'width':1600,'height':1050},device_scale_factor=1,locale='zh-CN',reduced_motion='no-preference')
                context.add_cookies([{'name':'personal_wiki_read','value':'wiki-ui-read-fixture','url':base}])
                page=context.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
                routes=[('/', '01-home'),('/notes','02-notes'),('/graph','03-graph'),('/tags','04-tags'),('/concepts','05-concepts'),('/note?'+urlencode({'path':notes[0]['path']}),'06-reader'),('/edit?'+urlencode({'path':notes[0]['path']}),'07-editor'),('/manual','08-manual'),('/auth/read','09-login')]
                for route,name in routes:
                    response=page.goto(base+route);assert response.status==200,(route,response.status)
                    page.wait_for_timeout(600)
                    assert page.locator('html').get_attribute('lang')=='zh-CN'
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),route
                    page.screenshot(path=str(output/(name+'.png')),full_page=True)
                    passed(name+' 页面正常、中文且无横向溢出')
                page.goto(base+'/');page.wait_for_timeout(650)
                before=page.locator('.art-lines').evaluate('n=>getComputedStyle(n).transform');page.wait_for_timeout(160)
                after=page.locator('.art-lines').evaluate('n=>getComputedStyle(n).transform');assert before!=after
                page.locator('[data-motion-switch]').click();page.wait_for_timeout(80)
                before=page.locator('.art-lines').evaluate('n=>getComputedStyle(n).transform');page.wait_for_timeout(150);assert before==page.locator('.art-lines').evaluate('n=>getComputedStyle(n).transform')
                passed('首页动效实际播放，并能暂停')
                page.locator('[data-motion-switch]').click();page.emulate_media(reduced_motion='reduce');assert page.locator('[data-motion-switch]').is_disabled();passed('系统减少动效优先');page.emulate_media(reduced_motion='no-preference')
                page.locator('[data-theme-switch]').click();assert page.locator('html').get_attribute('data-theme')=='paper';page.reload();page.wait_for_timeout(600);assert page.locator('html').get_attribute('data-theme')=='paper';page.screenshot(path=str(output/'10-paper-home.png'),full_page=True);passed('纸白主题与偏好保存');page.locator('[data-theme-switch]').click()
                page.keyboard.press('Control+k');assert page.locator('.global-search input').evaluate('n=>document.activeElement===n');passed('快捷键聚焦搜索')
                page.goto(base+'/notes');page.locator('.filters input[name=q]').fill('知识库备份');page.locator('.filters button').click();page.wait_for_load_state();assert page.locator('.note-card').count()==1;passed('真实正文与标题检索')
                page.goto(base+'/notes');page.locator('[data-view=list]').click();assert 'is-list' in page.locator('#note-collection').get_attribute('class');page.reload();assert 'is-list' in page.locator('#note-collection').get_attribute('class');passed('列表切换与偏好保存')
                page.locator('[data-view=cards]').click()
                page.goto(base+'/tags');page.locator('.facet-tile').first.click();assert page.locator('.note-card').count()>0;passed('标签索引进入真实筛选结果')
                page.goto(base+'/graph');assert page.locator('.graph-node').count()==len(wiki.load_graph()['nodes']);assert page.locator('.graph-edge').count()==len(wiki.load_graph()['links'])
                page.locator('.graph-node').first.click();assert page.locator('#graph-open').is_visible();assert page.locator('#graph-relations button').count()>0
                before=page.locator('#knowledge-graph>g').get_attribute('transform');page.locator('[data-zoom="1.2"]').click();assert before!=page.locator('#knowledge-graph>g').get_attribute('transform');passed('图谱使用真实索引，节点关联与缩放有效')
                page.locator('#graph-search').fill('不存在的知识000');page.wait_for_timeout(240);assert page.locator('.graph-node').count()==0;passed('图谱搜索无命中时不伪造节点')
                page.goto(base+'/note?'+urlencode({'path':notes[0]['path'],'revision':original['revision']}));assert page.locator('.notice').first.inner_text().find('历史快照')>=0;assert page.locator('.markdown').inner_text().find('补充版本引用和交付证据的说明')<0;passed('历史正文与当前版本准确区分')
                page.goto(base+'/edit');page.locator('[name=title]').fill('浏览器真实写入验证');page.locator('#editor-content').fill('## 验证\n\n通过真实写入接口保存。');page.locator('[name=writeToken]').fill('wiki-ui-read-fixture');page.locator('button[type=submit]').last.click();page.wait_for_function("document.querySelector('#save-status').textContent.includes('读取凭证不能')");assert page.locator('#editor-content').input_value().find('真实写入')>=0;passed('只读凭证拒绝写入且保留编辑内容')
                page.locator('[name=writeToken]').fill('wiki-ui-write-fixture');page.locator('button[type=submit]').last.click();page.wait_for_function("document.querySelector('#save-status').textContent.includes('已保存')");assert any(n['title']=='浏览器真实写入验证' for n in wiki.list_notes());assert page.locator('[name=writeToken]').input_value()=='';passed('独立编辑页真实保存且清空写入凭证')
                page.goto(base+'/edit?'+urlencode({'path':notes[1]['path']}));page.locator('#editor-content').fill('用户尚未提交的修改');knowledge.write_managed_note({'path':notes[1]['path'],'expectedRevision':notes[1]['revision'],'title':notes[1]['title'],'content':'另一执行者已修改'})
                page.locator('[name=writeToken]').fill('wiki-ui-write-fixture');page.locator('button[type=submit]').last.click();page.wait_for_function("document.querySelector('#save-status').textContent.includes('页面已被更新')");assert page.locator('#editor-content').input_value()=='用户尚未提交的修改';passed('并发编辑冲突提示且不丢失正文')
                page.on('dialog',lambda dialog:dialog.accept());page.goto(base+'/')
                page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(400)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');page.screenshot(path=str(output/'11-mobile-home.png'),full_page=True)
                page.locator('[data-menu]').click();page.wait_for_function("document.querySelector('#sidebar').getBoundingClientRect().left>=-1");assert page.locator('#sidebar').evaluate('n=>!n.inert');page.keyboard.press('Escape');page.wait_for_timeout(330);assert page.locator('[data-menu]').evaluate('n=>document.activeElement===n');passed('手机导航可操作、焦点返回且页面无溢出')
                page.goto(base+'/graph');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1');page.screenshot(path=str(output/'12-mobile-graph.png'),full_page=True);passed('手机图谱与关联详情可见')
                context.clear_cookies();page.goto(base+'/notes');assert '/auth/read?' in page.url;page.locator('[name=token]').fill('incorrect');page.locator('button[type=submit]').click();assert page.locator('[role=alert]').inner_text().find('读取凭证不正确')>=0;page.locator('[name=token]').fill('wiki-ui-read-fixture');page.locator('button[type=submit]').click();assert page.url.endswith('/notes');passed('登录拦截、中文错误与原页面返回')
                assert not errors,errors;passed('全部页面没有浏览器运行异常')
                browser.close()
        finally:
            httpd.shutdown();httpd.server_close();thread.join()
            for p in reversed(patches):p.stop()
            (output/'wiki-ui-report.json').write_text(json.dumps({'scope':'独立 Python Wiki 服务、隔离临时知识库、虚构资料','cases':cases,'browser_errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__':main()
