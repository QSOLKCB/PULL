# PULL v0.1.0 — Two barrels. One clean round.

An original browser FPS clay-shooting game, built using QUICKSCOPER as its donor.

- The Long Meadow: a procedural outdoor range with distant hills, trees, trap houses and a fixed shooting station.
- O/U–02 over-under shotgun with two separate shots, 160 ms follow-up timing and a visible 0.94-second break/eject/insert/close reload. Empty chambers reload automatically; R/X tops up early.
- Rounds double their target counts: 1, 2, 4, 8, 16… Larger rounds use bounded volleys. Escaped clays return until the round is cleared.
- Reload-sensitive scoring: 100 per clay, 40 for each extra clay in one shot, 250 for clearing, minus 35 per reload and 15 per escape. An itemized round scorecard explains the result.
- Thirteen-pellet shot patterns, multi-clay breaks, visible fragments, recoil and synthesized shotgun/reload sounds.
- Mouse and standard Xbox controls, adjustable aim sensitivity, neutral-controller guards and focus-safe pause/resume.
- Original procedural music, reduced motion/flashes, lower rendering quality, local settings and personal best.
- Offline caching isolated from other games; no external runtime dependencies or downloaded assets.
- Static root deployment for GitHub Pages and a reproducible dist/ package. Apache-2.0 donor license and provenance retained.

See [validation](docs/VALIDATION.md) for test results and remaining platform checks. Desktop mouse or standard gamepad required; touch controls are not included. This is arcade skeet-style play, not a regulation skeet simulation.
