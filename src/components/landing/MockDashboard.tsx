"use client"

/* Pure-CSS mockup of the CRM dashboard — used inside dark bento cards.
   Looks like an app screenshot built from divs (no external assets). */

import { motion } from "framer-motion"

const bars = [42, 68, 55, 80, 60, 92, 74]

export function MockDashboard() {
  return (
    <div
      className="w-full h-full rounded-xl overflow-hidden flex text-[10px] select-none"
      style={{ background: "#0f0f0f", border: "1px solid var(--border)" }}
    >
      {/* Sidebar */}
      <div
        className="hidden sm:flex flex-col gap-3 p-3 w-12 flex-shrink-0"
        style={{ background: "#141414", borderRight: "1px solid var(--border)" }}
      >
        <div className="w-6 h-6 rounded-md" style={{ background: "var(--orange)" }} />
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-6 h-6 rounded-md"
            style={{ background: i === 0 ? "rgba(37,99,235,0.25)" : "rgba(255,255,255,0.06)" }}
          />
        ))}
      </div>

      {/* Main */}
      <div className="flex-1 p-3 flex flex-col gap-3 min-w-0">
        {/* Top stat cards */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: "1 248", c: "var(--orange)" },
            { v: "92%", c: "#22c55e" },
            { v: "₸ 4.2M", c: "#f5f5f5" },
          ].map((s, i) => (
            <div
              key={i}
              className="rounded-lg p-2"
              style={{ background: "#161616", border: "1px solid var(--border)" }}
            >
              <div className="h-1.5 w-6 rounded-full mb-1.5" style={{ background: "rgba(255,255,255,0.1)" }} />
              <div className="font-bold" style={{ color: s.c, fontSize: "12px" }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div
          className="rounded-lg p-3 flex items-end gap-1.5 flex-1"
          style={{ background: "#161616", border: "1px solid var(--border)", minHeight: "70px" }}
        >
          {bars.map((h, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end">
              <motion.div
                className="w-full rounded-t-sm"
                style={{ background: i === 5 ? "var(--orange)" : "rgba(37,99,235,0.35)" }}
                initial={{ height: "0%" }}
                whileInView={{ height: `${h}%` }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.7, delay: 0.3 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          ))}
        </div>

        {/* Table rows */}
        <div
          className="rounded-lg p-2 flex flex-col gap-1.5"
          style={{ background: "#161616", border: "1px solid var(--border)" }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: "rgba(255,255,255,0.1)" }} />
              <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.12)", width: `${50 - i * 8}%` }} />
              <div
                className="ml-auto h-3 px-2 rounded-full"
                style={{ background: i === 0 ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)", width: "28px" }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
