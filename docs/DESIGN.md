# PULL v0.1.0 design

## Donor boundary

The requested donor is QSOLKCB/QUICKSCOPER at commit 7c406e2545d82ee6bdc5fda5f198eb22fa183a84. PULL reuses/adapts its WebGL buffers/mesh primitives/shaders, math, standard gamepad adapter, audio scheduler, static build/check scripts and scope-isolated offline cache. It replaces the sniper simulation, combat arena, enemies, navigation, scope, weapon, UI and scoring with original clay-shooting systems. NOTICE identifies the inherited material; LICENSE is unchanged.

## Simulation and rounds

src/game.js is a DOM-free simulation with seeded randomness. The browser advances it at 120 Hz, with at most six steps per frame and no hidden-tab backlog. Rendering uses a separate random stream for fragments.

The phase order is ready → active → cleared → ready. The player calls PULL explicitly. Clearing awards a single result and adds it once to the run total. The scorecard advances only on a user action. A new round resets its stats and loads two fresh shells. A new run creates a new Game without adding animation loops or listeners.

Target goal is 2 ** (round - 1). Pending targets are a number; only the maximum eight airborne clays are objects. Escaping returns one clay to pending and increments escapes. During active play, pending + targets.length + stats.hits === goal. Larger rounds use pairs/triples separated by a launch interval. Trajectories vary by seed and round; speed increases gradually and then levels off. The distant numeric ceiling is round 43, preserving exact integer score accumulation rather than silently overflowing or capping the target goal. That round contains 4,398,046,511,104 targets and remains allocation-bounded.

## Shotgun contract

Two booleans represent loaded lower/upper chambers. A shot consumes the next live barrel, enforces a 160 ms recovery and emits a shot event. One slightly early trigger edge may wait up to 120 ms; repeated requests cannot create multiple pending shots. Cancellation, reload and screen/focus changes clear the buffer. Firing is blocked while open. Holding the trigger cannot repeat shots.

After both shells are spent, a 220 ms post-shot delay precedes a 940 ms automatic reload. Manual reload has the same duration and cost. It snapshots the spent chambers for animation and preserves any live shell until the action closes; only closure restores both chambers. Full-chamber, ready-phase and repeated reload requests do nothing. Final-hit completion happens before the automatic reload branch, preventing a needless charge.

The animated barrel mesh hinges around the receiver. Ejection and insertion stage events align with visual progress. Recoil moves the model, not the simulation's aim direction. Holding aim blends field of view and pellet spread.

A shot casts thirteen unit pellet rays: one centre ray and twelve ring rays with seeded rotation. Each is bounded by the nearest solid box and can hit only its nearest clay sphere. Broken IDs are deduplicated across pellets before scoring. This permits adjacent multi-clay hits without allowing a single pellet through the entire flight line. The visual disc is 1.1 units wide; its 0.55-radius spherical hit volume is an intentional arcade tolerance.

## Scoring and persistence

Round points are max(0, 100*hits + 40*extraHits + 250 - 35*reloads - 15*escapes). The clear bonus is absent from the provisional HUD tally. Extra hits count hits beyond the first per shot. Hit-shot count increments once for any successful shell, independently of target count. The scorecard itemizes each term; the HUD shows completed-round totals plus the current provisional tally. Only cleared totals update the saved best.

Storage keys are pull.settings.v1 and pull.best.v1, validated on load and optional when storage is unavailable. Scores are local and are not a tamper-resistant leaderboard.

## Platform and deployment

One WebGL context draws a cached static range mesh, reused dynamic clay/weapon buffers and bounded particles. No remote assets are fetched. Canvas 2D handles score labels, with HTML menus and HUD. WebGL 1 is the graphics fallback. Audio, storage and caching failures degrade independently. WebGL context loss pauses play and asks for a reload.

All runtime references are relative. Root branch-based Pages and the dist/ build use the same sources. Service worker caches include the full runtime module graph and are named by PULL plus registration scope. Activation removes only obsolete caches in that scope. New workers wait for all old game tabs to close; optional caching never blocks play.

Mouse unlock, browser blur, hidden tabs and controller replacement/disconnection pause simulation. Input resets on every screen transition; standard controllers must return to neutral before sending new trigger edges. Actual controller hardware and WebGL driver behavior also need testing on release hardware.
