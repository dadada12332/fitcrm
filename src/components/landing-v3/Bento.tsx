"use client"

import { motion } from "framer-motion"
import { Users, CreditCard, Wallet, QrCode, ShieldCheck, BarChart3, TrendingUp } from "lucide-react"
import { Reveal } from "@/components/landing/motion"

function Card({ children, className = "", i = 0 }: { children: React.ReactNode; className?: string; i?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6, transition: { type: "spring", stiffness: 300, damping: 22 } }}
      className={`v3-card v3-card-hover p-7 flex flex-col ${className}`}
    >
      {children}
    </motion.div>
  )
}

function Chip({ icon: Icon }: { icon: typeof Users }) {
  return (
    <span className="w-11 h-11 rounded-xl flex items-center justify-center v3-chip">
      <Icon className="w-5 h-5" style={{ color: "#c4b5fd" }} />
    </span>
  )
}

const bars = [42, 60, 52, 74, 68, 88]

export function Bento() {
  return (
    <section id="features" className="py-24 px-4">
      <div className="max-w-[1240px] mx-auto">
        <Reveal className="text-center mb-12">
          <h2 className="font-semibold text-white mx-auto max-w-2xl" style={{ fontSize: "clamp(30px, 4vw, 52px)", lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            Всё для клуба — <span className="v3-text-gradient">в одном продукте</span>
          </h2>
          <p className="mt-4 text-white/50 max-w-xl mx-auto">Инструменты корпоративного уровня, собранные в быстрый и красивый интерфейс.</p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Large analytics card */}
          <Card className="md:col-span-2 md:row-span-2" i={0}>
            <Chip icon={BarChart3} />
            <h3 className="mt-6 text-xl font-medium text-white">Аналитика в реальном времени</h3>
            <p className="mt-2 text-sm text-white/55 max-w-md leading-relaxed">Выручка, посещаемость, отток и продления — дашборды обновляются на лету.</p>
            <div className="mt-6 flex items-center gap-2 text-sm" style={{ color: "#a5b4fc" }}>
              <TrendingUp className="w-4 h-4" /> +23% выручки за квартал
            </div>
            <div className="mt-auto pt-6 flex items-end gap-2 h-32">
              {bars.map((h, idx) => (
                <div key={idx} className="flex-1 rounded-t-lg" style={{ height: `${h}%`, background: "linear-gradient(180deg,#8b5cf6,#2563eb)" }} />
              ))}
            </div>
          </Card>

          <Card i={1}><Chip icon={Users} /><h3 className="mt-6 text-lg font-medium text-white">Клиентская база</h3><p className="mt-2 text-sm text-white/55">Карточки, история, теги и сегменты.</p></Card>
          <Card i={2}><Chip icon={CreditCard} /><h3 className="mt-6 text-lg font-medium text-white">Абонементы</h3><p className="mt-2 text-sm text-white/55">Тарифы, продления и заморозка.</p></Card>
          <Card i={3}><Chip icon={Wallet} /><h3 className="mt-6 text-lg font-medium text-white">Онлайн-оплаты</h3><p className="mt-2 text-sm text-white/55">Payme, Click, чеки и долги.</p></Card>
          <Card i={4}><Chip icon={QrCode} /><h3 className="mt-6 text-lg font-medium text-white">QR-чекин</h3><p className="mt-2 text-sm text-white/55">Мгновенная фиксация посещений.</p></Card>
          <Card className="md:col-span-2" i={5}><Chip icon={ShieldCheck} /><h3 className="mt-6 text-lg font-medium text-white">Безопасность корпоративного уровня</h3><p className="mt-2 text-sm text-white/55 max-w-md">Шифрование данных, роли и права доступа, журнал действий и резервные копии.</p></Card>
        </div>
      </div>
    </section>
  )
}
