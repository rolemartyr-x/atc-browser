import type { Point2D } from "../sim/types";

export interface ScreenPoint {
  x: number;
  y: number;
}

// Projects between world coordinates (nm, x=east, y=north, origin = airport ARP)
// and screen coordinates (px, x=right, y=DOWN). Y is flipped so that "north up"
// is intuitive in the world model.
export class Projection {
  private nmPerPx = 0;
  private cx = 0;
  private cy = 0;

  constructor(
    private viewportW: number,
    private viewportH: number,
    private rangeNm: number,
  ) {
    this.recalc();
  }

  resize(w: number, h: number): void {
    this.viewportW = w;
    this.viewportH = h;
    this.recalc();
  }

  setRange(rangeNm: number): void {
    this.rangeNm = rangeNm;
    this.recalc();
  }

  private recalc(): void {
    const minDim = Math.min(this.viewportW, this.viewportH);
    // Diameter (2 * rangeNm) fits in smaller dimension.
    this.nmPerPx = (2 * this.rangeNm) / minDim;
    this.cx = this.viewportW / 2;
    this.cy = this.viewportH / 2;
  }

  toScreen(p: Point2D): ScreenPoint {
    return {
      x: this.cx + p.x / this.nmPerPx,
      y: this.cy - p.y / this.nmPerPx,
    };
  }

  toWorld(p: ScreenPoint): Point2D {
    return {
      x: (p.x - this.cx) * this.nmPerPx,
      y: -(p.y - this.cy) * this.nmPerPx,
    };
  }

  pixelsPerNm(): number {
    return 1 / this.nmPerPx;
  }

  get viewportSize(): { w: number; h: number } {
    return { w: this.viewportW, h: this.viewportH };
  }
}
