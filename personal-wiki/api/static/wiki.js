/* 原生交互，不加载外部资源；图谱使用服务端实际索引。 */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const read = (key, fallback) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* 禁用存储时只影响偏好持久化。 */ } };
  root.dataset.theme = read('personal-wiki.theme', 'ink') === 'paper' ? 'paper' : 'ink';
  let paused = read('personal-wiki.motion', 'on') === 'off';
  root.dataset.motion = paused || reduced.matches ? 'off' : 'on';
  document.addEventListener('DOMContentLoaded', () => {
    const $ = (selector) => document.querySelector(selector);
    let timer;
    const toast = message => { const box = $('#toast'); if (!box) return; box.textContent = message; box.classList.add('show'); clearTimeout(timer); timer = setTimeout(() => box.classList.remove('show'), 3500); };
    const motionButton = $('[data-motion-switch]');
    const updateMotion = () => {
      const off = paused || reduced.matches || document.hidden;
      root.dataset.motion = off ? 'off' : 'on';
      if (motionButton) { motionButton.setAttribute('aria-pressed', String(!off)); motionButton.disabled = reduced.matches; motionButton.querySelector('span').textContent = reduced.matches ? '系统已减少动效' : paused ? '开启动效' : '暂停动效'; motionButton.title = reduced.matches ? '请在系统设置中更改减少动态效果偏好' : '暂停或恢复装饰动效'; }
    };
    $('[data-theme-switch]')?.addEventListener('click', () => { root.dataset.theme = root.dataset.theme === 'ink' ? 'paper' : 'ink'; write('personal-wiki.theme', root.dataset.theme); toast(root.dataset.theme === 'ink' ? '已切换墨色主题' : '已切换纸白主题'); });
    motionButton?.addEventListener('click', () => { paused = !paused; write('personal-wiki.motion', paused ? 'off' : 'on'); updateMotion(); });
    reduced.addEventListener('change', updateMotion); document.addEventListener('visibilitychange', updateMotion); updateMotion();
    if ('IntersectionObserver' in window) { const observer = new IntersectionObserver(entries => entries.forEach(entry => entry.target.classList.toggle('art-paused', !entry.isIntersecting))); document.querySelectorAll('.atlas-art').forEach(node => observer.observe(node)); }
    const sidebar = $('#sidebar'), menu = $('[data-menu]'), scrim = $('[data-close-menu]');
    const isSmall = window.matchMedia('(max-width:760px)');
    const closeMenu = () => { sidebar?.classList.remove('open'); if (scrim) scrim.hidden = true; menu?.setAttribute('aria-expanded', 'false'); if (sidebar) sidebar.inert = isSmall.matches; };
    const setMenu = () => { const open = !sidebar.classList.contains('open'); if (!open) { closeMenu(); return; } sidebar.inert = false; sidebar.classList.add('open'); scrim.hidden = false; menu.setAttribute('aria-expanded', 'true'); sidebar.querySelector('a')?.focus(); };
    menu?.addEventListener('click', setMenu); scrim?.addEventListener('click', () => { closeMenu(); menu?.focus(); });
    isSmall.addEventListener('change', closeMenu); closeMenu();
    document.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { const search = $('.global-search input'); if (search) { event.preventDefault(); search.focus(); } }
      if (event.key === 'Escape' && sidebar?.classList.contains('open')) { closeMenu(); menu?.focus(); }
      if (event.key === 'Tab' && sidebar?.classList.contains('open')) { const items = [...sidebar.querySelectorAll('a,button')].filter(n => !n.disabled); if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); } else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); } }
    });
    const copy = async value => { try { await navigator.clipboard.writeText(value); toast('已复制'); } catch { toast('浏览器未授权剪贴板，请从地址栏或正文手动复制。'); } };
    document.querySelectorAll('[data-copy-code]').forEach(button => button.addEventListener('click', () => copy(button.closest('.code-block').querySelector('code').textContent)));
    $('[data-copy-link]')?.addEventListener('click', () => { const note = JSON.parse($('#note-meta').textContent); const target = new URL('/note', location.origin); target.searchParams.set('path', note.path); target.searchParams.set('revision', note.revision); copy(target.href); });
    const collection = $('#note-collection');
    const updateView = mode => { collection?.classList.toggle('is-list', mode === 'list'); document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === mode))); };
    updateView(read('personal-wiki.collection', 'cards'));
    document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { updateView(button.dataset.view); write('personal-wiki.collection', button.dataset.view); }));
    if ('IntersectionObserver' in window && $('.reader-toc')) { const observer = new IntersectionObserver(entries => { const visible = entries.find(entry => entry.isIntersecting); if (!visible) return; document.querySelectorAll('.reader-toc a[href^="#"]').forEach(link => link.classList.toggle('current', link.getAttribute('href') === '#' + visible.target.id)); }, { rootMargin: '-8% 0px -68% 0px' }); document.querySelectorAll('.markdown h1[id],.markdown h2[id],.markdown h3[id]').forEach(h => observer.observe(h)); }
    setupEditor(); setupGraph();

    function setupEditor() {
      const form = $('#note-editor'); if (!form) return;
      const meta = JSON.parse($('#editor-data').textContent), content = $('#editor-content'), status = $('#save-status'), save = form.querySelector('[type=submit]');
      let dirty = false, saving = false;
      const count = () => { $('#character-count').textContent = `${content.value.length.toLocaleString('zh-CN')} 字符`; };
      count(); form.addEventListener('input', event => { if (event.target.name !== 'writeToken') dirty = true; count(); });
      window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
      document.querySelectorAll('[data-insert]').forEach(button => button.addEventListener('click', () => { const snippets = { heading: '\n## 新章节\n\n', link: '[[概念名称]]', list: '\n1. 第一步\n2. 第二步\n' }; content.setRangeText(snippets[button.dataset.insert], content.selectionStart, content.selectionEnd, 'end'); dirty = true; count(); content.focus(); }));
      form.addEventListener('submit', async event => {
        event.preventDefault(); if (saving || !form.reportValidity()) return;
        const fields = new FormData(form); const title = String(fields.get('title') || '').trim(), body = String(fields.get('content') || '').trim();
        if (!title || !body) { status.textContent = '请填写标题和正文。'; return; }
        saving = true; save.disabled = true; status.textContent = '正在检查版本并保存…';
        const metadata = {}; for (const key of ['space','book','chapter','owner','status','confidence','sensitivity','valid_until','source_url']) metadata[key] = String(fields.get(key) || '').trim();
        const payload = { title, content: body, metadata, tags: String(fields.get('tags') || '').split(/[,，]/).map(t => t.trim()).filter(Boolean), ...(meta.path ? { path: meta.path, expectedRevision: meta.revision } : { requestId: meta.requestId }) };
        try {
          const response = await fetch('/api/workspace/note', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization: 'Bearer ' + String(fields.get('writeToken') || '').trim() }, body:JSON.stringify(payload), signal:AbortSignal.timeout(20000) });
          const result = await response.json();
          if (!response.ok || !result.ok) { const messages = {401:'写入凭证不正确。读取凭证不能用于保存。',403:'当前身份无权保存。',409:'页面已被更新。你的编辑仍保留在此处，请先复制正文，再重新读取并合并。'}; throw new Error(messages[response.status] || (/\p{Script=Han}/u.test(result.error || '') ? result.error : '保存失败，请检查知识服务。')); }
          dirty = false; meta.path = result.note.path; meta.revision = result.note.revision;
          status.replaceChildren(document.createTextNode(result.indexed ? '已保存，历史版本已保留。' : '正文已保存，但索引未刷新。请联系维护人，不要重复创建。'));
          const link = document.createElement('a'); link.className = 'text-link more'; link.textContent = '打开已保存的笔记 ↗'; link.href = '/note?' + new URLSearchParams({path:meta.path}); status.append(document.createElement('br'), link);
          const hidden = $('#editor-data'); if (hidden) hidden.textContent = JSON.stringify(meta);
          history.replaceState(null, '', '/edit?' + new URLSearchParams({path:meta.path}));
          toast('保存成功');
        } catch (error) { status.textContent = error.name === 'TimeoutError' || error.name === 'AbortError' ? '请求超时，保存结果暂时未知。请先查询笔记库，编辑内容仍保留，避免重复创建。' : error.message || '网络异常，请检查服务连接。'; }
        finally { form.elements.writeToken.value = ''; saving = false; save.disabled = false; }
      });
    }

    function setupGraph() {
      const data = $('#graph-data'), svg = $('#knowledge-graph'); if (!data || !svg) return;
      const model = JSON.parse(data.textContent), namespace = 'http://www.w3.org/2000/svg';
      const nodes = new Map(model.nodes.map(n => [n.id,n]));
      const degrees = new Map(); const adjacent = new Map();
      for (const edge of model.links) { for (const id of [edge.source,edge.target]) { degrees.set(id,(degrees.get(id)||0)+1); if (!adjacent.has(id)) adjacent.set(id,[]); adjacent.get(id).push(edge); } }
      let selected = model.focus || '', scale = 1, dx = 0, dy = 0, visible = [], visibleEdges = [], groups = new Map(), viewport, edges, points, lastPointer;
      const el = (tag, attrs) => { const item = document.createElementNS(namespace,tag); for (const [key,value] of Object.entries(attrs || {})) item.setAttribute(key,String(value)); return item; };
      const allowedEdge = edge => edge.kind !== 'related' || Number(edge.score || 0) >= Number($('#graph-strength').value);
      const state = () => { viewport?.setAttribute('transform',`translate(${dx} ${dy}) translate(550 340) scale(${scale}) translate(-550 -340)`); };
      const choose = id => {
        selected = id; const node = nodes.get(id); if (!node) return;
        const relatedEdges = (adjacent.get(id) || []).filter(allowedEdge); const ids = new Set([id]); relatedEdges.forEach(edge => { ids.add(edge.source); ids.add(edge.target); });
        groups.forEach((group,key) => { group.classList.toggle('selected',key===id); group.classList.toggle('dim',!ids.has(key)); group.setAttribute('aria-pressed',String(key===id)); });
        [...edges.children].forEach((line,index) => { const edge = visibleEdges[index]; const hot = edge.source === id || edge.target === id; line.classList.toggle('highlight',hot); line.classList.toggle('dim',!hot); });
        $('#graph-title').textContent = node.label;
        $('#graph-description').textContent = `${({note:'知识笔记',concept:'概念引用',tag:'分类标签'})[node.kind]} · 当前强度条件下有 ${relatedEdges.length} 条关联。`;
        const open = $('#graph-open'); const value = node.kind === 'tag' ? node.label.replace(/^#/,'') : node.label;
        open.href = node.kind === 'note' ? '/note?' + new URLSearchParams({path:node.path || node.id}) : '/notes?' + new URLSearchParams({[node.kind === 'tag' ? 'tag' : 'concept']:value}); open.hidden=false;
        const target = $('#graph-relations'); target.replaceChildren();
        for (const edge of relatedEdges.slice(0,30)) { const other = nodes.get(edge.source===id ? edge.target : edge.source); if (!other) continue; const button=document.createElement('button'); button.type='button'; button.className='graph-relation'; button.textContent=other.label; const sub=document.createElement('small'); sub.textContent=({wikilink:'显式引用',tag:'标签关联',related:'算法关联'})[edge.kind] || '知识关联'; if (edge.kind==='related') sub.textContent+=` · ${Number(edge.score||0).toFixed(2)}`; button.append(sub); button.addEventListener('click',()=>{ selected=other.id; $('#graph-search').value=''; draw(); choose(other.id); }); target.append(button); }
      };
      function draw() {
        const query=$('#graph-search').value.trim().toLocaleLowerCase(), kind=$('#graph-kind').value;
        let candidates=model.nodes.filter(n=>kind==='all'||n.kind==='note'||n.kind===kind);
        if(query) { const matches=new Set(candidates.filter(n=>n.label.toLocaleLowerCase().includes(query)).map(n=>n.id)); const neighborhood=new Set(matches); for(const id of matches) for(const edge of adjacent.get(id)||[]) if(allowedEdge(edge)){neighborhood.add(edge.source);neighborhood.add(edge.target);} candidates=candidates.filter(n=>neighborhood.has(n.id)); candidates.sort((a,b)=>Number(matches.has(b.id))-Number(matches.has(a.id))||(degrees.get(b.id)||0)-(degrees.get(a.id)||0)); }
        else { const focusIds = new Set([selected]); for (const edge of adjacent.get(selected)||[]) {focusIds.add(edge.source);focusIds.add(edge.target);} candidates.sort((a,b)=>Number(focusIds.has(b.id))-Number(focusIds.has(a.id))||(degrees.get(b.id)||0)-(degrees.get(a.id)||0)||a.label.localeCompare(b.label,'zh')); }
        visible=candidates.slice(0,180); const visibleIds=new Set(visible.map(n=>n.id)); visibleEdges=model.links.filter(edge=>visibleIds.has(edge.source)&&visibleIds.has(edge.target)&&allowedEdge(edge));
        points=new Map(); const centerNode=visible.find(n=>n.id===selected) || visible.find(n=>n.kind==='note') || visible[0];
        const rest=visible.filter(n=>n!==centerNode); if(centerNode) points.set(centerNode.id,{x:550,y:340});
        // 稳定布局一次完成。没有后台持续运行的力模拟，也不把节点抖动当作数据更新。
        const rings=[rest.filter(n=>n.kind==='note'),rest.filter(n=>n.kind==='concept'),rest.filter(n=>n.kind==='tag')];
        rings.forEach((ring,ri)=>ring.forEach((node,i)=>{const angle=i/Math.max(1,ring.length)*Math.PI*2+ri*.43;const band=ring.length>28?i%2*20:0;const rx=[215,365,450][ri]-band, ry=[160,240,283][ri]-band;points.set(node.id,{x:550+Math.cos(angle)*rx,y:340+Math.sin(angle)*ry});}));
        svg.replaceChildren(); viewport=el('g');edges=el('g',{'aria-hidden':'true'});const nodeLayer=el('g');viewport.append(edges,nodeLayer);svg.append(viewport);groups=new Map();
        visibleEdges.forEach(edge=>{const a=points.get(edge.source),b=points.get(edge.target);edges.append(el('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'graph-edge'}));});
        visible.forEach((node,i)=>{const point=points.get(node.id);const group=el('g',{class:'graph-node','data-kind':node.kind,'data-id':node.id,transform:`translate(${point.x} ${point.y})`,tabindex:'0',role:'button','aria-label':`选择${node.label}`,'aria-pressed':'false'});const radius=node===centerNode?15:Math.min(11,5+Math.sqrt(degrees.get(node.id)||1));group.append(el('circle',{r:radius}));const title=el('title');title.textContent=node.label;group.append(title);if(visible.length<85||i<28||node===centerNode){const text=el('text',{y:radius+21});text.textContent=node.label.length>14?node.label.slice(0,13)+'…':node.label;group.append(text);}group.addEventListener('click',()=>choose(node.id));group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose(node.id);}});nodeLayer.append(group);groups.set(node.id,group);});
        $('#graph-status').textContent=visible.length?`显示 ${visible.length} / ${model.nodes.length} 个节点 · ${visibleEdges.length} 条连线${candidates.length>180?' · 已限制数量，请搜索缩小范围':''}`:'没有匹配节点，请调整关键词或筛选。';
        state(); if(selected&&visibleIds.has(selected)) choose(selected);else {$('#graph-title').textContent='选择一颗知识节点';$('#graph-open').hidden=true;$('#graph-relations').replaceChildren();}
      }
      let searchTimer; $('#graph-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(draw,160);}); $('#graph-kind').addEventListener('change',draw); $('#graph-strength').addEventListener('change',draw);
      document.querySelectorAll('[data-zoom]').forEach(button=>button.addEventListener('click',()=>{scale=Math.min(2.6,Math.max(.45,scale*Number(button.dataset.zoom)));state();}));
      $('#graph-reset').addEventListener('click',()=>{selected='';scale=1;dx=dy=0;$('#graph-search').value='';$('#graph-kind').value='all';$('#graph-strength').value='0';draw();});
      svg.addEventListener('pointerdown',event=>{if(event.target.closest('.graph-node'))return;lastPointer={id:event.pointerId,x:event.clientX,y:event.clientY};svg.setPointerCapture(event.pointerId);});
      svg.addEventListener('pointermove',event=>{if(!lastPointer||event.pointerId!==lastPointer.id)return;const rect=svg.getBoundingClientRect();const ratio=Math.max(1100/rect.width,680/rect.height);dx+=(event.clientX-lastPointer.x)*ratio;dy+=(event.clientY-lastPointer.y)*ratio;lastPointer.x=event.clientX;lastPointer.y=event.clientY;state();});
      const release=()=>{lastPointer=undefined;};svg.addEventListener('pointerup',release);svg.addEventListener('pointercancel',release);svg.addEventListener('lostpointercapture',release);
      draw();
    }
  });
})();
