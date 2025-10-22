import { Variants } from "framer-motion"

// Button animations
export const buttonVariants: Variants = {
  initial: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
}

// Modal/Drawer animations
export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.2, ease: "easeOut" }
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: { duration: 0.15, ease: "easeIn" }
  },
}

export const drawerVariants = {
  top: {
    hidden: { y: "-100%", opacity: 0 },
    visible: { y: 0, opacity: 1 },
    exit: { y: "-100%", opacity: 0 },
  },
  bottom: {
    hidden: { y: "100%", opacity: 0 },
    visible: { y: 0, opacity: 1 },
    exit: { y: "100%", opacity: 0 },
  },
  left: {
    hidden: { x: "-100%", opacity: 0 },
    visible: { x: 0, opacity: 1 },
    exit: { x: "-100%", opacity: 0 },
  },
  right: {
    hidden: { x: "100%", opacity: 0 },
    visible: { x: 0, opacity: 1 },
    exit: { x: "100%", opacity: 0 },
  },
}

// Dropdown animations
export const dropdownVariants: Variants = {
  hidden: { opacity: 0, y: -10, height: 0 },
  visible: { 
    opacity: 1, 
    y: 0,
    height: "auto",
    transition: { duration: 0.2, ease: "easeOut" }
  },
  exit: { 
    opacity: 0, 
    y: -10,
    height: 0,
    transition: { duration: 0.15, ease: "easeIn" }
  },
}

// Price change animation
export const priceChangeVariants: Variants = {
  unchanged: { scale: 1 },
  up: { 
    scale: [1, 1.05, 1],
    color: ["#ffffff", "#00c176", "#00c176"],
    transition: { duration: 0.3 }
  },
  down: { 
    scale: [1, 1.05, 1],
    color: ["#ffffff", "#ff3b30", "#ff3b30"],
    transition: { duration: 0.3 }
  },
}

// Fade in animation for lists
export const listItemVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.05, duration: 0.2 }
  }),
}

// Stagger children container
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
}

