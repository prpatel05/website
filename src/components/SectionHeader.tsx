import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  label: string;
  titleLeft: string;
  titleRight: string;
  titleRightClass?: string;
  children?: ReactNode;
}

const SectionHeader = ({
  label,
  titleLeft,
  titleRight,
  titleRightClass = "text-primary text-glow",
  children,
}: SectionHeaderProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    whileInView={{ opacity: 1 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6 }}
  >
    <span className="font-mono text-xs text-primary/60 tracking-widest block mb-2">
      {label}
    </span>
    {children ?? (
      <h2 className="font-display text-3xl sm:text-4xl lg:text-6xl font-bold">
        <span className="text-foreground">{titleLeft}</span>{" "}
        <span className={titleRightClass}>{titleRight}</span>
      </h2>
    )}
  </motion.div>
);

export default SectionHeader;
