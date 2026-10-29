# Validation — 30 October 2026

## Completed checks

- Node.js 24.22.1: npm test — **30 passed, 0 failed**.
- npm run check — JavaScript syntax and relative runtime assets passed.
- npm run build — self-contained static dist/ package built successfully.
- npm run benchmark — 600 simulated seconds at round 43, peak eight airborne targets, conserved pending/active/broken counts. The measured local run took 27 ms; this is simulation-only timing, not rendering FPS.
- Browser inspection: menu, help and settings rendered; the unsupported-graphics error was readable and disabled starting rather than leaving a blank screen.
- CPU geometry tests: finite triangles throughout reload, more than 70% of weapon vertices in view at tested reload stages in 16:9 and 4:3, sight bead aligned with the shot centre, world camera projection aligned with targeting.
- Six complete naturally launched rounds exercised actual shots, reloads, scoring and transitions.

## Recovery verification

The execution workspace disconnected after the checks above and before the GitHub push. Source was recovered from the session and staged through the GitHub connector. All **30 tests were repeated successfully in a V8 JavaScript runtime** against the recovered sources, using in-memory substitutes for Node test/assert, filesystem and service-worker VM harness facilities. This recovery pass executed 65,116 assertions. Runtime modules compiled, the app parsed, and literal interface IDs were checked against the HTML.

The recovery pass is additional evidence, not a claim that the native Node commands or browser were rerun after the workspace disconnected. The repository includes the standard Node tests and scripts so those checks remain reproducible.

## Unverified platform behavior

The cloud browser returned no WebGL context. Live 3D rendering, pointer-lock gameplay, GPU shader execution, browser offline reload and actual Xbox hardware play could not be verified there. The WebGL 1 fallback is implemented but was not exercised on a real driver.

Before release, check a desktop WebGL browser: call PULL, break the first clay, advance through paired and four-clay rounds, take both shots, watch an automatic reload and an R/X partial reload, pause/resume and restart. Confirm the scorecard charges each reload and that the final clay does not cause an extra charge. On HTTPS, wait for OFFLINE READY and check a reload with the network disconnected.
