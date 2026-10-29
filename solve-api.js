// Browser API: solveLevel(levelObjectOrJson, { timeoutSeconds: 60 }) -> Promise<result>.
export function solveLevel(level, {timeoutSeconds = 60} = {}) {
  return new Promise((resolve) => {
    let levelJson;
    try {
      levelJson = typeof level === 'string' ? level : JSON.stringify(level);
      const input = JSON.parse(levelJson);
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Level must be a JSON object.');
      if (levelJson.length > 20 * 1024 * 1024) throw new Error('Level exceeds 20 MB.');
      if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 120) throw new Error('timeoutSeconds must be an integer from 1 to 120.');
    } catch (error) { resolve({status:'InvalidInput',message:error.message,moves:[]}); return; }
    let worker, timer, done = false;
    function finish(result) { if(done) return; done = true; clearTimeout(timer); worker?.terminate(); resolve(result); }
    try {
      worker = new Worker(new URL('./full-solver-worker.js', import.meta.url), {type:'module'});
      timer = setTimeout(() => finish({status:'Error',message:'Solver startup timed out.',moves:[]}),90000);
      worker.onerror = e => finish({status:'Error',message:e.message || 'Failed to start solver.',moves:[]});
      worker.onmessage = ({data}) => {
        if (data.error) return finish({status:'Error',message:data.error,moves:[]});
        if (data.ready) {
          clearTimeout(timer);
          timer = setTimeout(() => finish({status:'Timeout',message:`No solution returned within ${timeoutSeconds} seconds.`,moves:[]}), timeoutSeconds * 1000);
          worker.postMessage({levelJson});
        } else if(data.result) finish(data.result);
      };
    } catch(error) { finish({status:'Error',message:error.message,moves:[]}); }
  });
}
