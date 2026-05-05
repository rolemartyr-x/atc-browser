import type { World } from "../sim/World";
import type { Airspace, Runway, Aircraft, Point2D } from "../sim/types";
import { degToRad } from "../sim/math";
import { findConflicts } from "../sim/conflicts";
import { COLORS, FONTS, LINES } from "./theme";
import type { Projection } from "./projection";

const RANGE_RING_INTERVAL_NM = 10;
const ILS_CENTERLINE_LENGTH_NM = 12;
const TRAIL_SAMPLE_INTERVAL_S = 1;
const TRAIL_MAX_AGE_S = 30;

export class Scope {
  private trails = new Map<string, Array<{ pos: Point2D; t: number }>>();

  constructor(
    private canvas: HTMLCanvasElement,
    private projection: Projection,
  ) {}

  // Re-renders the entire scope from scratch every frame.
  render(world: World, selectedId: string | null): void {
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    this.syncCanvasSize(ctx);
    const { w, h } = this.projection.viewportSize;
    this.drawBackground(ctx, w, h);
    this.drawRangeRings(ctx, world.airspace);
    this.drawRunways(ctx, world.airspace);
    this.drawFixes(ctx, world.airspace);
    this.updateTrails(world.elapsed_sec, world.aircraft);
    this.drawTrails(ctx);
    this.drawAircraft(ctx, world.aircraft, selectedId);
    this.drawConflicts(ctx, world.aircraft);
  }

  private syncCanvasSize(ctx: CanvasRenderingContext2D): void {
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.canvas.clientWidth;
    const cssH = this.canvas.clientHeight;
    const wantW = Math.round(cssW * dpr);
    const wantH = Math.round(cssH * dpr);
    if (this.canvas.width !== wantW || this.canvas.height !== wantH) {
      this.canvas.width = wantW;
      this.canvas.height = wantH;
      this.projection.resize(cssW, cssH);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, w, h);
  }

  private drawRangeRings(ctx: CanvasRenderingContext2D, airspace: Airspace): void {
    ctx.strokeStyle = COLORS.scopeDim;
    ctx.lineWidth = LINES.ring;
    const center = this.projection.toScreen({ x: 0, y: 0 });
    const ppn = this.projection.pixelsPerNm();
    for (let r = RANGE_RING_INTERVAL_NM; r < airspace.sector_radius_nm; r += RANGE_RING_INTERVAL_NM) {
      ctx.beginPath();
      ctx.arc(center.x, center.y, r * ppn, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Sector boundary, slightly brighter/thicker
    ctx.strokeStyle = COLORS.scope;
    ctx.lineWidth = LINES.ring * 2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, airspace.sector_radius_nm * ppn, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawRunways(ctx: CanvasRenderingContext2D, airspace: Airspace): void {
    const seenPair = new Set<string>();
    for (const rwy of airspace.runways) {
      const pairKey = [rwy.id, rwy.opposite].sort().join("/");
      if (seenPair.has(pairKey)) continue;
      seenPair.add(pairKey);

      const opp = airspace.runways.find((r) => r.id === rwy.opposite);
      if (!opp) continue;

      // Solid runway line
      ctx.strokeStyle = COLORS.scope;
      ctx.lineWidth = LINES.runway;
      const a = this.projection.toScreen(rwy.threshold);
      const b = this.projection.toScreen(opp.threshold);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      // Dashed extended centerline (final approach course) for each end with ILS
      if (rwy.ils) this.drawIlsCenterline(ctx, rwy);
      if (opp.ils) this.drawIlsCenterline(ctx, opp);
    }
  }

  private drawIlsCenterline(ctx: CanvasRenderingContext2D, rwy: Runway): void {
    if (!rwy.ils) return;
    ctx.save();
    ctx.strokeStyle = COLORS.scopeDim;
    ctx.lineWidth = LINES.centerline;
    ctx.setLineDash([4, 3]);
    // Outbound vector points away from the threshold along the OPPOSITE
    // of the inbound ILS course.
    const courseRad = degToRad(rwy.ils.course_deg);
    const ox = -Math.sin(courseRad);
    const oy = -Math.cos(courseRad);
    const endNm = {
      x: rwy.threshold.x + ox * ILS_CENTERLINE_LENGTH_NM,
      y: rwy.threshold.y + oy * ILS_CENTERLINE_LENGTH_NM,
    };
    const a = this.projection.toScreen(rwy.threshold);
    const b = this.projection.toScreen(endNm);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  private drawFixes(ctx: CanvasRenderingContext2D, airspace: Airspace): void {
    ctx.strokeStyle = COLORS.scope;
    ctx.fillStyle = COLORS.scope;
    ctx.lineWidth = LINES.fix;
    ctx.font = FONTS.scope;
    for (const fix of [...airspace.entry_fixes, ...airspace.exit_fixes]) {
      const p = this.projection.toScreen(fix.position_nm);
      // Triangle pointing up (small, ~8 px tall)
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 5);
      ctx.lineTo(p.x - 4, p.y + 3);
      ctx.lineTo(p.x + 4, p.y + 3);
      ctx.closePath();
      ctx.stroke();
      ctx.fillText(fix.name, p.x + 7, p.y + 4);
    }
  }

  private updateTrails(elapsedSec: number, aircraft: Aircraft[]): void {
    const liveIds = new Set<string>();
    for (const ac of aircraft) {
      liveIds.add(ac.id);
      let trail = this.trails.get(ac.id);
      if (!trail) {
        trail = [];
        this.trails.set(ac.id, trail);
      }
      const last = trail[trail.length - 1];
      if (!last || elapsedSec - last.t >= TRAIL_SAMPLE_INTERVAL_S) {
        trail.push({ pos: { ...ac.position_nm }, t: elapsedSec });
      }
      while (trail.length > 0 && elapsedSec - trail[0]!.t > TRAIL_MAX_AGE_S) {
        trail.shift();
      }
    }
    // Drop trails for aircraft no longer present.
    for (const id of [...this.trails.keys()]) {
      if (!liveIds.has(id)) this.trails.delete(id);
    }
  }

  private drawTrails(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.scope;
    for (const trail of this.trails.values()) {
      // Newest sample is at the end; oldest at the start.
      const n = trail.length;
      for (let i = 0; i < n; i++) {
        const { pos } = trail[i]!;
        const age = (n - 1 - i) / Math.max(1, n - 1);   // 0 = newest, 1 = oldest
        const alpha = 1 - age;
        ctx.globalAlpha = Math.max(0.05, alpha * 0.6);
        const sp = this.projection.toScreen(pos);
        ctx.fillRect(sp.x - 0.5, sp.y - 0.5, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawAircraft(
    ctx: CanvasRenderingContext2D,
    aircraft: Aircraft[],
    selectedId: string | null,
  ): void {
    ctx.font = FONTS.scope;
    for (const ac of aircraft) {
      const p = this.projection.toScreen(ac.position_nm);
      const isSelected = ac.id === selectedId;
      const isCleared = ac.state === "cleared_approach";
      const color = isSelected || isCleared ? COLORS.scopeBright : COLORS.scope;

      // Selection halo
      if (isSelected) {
        ctx.strokeStyle = COLORS.scopeBright;
        ctx.lineWidth = LINES.selectionHalo;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Blip
      ctx.fillStyle = color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);

      // Target-heading vector when selected
      if (isSelected && ac.target_heading != null) {
        ctx.save();
        ctx.strokeStyle = COLORS.scopeBright;
        ctx.lineWidth = LINES.targetVector;
        ctx.setLineDash([3, 2]);
        const rad = degToRad(ac.target_heading);
        const dx = Math.sin(rad);
        const dy = -Math.cos(rad);   // y flipped: north = -y on screen
        const len = 40;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + dx * len, p.y + dy * len);
        ctx.stroke();
        ctx.restore();
      }

      // Datablock
      const altHundreds = Math.round(ac.altitude_ft / 100).toString().padStart(3, "0");
      const speed = Math.round(ac.speed_kts).toString();
      const line1 = `${isCleared ? "*" : ""}${ac.callsign}`;
      const line2 = `${altHundreds} ${speed}`;

      ctx.fillStyle = color;
      const dx = 8;
      const dy = -4;
      ctx.fillText(line1, p.x + dx, p.y + dy);
      ctx.fillText(line2, p.x + dx, p.y + dy + 12);

      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x + 2, p.y);
      ctx.lineTo(p.x + dx - 1, p.y + dy - 4);
      ctx.stroke();
    }
  }

  private drawConflicts(ctx: CanvasRenderingContext2D, aircraft: Aircraft[]): void {
    const pairs = findConflicts(aircraft);
    if (pairs.length === 0) return;
    const byId = new Map<string, Aircraft>();
    for (const ac of aircraft) byId.set(ac.id, ac);

    // Flash on/off at 2 Hz based on render time.
    const flash = Math.floor(performance.now() / 250) % 2 === 0;
    if (!flash) return;

    ctx.strokeStyle = COLORS.conflict;
    ctx.lineWidth = LINES.conflict;
    for (const [a, b] of pairs) {
      const acA = byId.get(a);
      const acB = byId.get(b);
      if (!acA || !acB) continue;
      const pA = this.projection.toScreen(acA.position_nm);
      const pB = this.projection.toScreen(acB.position_nm);
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();
    }
  }
}
