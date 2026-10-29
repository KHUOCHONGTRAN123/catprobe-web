# Cat Solver: browser interface

Open `https://khuochongtran123.github.io/catprobe-web/solve/`. Enter the level JSON in the input field, set the optional time limit (default 60 seconds), and run the solver. Output is JSON. On success `status` is `Solved`; `moves` is ordered and contains each `holeId`, starting cell, path and consumed cats. Other statuses describe errors or an inconclusive search. `Timeout` does not prove that the level is impossible.

On this page, browser automation can use:

```js
const result = await window.catSolver.solve(levelObject, {timeoutSeconds: 60});
```

`levelObject` may be a parsed level object or a JSON string. The promise resolves to a JSON-compatible object. Allowed timeout is 1–120 seconds. `InvalidInput`, `Timeout`, and `Error` have a `message` and an empty `moves` array. Solver statuses also include `NoNextCatReachable`, `UnsupportedMechanics`, `Cancelled`, and `CountdownExceeded`. Treat only `Solved` as a complete solution.

The solver executes in a Web Worker inside the user's browser. This is a static page, not a server endpoint: sending HTTP POST with curl will not solve a level. Level contents stay on the browser's device. Internet is required to load the runtime. Runtime startup has a separate 90-second limit; the solve timeout starts after the worker is ready. No partial solution is returned on a timeout. This result is from the Solver, not independent V42 certification.
