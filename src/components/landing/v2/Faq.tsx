"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, X } from "lucide-react"
import { useT } from "@/lib/i18n/context"

const ease = [0.16, 1, 0.3, 1] as const

export function Faq() {
  const t = useT()
  const faqs = t.faq.items
  const [open, setOpen] = useState<string | null>(null)

  return (
    <section id="faq" className="py-24 md:py-32" style={{ background: "#ffffff" }}>
      <div className="mx-auto max-w-[1200px] px-6">
        <motion.h2
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.6, ease }}
          className="text-[40px] md:text-[52px] font-normal tracking-[-1.4px] text-[#0a0a0a] leading-[1.05] mb-14 md:mb-16">
          {t.faq.title}
        </motion.h2>

        <div style={{ borderTop: "1px solid rgba(0,0,0,0.1)" }}>
          {faqs.map((f) => {
            const isOpen = open === f.q
            return (
              <div key={f.q} style={{ borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
                <button onClick={() => setOpen(isOpen ? null : f.q)}
                  className="group flex w-full items-center justify-between gap-6 py-7 text-left">
                  <span className="text-[20px] md:text-[26px] font-medium leading-[1.2] transition-colors"
                    style={{ color: isOpen ? "#0a0a0a" : "#18181b" }}>
                    {f.q}
                  </span>
                  <span className="shrink-0 transition-colors" style={{ color: "#0a0a0a" }}>
                    {isOpen ? <X className="w-6 h-6" strokeWidth={1.5} /> : <Plus className="w-6 h-6 opacity-70 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease }}
                      className="overflow-hidden">
                      <div className="md:pl-[50%] pb-9 pr-2 md:pr-10">
                        <p className="text-[15px] md:text-[16px] leading-[1.65]" style={{ color: "#52525b" }}>{f.a}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
