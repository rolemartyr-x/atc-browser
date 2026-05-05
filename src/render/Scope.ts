import type { World } from "../sim/World";
import type { Airspace, Runway, Aircraft } from "../sim/types";
import { degToRad } from "../sim/math";
import { COLORS, FONTS, LINES } from "./theme";
import type { Projection } from "./projection";

const RANGE_RING_INTERVAL_NM = 10;
const ILS_CENTERLINE_LENGTH_NM = 12;

export class Scope {
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
    this.drawAircraft(ctx, world.aircraft, selectedId);
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

      // Blip: 4x4 px square, centered on the position.
      ctx.fillStyle = color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);

      // Datablock: callsign on line 1; "<altitude_hundreds> <speed>" on line 2.
      const altHundreds = Math.round(ac.altitude_ft / 100).toString().padStart(3, "0");
      const speed = Math.round(ac.speed_kts).toString();
      const line1 = `${isCleared ? "*" : ""}${ac.callsign}`;
      const line2 = `${altHundreds} ${speed}`;

      ctx.fillStyle = color;
      const dx = 8;
      const dy = -4;
      ctx.fillText(line1, p.x + dx, p.y + dy);
      ctx.fillText(line2, p.x + dx, p.y + dy + 12);

      // Leader line from blip toward the datablock.
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x + 2, p.y);
      ctx.lineTo(p.x + dx - 1, p.y + dy - 4);
      ctx.stroke();
    }
  }
}
