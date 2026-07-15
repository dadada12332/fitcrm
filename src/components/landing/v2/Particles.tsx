"use client"

import { useEffect, useRef } from "react"

interface Particle {
  x: number
  y: number
  r: number
  speed: number
  opacity: number
  drift: number
}

export function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let raf: number
    let particles: Particle[] = []

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    const spawn = (): Particle => ({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * 100,
      r: 0.8 + Math.random() * 1.6,
      speed: 0.3 + Math.random() * 0.5,
      opacity: 0.06 + Math.random() * 0.14,
      drift: (Math.random() - 0.5) * 0.2,
    })

    const init = () => {
      resize()
      particles = Array.from({ length: 60 }, () => ({
        ...spawn(),
        y: Math.random() * canvas.height,
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of particles) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${p.opacity})`
        ctx.fill()

        p.y -= p.speed
        p.x += p.drift

        if (p.y < -10) {
          Object.assign(p, spawn())
        }
      }

      raf = requestAnimationFrame(draw)
    }

    init()
    draw()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 w-full h-full"
    />
  )
}
