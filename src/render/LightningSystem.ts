import { MAX_LIGHTNING_SEGMENTS } from "./constants";
import type { Vec3 } from "@/types";

export interface LightningSegment {
  pos: Vec3;
  width: number;
  brightness: number;
}

export interface LightningBolt {
  segments: LightningSegment[];
  startTime: number;
  duration: number;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function subdivide(
  start: Vec3,
  end: Vec3,
  depth: number,
  maxDepth: number,
  offsetScale: number,
  points: Vec3[],
): void {
  if (depth >= maxDepth) {
    points.push([...start]);
    return;
  }

  const mid: Vec3 = [
    (start[0] + end[0]) * 0.5,
    (start[1] + end[1]) * 0.5,
    (start[2] + end[2]) * 0.5,
  ];

  const dir: Vec3 = [end[0] - start[0], end[1] - start[1], end[2] - start[2]];
  const len = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]);
  const lenInv = len > 0 ? 1 / len : 0;
  dir[0] *= lenInv;
  dir[1] *= lenInv;
  dir[2] *= lenInv;

  const up: Vec3 = [0, 1, 0];
  let perp1: Vec3 = [
    dir[1] * up[2] - dir[2] * up[1],
    dir[2] * up[0] - dir[0] * up[2],
    dir[0] * up[1] - dir[1] * up[0],
  ];
  let p1len = Math.sqrt(perp1[0] * perp1[0] + perp1[1] * perp1[1] + perp1[2] * perp1[2]);
  if (p1len < 0.001) {
    perp1 = [1, 0, 0];
    p1len = 1;
  }
  perp1[0] /= p1len;
  perp1[1] /= p1len;
  perp1[2] /= p1len;

  const perp2: Vec3 = [
    dir[1] * perp1[2] - dir[2] * perp1[1],
    dir[2] * perp1[0] - dir[0] * perp1[2],
    dir[0] * perp1[1] - dir[1] * perp1[0],
  ];

  const offset = offsetScale * len * 0.15;
  mid[0] += (randRange(-1, 1) * perp1[0] + randRange(-1, 1) * perp2[0]) * offset;
  mid[1] += (randRange(-1, 1) * perp1[1] + randRange(-1, 1) * perp2[1]) * offset * 0.5;
  mid[2] += (randRange(-1, 1) * perp1[2] + randRange(-1, 1) * perp2[2]) * offset;

  const nextScale = offsetScale * 0.5;

  subdivide(start, mid, depth + 1, maxDepth, nextScale, points);
  subdivide(mid, end, depth + 1, maxDepth, nextScale, points);
}

export class LightningSystem {
  private bolts: LightningBolt[] = [];
  private nextLightningTime = 0;
  private currentFlash = 0;

  generateBolt(cloudBase: number, cloudThickness: number, areaRadius: number, time: number): LightningBolt | null {
    const startX = randRange(-areaRadius, areaRadius);
    const startZ = randRange(-areaRadius, areaRadius);
    const startY = cloudBase + randRange(0, cloudThickness * 0.5);

    const endX = startX + randRange(-500, 500);
    const endZ = startZ + randRange(-500, 500);
    const endY = 0;

    const start: Vec3 = [startX, startY, startZ];
    const end: Vec3 = [endX, endY, endZ];

    const mainPoints: Vec3[] = [];
    subdivide(start, end, 0, 4, 1.0, mainPoints);
    mainPoints.push([...end]);

    const segments: LightningSegment[] = [];
    const totalPoints = mainPoints.length;

    for (let i = 0; i < totalPoints; i++) {
      const t = i / Math.max(1, totalPoints - 1);
      const width = 15.0 * (1.0 - t * 0.7);
      const brightness = 1.0 - t * 0.3;

      if (segments.length < MAX_LIGHTNING_SEGMENTS) {
        segments.push({ pos: mainPoints[i], width, brightness });
      }

      if (i > 0 && i < totalPoints - 1 && Math.random() < 0.25 && segments.length < MAX_LIGHTNING_SEGMENTS - 10) {
        const branchStart = mainPoints[i];
        const remaining = totalPoints - i;
        const branchLengthRatio = randRange(0.3, 0.5);
        const branchLen = remaining * branchLengthRatio;

        const branchDir: Vec3 = [
          end[0] - start[0],
          end[1] - start[1],
          end[2] - start[2],
        ];
        const bl = Math.sqrt(branchDir[0] ** 2 + branchDir[1] ** 2 + branchDir[2] ** 2);
        if (bl > 0) {
          branchDir[0] /= bl;
          branchDir[1] /= bl;
          branchDir[2] /= bl;
        }

        const angle = randRange(30, 60) * (Math.PI / 180);
        const sign = Math.random() > 0.5 ? 1 : -1;

        const perp: Vec3 = [
          Math.cos(angle) * branchDir[0] + Math.sin(angle) * sign * branchDir[2],
          branchDir[1],
          -Math.sin(angle) * sign * branchDir[0] + Math.cos(angle) * branchDir[2],
        ];

        const branchEnd: Vec3 = [
          branchStart[0] + perp[0] * bl * branchLengthRatio,
          branchStart[1] + perp[1] * bl * branchLengthRatio * 0.8,
          branchStart[2] + perp[2] * bl * branchLengthRatio,
        ];

        const branchPoints: Vec3[] = [];
        subdivide(branchStart, branchEnd, 0, 2, 0.8, branchPoints);

        for (let j = 0; j < branchPoints.length; j++) {
          const bt = (i + j * branchLengthRatio) / totalPoints;
          const bWidth = 8.0 * (1.0 - bt);
          const bBrightness = 0.7 * (1.0 - bt * 0.5);

          if (segments.length < MAX_LIGHTNING_SEGMENTS) {
            segments.push({ pos: branchPoints[j], width: bWidth, brightness: bBrightness });
          }
        }
      }
    }

    if (segments.length === 0) return null;

    return {
      segments,
      startTime: time,
      duration: 0.2,
    };
  }

  private computeBrightness(age: number, duration: number): number {
    const t = age / duration;
    let brightness: number;
    if (t < 0.25) {
      brightness = t / 0.25;
    } else if (t < 0.75) {
      brightness = 1.0;
    } else {
      brightness = 1.0 - (t - 0.75) / 0.25;
    }
    return Math.max(0, Math.min(1, brightness));
  }

  update(
    time: number,
    coverage: number,
    isStorm: boolean,
    lightningEnabled: boolean,
    cloudBase: number,
    cloudThickness: number,
    areaRadius: number,
  ): void {
    this.bolts = this.bolts.filter(
      (bolt) => time - bolt.startTime < bolt.duration,
    );

    this.currentFlash = 0;
    for (const bolt of this.bolts) {
      const age = time - bolt.startTime;
      const brightness = this.computeBrightness(age, bolt.duration);
      this.currentFlash = Math.max(this.currentFlash, brightness * 0.7);
    }

    const canTrigger = lightningEnabled && isStorm && coverage >= 0.7;
    if (canTrigger && this.bolts.length === 0 && time >= this.nextLightningTime) {
      const bolt = this.generateBolt(cloudBase, cloudThickness, areaRadius, time);
      if (bolt) {
        this.bolts.push(bolt);
      }
      this.nextLightningTime = time + randRange(3, 8);
      return;
    }

    if (!canTrigger && this.nextLightningTime < time + 1.0) {
      this.nextLightningTime = time + randRange(3, 8);
    }
  }

  getBolts(): LightningBolt[] {
    return this.bolts;
  }

  getFlashIntensity(): number {
    return this.currentFlash;
  }

  flattenPositions(time: number): { positions: Float32Array; count: number } {
    const all: number[] = [];

    for (const bolt of this.bolts) {
      const age = time - bolt.startTime;
      const t = age / bolt.duration;
      if (t < 0 || t > 1) continue;

      const brightness = this.computeBrightness(age, bolt.duration);

      for (const seg of bolt.segments) {
        all.push(seg.pos[0], seg.pos[1], seg.pos[2]);
        all.push(seg.width);
        all.push(seg.brightness * brightness);
      }
    }

    const count = Math.floor(all.length / 5);
    return { positions: new Float32Array(all), count };
  }
}
