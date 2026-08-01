"use client";

import { useEffect, useRef } from "react";
import { getLastKnownCursorPosition } from "@/lib/cursor-tracker";

const SPACING = 24;
const ACTIVATION_RADIUS = 350;
const SMOOTHING = 0.08;

// A much larger, irregular (non-circular) radius, centered on the cursor
// like ACTIVATION_RADIUS, within which inactive particles are visible at
// all. Beyond it, particles are fully invisible. The wobble is a fixed
// function of angle from the cursor, not time — no idle animation, just a
// non-circular boundary shape.
const VISIBILITY_BASE_RADIUS = 600;
const VISIBILITY_WOBBLE_1 = 90;
const VISIBILITY_WOBBLE_2 = 50;

const INACTIVE_RADIUS = 1;
const ACTIVE_RADIUS = 2.5;
const INACTIVE_ALPHA = 0.35;
const ACTIVE_ALPHA = 0.9;

const INACTIVE_RGB: [number, number, number] = [255, 255, 255];
const ACTIVE_RGB: [number, number, number] = [141, 142, 206]; // --metric-sleep lavender

// The cursor effect doesn't snap on at full radius the instant the page is
// interactive — it waits for the intro fade to settle, then expands out
// from 0 to full radius over POWER_ON_DURATION_MS, like it's switching on.
const POWER_ON_DELAY_MS = 800;
const POWER_ON_DURATION_MS = 900;

interface GridPoint {
  baseX: number;
  baseY: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Sleep-page-only decorative background: a plain grid of small white dots
 * that "activate" — growing slightly and turning lavender — within a soft
 * radius around the cursor. Simpler than earlier passes at this (no shape
 * story, no idle motion): particles sit still until the cursor comes near.
 */
export function SleepRippleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let points: GridPoint[] = [];
    let width = 0;
    let height = 0;
    let dpr = 1;

    const mouse = { x: 0, y: 0 };
    const smoothMouse = { x: 0, y: 0 };

    function buildGrid() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;

      const cols = Math.ceil(width / SPACING) + 1;
      const rows = Math.ceil(height / SPACING) + 1;
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
    }

    buildGrid();

    // Seed from wherever the cursor already is — even if it's never moved on
    // this page, it may have moved earlier on another page in this session
    // (the tracker survives client-side navigation). If it truly hasn't
    // moved at all yet, start from the screen center and let the existing
    // smoothMouse easing carry the effect over once a real position arrives.
    const lastKnown = getLastKnownCursorPosition();
    mouse.x = lastKnown?.x ?? width / 2;
    mouse.y = lastKnown?.y ?? height / 2;
    smoothMouse.x = mouse.x;
    smoothMouse.y = mouse.y;

    window.addEventListener("resize", buildGrid);
    window.addEventListener("mousemove", handleMouseMove);

    let raf = 0;
    let startTime: number | null = null;

    function render(time: number) {
      if (startTime === null) startTime = time;
      const elapsed = time - startTime;
      const powerOnLinear = Math.max(0, Math.min(1, (elapsed - POWER_ON_DELAY_MS) / POWER_ON_DURATION_MS));
      const powerOnT = powerOnLinear * powerOnLinear * (3 - 2 * powerOnLinear);

      if (!reduceMotion) {
        smoothMouse.x += (mouse.x - smoothMouse.x) * SMOOTHING;
        smoothMouse.y += (mouse.y - smoothMouse.y) * SMOOTHING;
      }

      context!.setTransform(dpr, 0, 0, dpr, 0, 0);
      context!.clearRect(0, 0, width, height);

      for (const p of points) {
        let activation = 0;
        let visibility = 0;

        if (!reduceMotion) {
          const dx = p.baseX - smoothMouse.x;
          const dy = p.baseY - smoothMouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const activationRadius = ACTIVATION_RADIUS * powerOnT;

          if (dist < activationRadius) {
            const linear = 1 - dist / activationRadius;
            activation = linear * linear * (3 - 2 * linear); // smoothstep — soft edge, not a hard cutoff
          }

          const angle = Math.atan2(dy, dx);
          const visibilityRadius =
            (VISIBILITY_BASE_RADIUS +
              Math.sin(angle * 3 + 1.3) * VISIBILITY_WOBBLE_1 +
              Math.sin(angle * 5 + 0.4) * VISIBILITY_WOBBLE_2) *
            powerOnT;
          if (dist < visibilityRadius) {
            const linear = 1 - dist / visibilityRadius;
            visibility = linear * linear * (3 - 2 * linear);
          }
        }

        const radius = lerp(INACTIVE_RADIUS, ACTIVE_RADIUS, activation);
        const alpha = lerp(INACTIVE_ALPHA, ACTIVE_ALPHA, activation) * visibility;
        const r = Math.round(lerp(INACTIVE_RGB[0], ACTIVE_RGB[0], activation));
        const g = Math.round(lerp(INACTIVE_RGB[1], ACTIVE_RGB[1], activation));
        const b = Math.round(lerp(INACTIVE_RGB[2], ACTIVE_RGB[2], activation));

        context!.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        context!.beginPath();
        context!.arc(p.baseX, p.baseY, radius, 0, Math.PI * 2);
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
