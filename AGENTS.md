# PULL engineering rules

Read README.md and docs/DESIGN.md before changing gameplay. Keep donor attribution in NOTICE and the Apache-2.0 LICENSE.

- Vanilla HTML/CSS/JavaScript, raw WebGL 2 with WebGL 1 fallback, Canvas 2D, Pointer Lock, standard Gamepad and synthesized Web Audio. No frameworks, game engines, CDNs, external fonts/assets or runtime dependencies.
- This is an original, single-player sporting-clay game. Keep the fixed firing station and over-under shotgun: two vertically stacked barrels, two separate trigger presses, and a visible break/eject/insert/close reload.
- Round target counts are exactly 2 ** (round - 1). Count queued targets numerically; never allocate a full round in advance. At most eight clays may be airborne. Maintain pending + targets.length + stats.hits === goal during play.
- Every started reload costs 35 points, including partial top-ups. Full-chamber reload requests do nothing. Award round score once; do not auto-reload after the final clay. Each new round deliberately starts with two free shells.
- Keep simulation in src/game.js, independent of the DOM, rendering, sound and storage. Preserve seeded randomness, the fixed step, bounded backlog, and one trigger edge per shot with bounded buffering.
- Visible solid geometry must block pellets. A pellet hits only its nearest clay; a clay can score at most once per shell. Hit-shot accuracy cannot exceed 100% even with multiple clays per shot.
- Lost focus, hidden tabs, mouse pointer unlock and controller disconnect/replacement pause simulation and clear held/queued input. Controller resume requires neutral input. Restart must not add event listeners or animation loops.
- Optional audio, storage and offline caching must fail gracefully. Graphics failure must show an explanation. Cap fragments and avoid allocations proportional to the round goal.
- All runtime URLs must stay relative for /PULL/ Pages hosting. Increment sw.js REVISION for cached runtime changes. Delete only this game's scope-specific caches; do not hot-swap a running game.
- Run npm test, npm run check, npm run build and the simulation benchmark for simulation/performance changes. Browser-check the packaged game when available; state any unverified platform behavior.
- Keep root index.html playable with branch-based Pages. No new GitHub Actions or scheduled workflows unless the maintainer requests them.
