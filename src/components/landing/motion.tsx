"use client"

import * as React from "react"
import { motion } from "framer-motion"

const EASE = [0.16, 1, 0.3, 1] as const

/** Плавный blur-reveal при въезде в вьюпорт (как на референсе). */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/** Карточка с плавным hover-подъёмом (spring). */
export function HoverCard({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24, filter: "blur(10px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      whileHover={{ y: -6, transition: { type: "spring", stiffness: 300, damping: 22 } }}
    >
      {children}
    </motion.div>
  )
}

/** Бесконечная лента (marquee). Дублирует детей для бесшовного цикла. */
export function Marquee({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`marquee ${className ?? ""}`}>
      <div className="marquee-track">
        <div className="flex items-center shrink-0">{children}</div>
        <div className="flex items-center shrink-0" aria-hidden>{children}</div>
      </div>
    </div>
  )
}
