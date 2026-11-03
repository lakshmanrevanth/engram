'use client';

import { MotionConfig } from 'motion/react';

/**
 * Makes every motion/react animation on the landing pages respect the
 * user's prefers-reduced-motion setting: transform/layout animations are
 * skipped, opacity/colour fades still run.
 */
export function LandingMotionConfig({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
