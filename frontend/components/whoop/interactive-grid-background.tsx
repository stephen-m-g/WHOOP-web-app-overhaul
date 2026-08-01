"use client";

import { useEffect, useRef } from "react";

const SPACING = 64;
const DISTORT_RADIUS = 340;
const DISTORT_STRENGTH = 0.25;
// Wider than DISTORT_RADIUS on purpose: the visible glow reaches further out
// than the physical bulge, and fades all the way to 0 (not a flat baseline)
// so points far from the cursor — e.g. near the screen edges — go fully dark.
const GLOW_RADIUS = 700;
const SMOOTHING = 0.08;
const DOT_RADIUS = 2.3;
const LINE_MAX_ALPHA = 0.42;
const DOT_MAX_ALPHA = 0.8;
const LINE_RGB = "255, 255, 255";

// The cursor effect doesn't snap on at full radius the instant the page is
// interactive — it waits for the intro fade to settle, then expands out
// from 0 to full radius over POWER_ON_DURATION_MS, like it's switching on.
const POWER_ON_DELAY_MS = 800;
const POWER_ON_DURATION_MS = 900;

interface GridPoint {
  baseX: number;
  baseY: number;
}

/**
 * Dashboard-only decorative background: a grid of dots/lines that bulges
 * outward around the cursor — like the grid is stretched over a dome pushing
 * up beneath it — eased so it trails rather than snaps. Canvas 2D (no WebGL)
 * — the point count here is small enough that a redraw loop is cheap.
 */
export function InteractiveGridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let points: GridPoint[] = [];
    let cols = 0;
    let rows = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const mouse = { x: 0, y: 0 };
    const smoothMouse = { x: 0, y: 0 };
    let hasPointer = false;

    function buildGrid() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;

      cols = Math.ceil(width / SPACING) + 1;
      rows = Math.ceil(height / SPACING) + 1;
      points = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          points.push({ baseX: c * SPACING, baseY: r * SPACING });
        }
      }
    }

    function handleMouseMove(event: MouseEvent) {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      if (!hasPointer) {
        smoothMouse.x = mouse.x;
        smoothMouse.y = mouse.y;
      }
      hasPointer = true;
    }

    buildGrid();
    window.addEventListener("resize", buildGrid);
    window.addEventListener("mousemove", handleMouseMove);

    let raf = 0;
    let startTime: number | null = null;

    function render(time: number) {
      if (startTime === null) startTime = time;
      const elapsed = time - startTime;
      const powerOnLinear = Math.max(0, Math.min(1, (elapsed - POWER_ON_DELAY_MS) / POWER_ON_DURATION_MS));
      const powerOnT = powerOnLinear * powerOnLinear * (3 - 2 * powerOnLinear);
      const effectiveDistortRadius = DISTORT_RADIUS * powerOnT;
      const effectiveGlowRadius = GLOW_RADIUS * powerOnT;

      if (!reduceMotion && hasPointer) {
        smoothMouse.x += (mouse.x - smoothMouse.x) * SMOOTHING;
        smoothMouse.y += (mouse.y - smoothMouse.y) * SMOOTHING;
      }

      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
      context!.clearRect(0, 0, width, height);

      const displaced = new Array<{ x: number; y: number; glow: number }>(points.length);

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        let x = p.baseX;
        let y = p.baseY;
        let glow = 0;

        if (!reduceMotion && hasPointer) {
          // Offset FROM the cursor TO the point (not the other way around) —
          // scaling this vector outward is what gives the bulge/magnify look,
          // as opposed to pulling points toward a single collapse point.
          const offsetX = p.baseX - smoothMouse.x;
          const offsetY = p.baseY - smoothMouse.y;
          const dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);

          if (dist < effectiveDistortRadius) {
            const warpLinear = 1 - dist / effectiveDistortRadius;
            const warpT = warpLinear * warpLinear * (3 - 2 * warpLinear);
            const scale = 1 + warpT * DISTORT_STRENGTH;
            x = smoothMouse.x + offsetX * scale;
            y = smoothMouse.y + offsetY * scale;
          }

          if (dist < effectiveGlowRadius) {
            const glowLinear = 1 - dist / effectiveGlowRadius;
            glow = glowLinear * glowLinear * (3 - 2 * glowLinear);
          }
        }

        displaced[i] = { x, y, glow };
      }

      context!.lineWidth = 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const point = displaced[i];

          if (c < cols - 1) {
            const right = displaced[i + 1];
            const alpha = Math.max(point.glow, right.glow) * LINE_MAX_ALPHA;
            if (alpha > 0.002) {
              context!.strokeStyle = `rgba(${LINE_RGB}, ${alpha})`;
              context!.beginPath();
              context!.moveTo(point.x, point.y);
              context!.lineTo(right.x, right.y);
              context!.stroke();
            }
          }
          if (r < rows - 1) {
            const below = displaced[i + cols];
            const alpha = Math.max(point.glow, below.glow) * LINE_MAX_ALPHA;
            if (alpha > 0.002) {
              context!.strokeStyle = `rgba(${LINE_RGB}, ${alpha})`;
              context!.beginPath();
              context!.moveTo(point.x, point.y);
              context!.lineTo(below.x, below.y);
              context!.stroke();
            }
          }
        }
      }

      for (const point of displaced) {
        const alpha = point.glow * DOT_MAX_ALPHA;
        if (alpha <= 0.002) continue;
        context!.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        context!.beginPath();
        context!.arc(point.x, point.y, DOT_RADIUS, 0, Math.PI * 2);
        context!.fill();
      }

      raf = requestAnimationFrame(render);
    }

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", buildGrid);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true" />;
}
