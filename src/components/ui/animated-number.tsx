"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";

export function AnimatedNumber({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const motionValue = useMotionValue(0);
  const text = useTransform(motionValue, (v) =>
    `${v.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: decimals })}${suffix}`,
  );

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [motionValue, value]);

  return <motion.span className="tabular-nums">{text}</motion.span>;
}
