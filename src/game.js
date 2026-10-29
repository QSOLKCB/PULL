// Original PULL simulation. Browser presentation stays outside it.
import {clamp, forward, seededRandom, rayBox} from './math.js';
import {createWorld} from './world.js';
const RULES = Object.freeze({
    step: 1 / 120, capacity: 2, shotInterval: 0.16, buffer: 0.12,
    reload: 0.94, autoReloadDelay: 0.22, clayRadius: 0.55, range: 100,
    hipSpread: 0.026, aimSpread: 0.018, maxActive: 8,
    clayPoints: 100, doubleBonus: 40, clearBonus: 250,
    reloadPenalty: 35, escapePenalty: 15,
    maxRound: 43,
  });
  function targetCount(round) {
    if (!Number.isInteger(round) || round < 1 || round > RULES.maxRound) throw new RangeError('Invalid round');
    return 2 ** (round - 1);
  }
  function roundScore(stats, cleared = false) {
    const targetPoints = stats.hits * RULES.clayPoints;
    const multiPoints = stats.extraHits * RULES.doubleBonus;
    const clearBonus = cleared ? RULES.clearBonus : 0;
    const reloadCost = stats.reloads * RULES.reloadPenalty;
    const escapeCost = stats.escapes * RULES.escapePenalty;
    return {targetPoints, multiPoints, clearBonus, reloadCost, escapeCost,
      total: Math.max(0, targetPoints + multiPoints + clearBonus - reloadCost - escapeCost)};
  }
  function raySphere(origin, direction, center, radius, max = RULES.range) {
    const offset = origin.map((v, i) => v - center[i]);
    const b = offset.reduce((s, v, i) => s + v * direction[i], 0);
    const c = offset.reduce((s, v) => s + v * v, 0) - radius * radius;
    const disc = b * b - c;
    if (disc < 0) return null;
    const root = Math.sqrt(disc), near = -b - root, far = -b + root;
    if (far < 0) return null;
    const t = Math.max(0, near);
    return t <= max ? t : null;
  }
  function shotPattern(yaw, pitch, spread, rotation = 0) {
    const f = forward(yaw, pitch), right = [Math.cos(yaw), 0, Math.sin(yaw)];
    const up = [-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), Math.cos(yaw) * Math.sin(pitch)];
    const directions = [f];
    for (let i = 0; i < 12; i++) {
      const angle = rotation + i * Math.PI * 2 / 12;
      const radius = spread * (i % 2 ? 1 : 0.55);
      const d = f.map((v, j) => v + radius * (right[j] * Math.cos(angle) + up[j] * Math.sin(angle)));
      const length = Math.hypot(...d);
      directions.push(d.map(v => v / length));
    }
    return directions;
  }
  const freshStats = () => ({hits: 0, shots: 0, hitShots: 0, reloads: 0, escapes: 0, extraHits: 0});
  class Game {
    constructor(seed = 1) {
      this.random = seededRandom(seed); this.world = createWorld();
      this.player = {x: 0, y: 1.72, z: 8, yaw: 0, pitch: 0.12};
      this.weapon = {chambers: [true, true], reload: 0, cooldown: 0, queued: 0, ads: 0,
        recoil: 0, emptyWait: 0, lastBarrel: 0, spent: []};
      this.time = 0; this.round = 0; this.total = 0; this.history = []; this.events = [];
      this.nextId = 1; this.targets = []; this.beginRound();
    }
    get ammo() { return this.weapon.chambers.filter(Boolean).length; }
    get score() { return this.total + (this.phase === 'active' || this.phase === 'ready' ? roundScore(this.stats).total : 0); }
    get remaining() { return this.goal - this.stats.hits; }
    emit(type, extra = {}) { this.events.push({type, ...extra}); }
    drainEvents() { const events = this.events; this.events = []; return events; }
    beginRound() {
      if (this.round >= RULES.maxRound) { this.phase = 'finished'; return false; }
      this.round++; this.goal = targetCount(this.round); this.pending = this.goal;
      this.stats = freshStats(); this.phase = 'ready'; this.targets.length = 0; this.launchClock = 0;
      Object.assign(this.weapon, {chambers: [true, true], reload: 0, cooldown: 0, queued: 0, recoil: 0, emptyWait: 0, spent: []});
      this.emit('round', {round: this.round, goal: this.goal}); return true;
    }
    nextRound() { return this.phase === 'cleared' && this.beginRound(); }
    pull() {
      if (this.phase !== 'ready') return false;
      this.phase = 'active'; this.launchClock = 0.4; this.emit('pull'); return true;
    }
    cancelInput() { this.weapon.queued = 0; }
    requestShot() {
      const w = this.weapon;
      if (this.phase !== 'active' || w.reload > 0) return false;
      if (this.ammo === 0) return this.reload();
      if (w.cooldown > 0) {
        if (w.cooldown <= RULES.buffer && !w.queued) { w.queued = RULES.buffer; return true; }
        return false;
      }
      this.fire(); return true;
    }
    reload() {
      const w = this.weapon;
      if (this.phase !== 'active' || w.reload > 0 || this.ammo === RULES.capacity) return false;
      w.queued = 0; w.reload = RULES.reload;
      w.spent = w.chambers.flatMap((live, i) => live ? [] : [i]);
      this.stats.reloads++; this.emit('reload', {spent: [...w.spent]}); return true;
    }
    fire() {
      const w = this.weapon, p = this.player, origin = [p.x, p.y, p.z];
      const barrel = w.chambers.findIndex(Boolean);
      if (barrel < 0 || w.reload > 0 || this.phase !== 'active') return;
      w.chambers[barrel] = false; w.lastBarrel = barrel; w.cooldown = RULES.shotInterval;
      w.recoil = 1; w.queued = 0; w.emptyWait = RULES.autoReloadDelay; this.stats.shots++;
      const spread = RULES.hipSpread + (RULES.aimSpread - RULES.hipSpread) * w.ads;
      const rays = shotPattern(p.yaw, p.pitch, spread, this.random() * Math.PI * 2);
      const broken = new Set();
      for (const ray of rays) {
        let distance = RULES.range, nearest = null;
        for (const solid of this.world.solids) {
          const hit = rayBox(origin, ray, solid, distance);
          if (hit !== null) distance = hit;
        }
        for (const target of this.targets) {
          const hit = raySphere(origin, ray, [target.x, target.y, target.z], RULES.clayRadius, distance);
          if (hit !== null && hit < distance) { distance = hit; nearest = target; }
        }
        if (nearest) broken.add(nearest.id);
      }
      const hits = this.targets.filter(t => broken.has(t.id));
      this.targets = this.targets.filter(t => !broken.has(t.id));
      this.stats.hits += hits.length;
      if (hits.length) this.stats.hitShots++;
      this.stats.extraHits += Math.max(0, hits.length - 1);
      this.emit('shot', {origin, direction: forward(p.yaw, p.pitch), hits: hits.map(t => ({...t})), barrel});
      if (this.stats.hits === this.goal) {
        const breakdown = roundScore(this.stats, true);
        this.total += breakdown.total; this.phase = 'cleared'; this.cancelInput();
        const result = {round: this.round, goal: this.goal, ...this.stats, ...breakdown};
        this.history.push(result); this.emit('clear', {result});
      }
    }
    spawnTarget() {
      const r = this.random, side = this.nextId % 2 ? -1 : 1, level = Math.min(12, this.round - 1);
      const first = this.round === 1;
      this.targets.push({id: this.nextId++, x: side * (first ? 4 : 10 + r() * 7), y: first ? 3.3 : 2.6 + r() * 1.6,
        z: first ? -19 : -21 - r() * 10,
        vx: -side * (first ? 1.6 : 3.4 + level * 0.12 + r() * 1.4),
        vy: first ? 5.2 : 5.8 + r() * 2.1, vz: -0.5 - r() * 0.9,
        age: 0, spin: r() * Math.PI * 2, color: this.nextId % 3});
      this.pending--; this.emit('launch');
    }
    step(dt, input = {}) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, 0.05); this.time += dt;
      const w = this.weapon;
      w.ads += ((input.aim && w.reload === 0 ? 1 : 0) - w.ads) * Math.min(1, dt * 18);
      w.recoil = Math.max(0, w.recoil - dt * 8);
      if (this.phase !== 'active') return;
      w.cooldown = Math.max(0, w.cooldown - dt);
      if (w.reload > 0) {
        const before = w.reload; w.reload = Math.max(0, w.reload - dt);
        if (before > RULES.reload * 0.68 && w.reload <= RULES.reload * 0.68) this.emit('eject');
        if (before > RULES.reload * 0.3 && w.reload <= RULES.reload * 0.3) this.emit('insert');
        if (!w.reload) { w.chambers = [true, true]; this.emit('loaded'); }
      }
      if (w.queued > 0) {
        if (w.cooldown === 0) this.fire();
        else w.queued = Math.max(0, w.queued - dt);
      }
      if (this.phase !== 'active') return;
      if (!this.ammo && !w.reload) {
        w.emptyWait = Math.max(0, w.emptyWait - dt);
        if (w.emptyWait === 0) this.reload();
      }
      let live = 0;
      for (const t of this.targets) {
        t.age += dt; t.vy -= 2.45 * dt;
        t.x += t.vx * dt; t.y += t.vy * dt; t.z += t.vz * dt; t.spin += dt * 7;
        if (t.y < 0.8 || Math.abs(t.x) > 32 || t.age > 7.5) {
          this.pending++; this.stats.escapes++; this.emit('escape');
        } else this.targets[live++] = t;
      }
      this.targets.length = live;
      this.launchClock -= dt;
      if (this.pending > 0 && this.launchClock <= 0) {
        const volley = Math.min(this.pending, this.round === 1 ? 1 : this.round < 4 ? 2 : 3);
        const count = Math.min(volley, RULES.maxActive - this.targets.length);
        for (let i = 0; i < count; i++) this.spawnTarget();
        this.launchClock = count ? Math.max(1.3, 2.7 - this.round * 0.12) : 0.2;
      }
    }
    look(dx, dy) {
      this.player.yaw = clamp(this.player.yaw + dx, -1.35, 1.35);
      this.player.pitch = clamp(this.player.pitch + dy, -0.25, 1.12);
    }
  }
export {RULES,targetCount,roundScore,raySphere,shotPattern,Game};
