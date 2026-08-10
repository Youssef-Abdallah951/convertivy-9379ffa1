import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

export const riseItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
};

/** Scroll-triggered fade-in + slide-up. */
export function Reveal({ children, className, delay = 0, y = 24, once = true }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount: 0.2 }}
      transition={{ duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Container that reveals its children with a stagger on scroll. */
export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
    >
      {children}
    </motion.div>
  );
}

export { motion, EASE };
