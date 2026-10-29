# PULL!

**Two barrels. One clean round.** An original first-person skeet-style clay shooting game for your browser.

[**Play PULL**](https://qsolkcb.github.io/PULL/) · **v0.1.0** · [Release notes](RELEASE_NOTES.md)

Built from [QUICKSCOPER](https://github.com/QSOLKCB/QUICKSCOPER)'s lightweight foundations: vanilla HTML/CSS/JavaScript, raw WebGL, Canvas 2D and Web Audio. No game engine, frameworks, downloaded game assets, or runtime dependencies. Donor provenance and modifications are recorded in [NOTICE](NOTICE).

## Step up to the line

1. Choose **Keyboard + mouse** or **Xbox controller**, then **Step up to the line**.
2. Press **Space / A** or the fire button to call **PULL**.
3. Track the clays and fire. Hold **RMB / LT** for a closer sight picture.
4. Clear the round, inspect your scorecard, then take on twice as many targets.

Rounds are **1, 2, 4, 8, 16, 32…** clays. Larger rounds arrive in volleys, with at most eight airborne at once. Missed clays are relaunched until you break them all. Your firing position stays fixed on the shooting pad; this is an arcade progression rather than a regulation skeet course.

## Your shotgun

The **O/U–02** has two vertically stacked barrels, a walnut-style stock, a silver receiver and a raised sight rib. Each trigger press fires one shell, lower barrel first. Follow-up shots are available after **160 ms**, with a short input buffer for a slightly early second press. Holding fire never produces automatic shots.

Empty chambers automatically trigger a **0.94-second break-action reload** after a short post-shot delay. The barrel assembly hinges down, spent shells eject, fresh shells insert and the action snaps shut. **R / X** reloads early; a live shell is retained during a partial top-up. The two shell indicators and reload-stage text track the action.

Each shot uses a thirteen-pellet pattern. Nearby clays can break in the same shot. The reticle shows the spread footprint, and aiming narrows it.

## Make every reload count

| Event | Score |
| --- | ---: |
| Clay broken | +100 |
| Each additional clay in one shot | +40 |
| Round cleared | +250 |
| Every reload started, including a partial top-up | −35 |
| Every clay that escapes and needs relaunching | −15 |

**Round score = max(0, clay points + multi-clay bonus + clear bonus − reload costs − escape costs).**

For example, clearing four clays in four shots with one reload and no escapes earns **400 + 250 − 35 = 615** points. Taking an extra reload reduces it to **580**. A full shotgun ignores reload requests, and the game never charges an automatic reload after the final hit.

Every round begins with **two free shells**. Scores from cleared rounds accumulate across the run; your best cleared-round total is saved locally. Shot accuracy means shots that hit at least one clay divided by shots fired, so multi-clay hits never push it above 100%.

## Controls

| Action | Keyboard + mouse | Xbox controller |
| --- | --- | --- |
| Look | Mouse; arrows also adjust aim | Right stick |
| Call PULL | Space or left click | A or RT |
| Fire one barrel | Left click | RT, one pull per shot |
| Hold aim | Right mouse | LT |
| Reload / top up | R | X |
| Pause | Esc / P / Tab | Menu |
| Mute | M | Volume slider in settings |
| Menu navigation | Mouse / Tab | D-pad; A selects; B closes dialogs |

Connect a standard-mapped controller and press a button for the browser to discover it. Release all controls after starting or resuming. Click the page once if controller-only play has not activated audio. Controller menus support D-pad up/down navigation and left/right slider or profile changes.

Desktop mouse or standard gamepad is required; touch controls are not included. Mouse mode requires Pointer Lock. Hidden tabs, lost focus, mouse unlock and controller disconnect all pause the game. Resume is deliberate; there is no catch-up simulation when you return.

## Settings, sound and offline play

- Separate mouse/controller sensitivities, controller deadzone and inverted look.
- Master volume and optional procedural music. Shot, reload, clay and round cues are synthesized locally; the original 94 BPM soundtrack uses Euclidean pulses and a modular major-pentatonic melody.
- Reduced motion/flashes and lower resolution/fewer fragments.
- Local settings and personal best. No accounts, telemetry or multiplayer services.
- Offline caching under the game's own path. Visit online once and wait for **OFFLINE READY**. Browser storage can be cleared or evicted.

If a newer release is not appearing, load once online, close **all PULL tabs**, then reopen. Updates wait for old tabs to close so a running game never mixes asset versions. PULL's cache and storage keys are separate from QUICKSCOPER and other QSOL-IMC games.

## Run, test and deploy

Node.js 22+ is sufficient for checks; no npm install is needed.

~~~sh
npm test
npm run check
npm run benchmark
npm run build
python3 -m http.server 8080
~~~

Open http://localhost:8080/ to play the source or http://localhost:8080/dist/ to inspect the packaged build. Use HTTP/HTTPS, not file URLs, because the game uses ES modules.

### Deploy manually to GitHub Pages

The [Deploy PULL to GitHub Pages workflow](.github/workflows/deploy-pages.yml) runs only when you request it. It checks out the selected `main` commit, runs the tests and asset checks with Node.js 24, builds `dist/`, and deploys that artifact after the checks pass. It uses GitHub's built-in token; no personal access token or repository secret is needed. Concurrent deployments are serialized.

1. Merge the workflow into `main`. GitHub requires the workflow file on the default branch before the **Run workflow** button is available.
2. Open [Settings → Pages](https://github.com/QSOLKCB/PULL/settings/pages). Under **Build and deployment**, set **Source** to **GitHub Actions**. This is a one-time repository setting.
3. Open [Actions → Deploy PULL to GitHub Pages](https://github.com/QSOLKCB/PULL/actions/workflows/deploy-pages.yml), click **Run workflow**, select **main**, and confirm **Run workflow**. Other branches are skipped.
4. Wait for **Check and build** and **Deploy to Pages** to succeed, then open [https://qsolkcb.github.io/PULL/](https://qsolkcb.github.io/PULL/). The deployment job also displays the published URL.

If the site shows a 404, use the full `/PULL/` address: `https://qsolkcb.github.io/` is a separate account site. Confirm the Pages source is **GitHub Actions** and the latest manual deployment succeeded. If the run button is missing, confirm this workflow has been merged into `main`. If deployment reports an environment protection error, check that the `github-pages` environment allows `main` and approve any required deployment review.

The source root remains directly playable, and `npm run build` creates a self-contained `dist/` folder for other static hosts. Deployment does not run automatically on pushes or pull requests.

The automated suite covers barrel ordering, reload duration/accounting, trigger buffering/cancellation, pellet occlusion, multi-clay scoring, relaunch conservation, exact doubling above 32-bit integers, six complete played rounds, seeded replay, bounded large-round simulation, controller guards, cache isolation, weapon visibility and sight alignment. The benchmark reports simulation timing, not browser rendering FPS.

See [design and invariants](docs/DESIGN.md), [validation and platform limits](docs/VALIDATION.md), [engineering rules](AGENTS.md) and the [Apache-2.0 license](LICENSE).
