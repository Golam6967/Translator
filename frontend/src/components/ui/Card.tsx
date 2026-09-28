import { motion, HTMLMotionProps } from "framer-motion";

interface CardProps extends HTMLMotionProps<"div"> {
  hover?: boolean;
  accent?: boolean;
}

export default function Card({
  hover = false,
  accent = false,
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <motion.div
      className={`bg-surface rounded-xl shadow-card ${
        accent ? "border-l-4 border-accent" : ""
      } ${hover ? "hover:shadow-lift transition-shadow duration-300" : ""} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
