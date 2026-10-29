import { dotnet } from './_framework/dotnet.js?v=full-solver-1';
try {
  const runtime = await dotnet.withDiagnosticTracing(false).create();
  const exports = await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName);
  self.onmessage = ({data}) => {
    try { self.postMessage({result:JSON.parse(exports.SolverBridge.Solve(data.levelJson))}); }
    catch (error) { self.postMessage({error:error.message}); }
  };
  self.postMessage({ready:true});
} catch (error) { self.postMessage({error:error.message}); }
