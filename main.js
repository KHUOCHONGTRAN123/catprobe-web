// All computation stays in a dedicated local browser worker. No analysis HTTP API.
let worker, ready, pending = new Map(), sequence = 0, activeJob = null;
function startWorker() {
  worker = new Worker(new URL('./solver-worker.js', import.meta.url), {type:'module'});
  ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => fail(new Error('Tải solver quá lâu. Hãy tải lại trang.')), 90000);
    function fail(error) { clearTimeout(timeout); reject(error); for(const p of pending.values()) p.reject(error); pending.clear(); }
    worker.onerror = event => fail(new Error(event.message || 'Không khởi động được WebAssembly.'));
    worker.onmessage = ({data}) => {
      if(data.ready) { clearTimeout(timeout); resolve(); }
      else if(data.fatal) fail(new Error(data.fatal));
      else if(data.checkpoint) { if(activeJob) activeJob.checkpoint=data.checkpoint; }
      else { const p = pending.get(data.id); if(p) {pending.delete(data.id); data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);} }
    };
  });
  ready.catch(()=>{});
}
startWorker();
async function analyze(body) {
  await ready;
  return new Promise((resolve,reject)=> { const id = ++sequence; pending.set(id,{resolve,reject}); worker.postMessage({id,...body}); });
}
window.catProbeApi = async (path, body) => {
  if(path === '/api/info') { await ready; return {version:'0.5.0 · WebAssembly',defaultSeconds:60,canShutdown:false,wasmEnabled:true}; }
  if(path === '/api/preview') return analyze({...body,moveLimit:0,seconds:5});
  if(path === '/api/jobs') {
    const state = activeJob = {id:String(++sequence),state:'running',started:performance.now()};
    analyze(body).then(result=>{state.result=result;state.state='complete';},error=>{if(state.state==='running'){state.state='error';state.error=error.message;}});
    return {id:state.id};
  }
  if(path.endsWith('/cancel')) {
    worker.terminate();
    for(const p of pending.values()) p.reject(new Error('Đã dừng. Kết quả tìm kiếm chưa hoàn tất đã được bỏ qua.'));
    pending.clear();
    if(activeJob) {
      if(activeJob.checkpoint) {activeJob.result={...activeJob.checkpoint,status:'Stopped',elapsedMs:performance.now()-activeJob.started};activeJob.state='complete';}
      else {activeJob.state='error';activeJob.error='Đã dừng trước khi có đường đi. Hãy thử lại.';}
    }
    startWorker(); return {stopped:true};
  }
  if(path.startsWith('/api/jobs/') && activeJob && path.endsWith('/'+activeJob.id)) return activeJob;
  throw new Error('Thao tác không được hỗ trợ.');
};
await import('./app.js');
