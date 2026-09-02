import { m } from "framer-motion";
import type { ReactNode } from "react";
import { useEntrance, useEntranceGate } from "@/hooks/useEntrance";

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
}: SectionHeaderProps) => {
  const entrance = useEntrance();
  // `children` is where a caller puts a link — `ls ./posts` lives in this
  // header on the blog section — so the header fades interactive content in
  // and needs the same gate the cards do.
  const gate = useEntranceGate();

  return (
    <m.div
      {...gate}
      initial={entrance({ opacity: 0 })}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <span className="font-mono text-xs text-primary/60 print:text-primary tracking-widest block mb-2">
        {label}
      </span>
      {children ?? (
        <h2 className="font-display text-3xl sm:text-4xl lg:text-6xl font-bold">
          <span className="text-foreground">{titleLeft}</span>{" "}
          <span className={titleRightClass}>{titleRight}</span>
        </h2>
      )}
    </m.div>
  );
};

export default SectionHeader;
