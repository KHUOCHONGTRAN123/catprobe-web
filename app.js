'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('board'), ctx = canvas.getContext('2d');
  const palette = ['#8A96A6','#E5797C','#E6B654','#78AF8E','#729FD7','#A38ACB','#DE9A6D','#6DB5BA','#C58DA9','#A0AA78'];
  const color = id => palette[Math.abs(id % palette.length)];
  let token = '', levelJson = '', plan = null, frame = 0, busy = false, job = null, playing = false, progress = 0, previousTime = 0, busyStart = 0, exiting = false;
  const inputs = ['choose','sample','file','moves','seconds'];
  function status(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
  function setBusy(value, cancellable = false) {
    busy = value; for (const id of inputs) $(id).disabled = value;
    $('analyze').disabled = value || !levelJson; $('cancel').hidden = !cancellable;
    $('save').disabled = value || !plan?.replayVerified; updateTransport();
  }
  function updateTransport() { for (const id of ['play','reset','prev','next','seek']) $(id).disabled = busy || !plan?.moves?.length; }
  async function api(path, body, method) {
    return window.catProbeApi(path, body, method);
  }

  function validate() {
    const n = Number($('moves').value), seconds = Number($('seconds').value);
    if (!$('moves').value || !Number.isInteger(n) || n < 0 || n > 200) throw Error('n phải là số nguyên từ 0 đến 200.');
    if (!$('seconds').value || !Number.isInteger(seconds) || seconds < 1 || seconds > 120) throw Error('Thời gian phải là số nguyên từ 1 đến 120 giây.');
    return {moveLimit:n,seconds};
  }
  async function loadText(text, name) {
    if (busy) return;
    pause(); plan = null; frame = 0; progress = 0; levelJson = ''; setBusy(true);
    $('cats').textContent = '—'; $('resultMoves').textContent = 'cat'; $('stats').textContent = 'Đang đọc level…'; $('filename').textContent = name;
    $('position').textContent = 'Nước 0 / 0'; $('eatenNow').textContent = 'Đã ăn 0 cat'; $('moveDetail').textContent = ''; $('boardSize').textContent = 'Chưa có level'; $('seek').value = 0; $('seek').max = 0;
    status('Đang kiểm tra trạng thái ban đầu…'); draw();
    try {
      const parsed = JSON.parse(text); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('Level phải là một đối tượng JSON.');
      plan = await api('/api/preview', {levelJson:text}); levelJson = text;
      $('boardSize').textContent = `${plan.width} × ${plan.height} ô`;
      $('cats').textContent = plan.catsEaten; $('resultMoves').textContent = 'cat ban đầu'; $('stats').textContent = 'Nhập n rồi bấm Phân tích.';
      status('Đã tải level. Sẵn sàng phân tích.'); seek(0);
    } catch (error) { status(error.message, true); $('stats').textContent = 'Chưa có kết quả.'; }
    finally { setBusy(false); }
  }
  async function loadFile(file) {
    if (!file || busy) return;
    if (!file.name.toLowerCase().endsWith('.json')) return status('Hãy chọn một file .json.', true);
    if (file.size > 20*1024*1024) return status('File vượt quá 20 MB.', true);
    try { await loadText(await file.text(), file.name); } catch (error) { status(error.message, true); }
  }
  $('choose').onclick = () => $('file').click();
  $('file').onchange = async () => { await loadFile($('file').files[0]); $('file').value = ''; };
  window.addEventListener('dragover', e => { e.preventDefault(); if (!busy) $('dropzone').classList.add('over'); });
  window.addEventListener('dragleave', e => { if (!e.relatedTarget) $('dropzone').classList.remove('over'); });
  window.addEventListener('drop', e => { e.preventDefault(); $('dropzone').classList.remove('over'); if (busy) return; if (e.dataTransfer.files.length !== 1) return status('Thả đúng một file level mỗi lần.', true); loadFile(e.dataTransfer.files[0]); });
  $('sample').onclick = async () => {
    if (busy) return;
    try { const response = await fetch('samples/Level00001.json'); if (!response.ok) throw Error('Không mở được level mẫu.'); await loadText(await response.text(), 'Level00001.json'); }
    catch (error) { status(error.message, true); }
  };
  $('analyze').onclick = async () => {
    if (busy || !levelJson) return;
    let settings; try { settings = validate(); } catch (error) { return status(error.message, true); }
    pause(); seek(0); setBusy(true, true); busyStart = performance.now(); $('cats').textContent = '…'; $('stats').textContent = 'Đang tìm đường đi…';
    try {
      const created = await api('/api/jobs', {levelJson,...settings}); job = created.id;
      while (!exiting) {
        const response = await api('/api/jobs/' + job);
        if (response.state === 'error') throw Error(response.error);
        if (response.state === 'complete') {
          plan = response.result; $('seek').max = plan.moves.length; seek(0);
          $('cats').textContent = plan.catsEaten; $('resultMoves').textContent = `cat / ${plan.moves.length} nước`;
          $('stats').textContent = `Giới hạn ${plan.moveLimit} nước · Ban đầu ${plan.initialCatsEaten} cat\n${plan.expanded.toLocaleString('vi-VN')} lượt mở rộng · ${(plan.elapsedMs/1000).toFixed(2)} giây`;
          const reason = {Stopped:'Đã dừng tìm',TimeBudget:'Hết thời gian tìm',StateBudget:'Đạt ngân sách trạng thái',BestFound:'Đã kết thúc tìm kiếm'}[plan.status] || 'Đã có kết quả';
          status(reason + '. Đường đi đã qua replay.'); break;
        }
        status(`Đang tìm… ${Math.floor((performance.now()-busyStart)/1000)} / ${settings.seconds} giây`);
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    } catch (error) { $('cats').textContent = '—'; $('stats').textContent = 'Chưa có kết quả mới.'; status(error.message, true); }
    finally { job = null; setBusy(false); }
  };
  $('cancel').onclick = async () => { if (!job) return; try { await api('/api/jobs/'+job+'/cancel',{}); status('Đang dừng và replay đường đi tốt nhất…'); } catch (error) { status(error.message,true); } };
  $('save').onclick = () => {
    if (!plan || busy) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(plan,null,2)],{type:'application/json'}));
    const a = document.createElement('a'); a.href=url; a.download='CatProbe-result.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('exit').onclick = async () => {
    try { await api('/api/shutdown',{}); exiting=true; pause(); setBusy(true); $('cancel').hidden=true; $('exit').disabled=true; status('Tool đã đóng. Bạn có thể đóng tab này.'); }
    catch (error) { status(error.message,true); }
  };
  function pause() { playing=false; $('play').textContent='▶ Phát'; previousTime=0; }
  function seek(value) {
    pause(); frame=Math.max(0,Math.min(value,plan?.moves.length||0)); progress=0; $('seek').value=frame; updatePosition(); draw();
  }
  function updatePosition() {
    $('position').textContent=`Nước ${frame} / ${plan?.moves.length||0}`;
    $('eatenNow').textContent=`Đã ăn ${plan?.frames[frame]?.catsEaten||0} cat`;
    $('moveDetail').textContent=frame ? `H${plan.moves[frame-1].holeId} · +${plan.moves[frame-1].eaten.length} cat` : '';
  }
  $('reset').onclick=()=>seek(0); $('prev').onclick=()=>seek(frame-1); $('next').onclick=()=>seek(frame+1); $('seek').oninput=()=>seek(Number($('seek').value));
  $('play').onclick=()=> {
    if (playing) { pause(); return; }
    if (!plan?.moves.length || busy) return;
    if (frame>=plan.moves.length) seek(0);
    playing=true; previousTime=0; $('play').textContent='Ⅱ Tạm dừng'; requestAnimationFrame(animate);
  };
  function animate(now) {
    if (!playing || !plan) return;
    const duration=Math.max(.55,(plan.moves[frame].path.length-1)*.22+.25);
    if (previousTime) progress+=Math.min((now-previousTime)/1000,.1)*Number($('speed').value)/duration;
    previousTime=now;
    if (progress>=1) {
      frame++; progress=0; $('seek').value=frame; updatePosition(); if (frame>=plan.moves.length) pause();
    }
    draw(); if (playing) requestAnimationFrame(animate);
  }
  function draw() {
    const rect=canvas.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
    canvas.width=Math.round(rect.width*dpr); canvas.height=Math.round(rect.height*dpr); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,rect.width,rect.height);
    $('emptyBoard').hidden=!!plan; if (!plan) return;
    const cell=Math.min((rect.width-40)/plan.width,(rect.height-40)/plan.height), ox=(rect.width-cell*plan.width)/2, oy=(rect.height-cell*plan.height)/2;
    if(cell<=0)return;
    function tile(x,y,inset=2) {return [ox+x*cell+inset,oy+(plan.height-1-y)*cell+inset,cell-inset*2,cell-inset*2];}
    function box(r,fill,stroke,line=1,radius=4) { ctx.beginPath();ctx.roundRect(...r,Math.max(0,Math.min(radius,r[2]/3)));if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.stroke();} }
    for(let y=0;y<plan.height;y++)for(let x=0;x<plan.width;x++)box(tile(x,y,1),'#fff','#e2e8ef');
    for(const wall of plan.obstacles)box(tile(wall.x,wall.y),'#cbd3dd',null);
    const state=plan.frames[frame], move=(playing||progress>0)&&frame<plan.moves.length?plan.moves[frame]:null;
    let dx=0,dy=0,group=[];
    if(move&&move.path.length) {
      const pos=Math.min(1,progress)*(move.path.length-1), from=Math.floor(pos), to=Math.min(from+1,move.path.length-1), t=pos-from;
      dx=move.path[from].x*(1-t)+move.path[to].x*t-move.start.x;dy=move.path[from].y*(1-t)+move.path[to].y*t-move.start.y;
      group=plan.linkedHoleGroups.find(g=>g.includes(move.holeId))||[move.holeId];
      ctx.beginPath(); for(let i=0;i<move.path.length;i++){const r=tile(move.path[i].x,move.path[i].y,0);if(i===0)ctx.moveTo(r[0]+cell/2,r[1]+cell/2);else ctx.lineTo(r[0]+cell/2,r[1]+cell/2);}ctx.strokeStyle='#adbdd0';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.stroke();ctx.setLineDash([]);
    }
    for(const hole of state.holes) {
      const active=group.includes(hole.id), x=hole.position.x+(active?dx:0), y=hole.position.y+(active?dy:0), col=color(hole.color);
      for(const local of hole.footprint){const r=tile(x+local.x,y+local.y,4);ctx.globalAlpha=.20;box(r,col,null);ctx.globalAlpha=1;box(r,null,col,active?3.5:2.5);}
      const r=tile(x,y);ctx.fillStyle='#344356';ctx.font=`600 ${Math.max(9,Math.min(13,cell*.18))}px system-ui`;ctx.fillText('H'+hole.id+(hole.locked?' L':'')+(hole.closed?' X':''),r[0]+3,r[1]+14);
      ctx.fillStyle=col;ctx.font=`500 ${Math.max(10,Math.min(15,cell*.22))}px system-ui`;ctx.fillText(hole.remaining,r[0]+3,r[1]+r[3]-5);
    }
    for(const cat of state.cats){const r=tile(cat.position.x,cat.position.y,0);ctx.beginPath();ctx.arc(r[0]+cell/2,r[1]+cell/2,cell*.15,0,Math.PI*2);ctx.fillStyle=color(cat.color);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();}
    for(const b of state.boxes){const r=tile(b.position.x,b.position.y,5);box(r,'#7f8d9f',null);ctx.fillStyle='#fff';ctx.font=`${Math.min(18,cell*.23)}px system-ui`;ctx.fillText(b.remaining,r[0]+5,r[1]+Math.min(22,cell*.3));}
  }
  new ResizeObserver(draw).observe(canvas.parentElement);
  $('copyWifi').onclick=async()=> {
    const input=$('wifiUrl');
    try {
      if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(input.value);
      else { input.focus();input.select();if(!document.execCommand('copy'))throw Error('copy'); }
      $('wifiCopyStatus').textContent='Đã sao chép. Gửi link này sang Mac.';
    } catch { input.focus();input.select();$('wifiCopyStatus').textContent='Nhấn Ctrl+C hoặc ⌘C để sao chép.'; }
  };
  api('/api/info').then(info=>{
    token=info.token;$('seconds').value=info.defaultSeconds;$('version').textContent='CatProbe '+info.version;
    $('exit').hidden=!info.canShutdown;
    if(info.wasmEnabled) {
      $('modeBadge').textContent='WebAssembly · Trên máy bạn';
      $('privacyNote').textContent='Solver chạy trong trình duyệt trên máy bạn. Level không được gửi lên server.';
      status('Solver đã sẵn sàng. Chọn hoặc thả level để bắt đầu.');
    }
    if(info.cloudEnabled) {
      $('modeBadge').textContent='Online · Render';
      $('privacyNote').textContent='Level được gửi tới máy chủ Render để phân tích. Máy cá nhân không cần chạy server.';
    }
    if(info.lanEnabled) {
      $('modeBadge').textContent='Wi-Fi / mạng nội bộ';
      $('privacyNote').textContent='Level được gửi tới máy chủ trong mạng nội bộ, không gửi ra Internet.';
      if(info.networkUrl){$('wifiPanel').hidden=false;$('wifiUrl').value=info.networkUrl;}
      if(info.networkMessage)status(info.networkMessage,true);
    }
  }).catch(error=>status('Không tải được solver: '+error.message,true));
})();
