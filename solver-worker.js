import { dotnet } from './_framework/dotnet.js';
try {
  const runtime = await dotnet.withDiagnosticTracing(false).create();
  let activeId;
  runtime.setModuleImports('worker', {progress: json => self.postMessage({id:activeId,checkpoint:JSON.parse(json)})});
  const exports = await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName);
  self.onmessage = ({data}) => {
    activeId = data.id;
    try { self.postMessage({id:data.id, ...JSON.parse(exports.SolverBridge.Analyze(data.levelJson, data.moveLimit, data.seconds))}); }
    catch(error) { self.postMessage({id:data.id,error:error.message}); }
  };
  self.postMessage({ready:true});
} catch(error) { self.postMessage({fatal:error.message}); }
