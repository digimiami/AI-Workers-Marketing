"use client";

import * as React from "react";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

import { cn } from "@/lib/utils";

export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-48px" }}
      transition={{ duration: 0.52, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function HoverLift({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={cn(className)}
      whileHover={{ y: -3, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
    >
      {children}
    </motion.div>
  );
}

export function Tilt({
  children,
  className,
  maxTilt = 6,
  perspective = 900,
  hoverLift = 2,
}: {
  children: React.ReactNode;
  className?: string;
  maxTilt?: number;
  perspective?: number;
  hoverLift?: number;
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rz = useMotionValue(0);

  const sx = useSpring(mx, { stiffness: 240, damping: 22, mass: 0.8 });
  const sy = useSpring(my, { stiffness: 240, damping: 22, mass: 0.8 });
  const sz = useSpring(rz, { stiffness: 220, damping: 20, mass: 0.8 });

  const rotateX = useTransform(sy, [-0.5, 0.5], [maxTilt, -maxTilt]);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-maxTilt, maxTilt]);

  if (reduce) return <div className={className}>{children}</div>;

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    mx.set(px - 0.5);
    my.set(py - 0.5);
    rz.set((px - 0.5) * 0.9);
  }

  function onLeave() {
    mx.set(0);
    my.set(0);
    rz.set(0);
  }

  return (
    <motion.div
      ref={ref}
      className={cn("will-change-transform", className)}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      whileHover={{ y: -hoverLift }}
      style={{
        transformStyle: "preserve-3d",
        perspective,
        rotateX,
        rotateY,
        rotateZ: sz,
      }}
    >
      {children}
    </motion.div>
  );
}
