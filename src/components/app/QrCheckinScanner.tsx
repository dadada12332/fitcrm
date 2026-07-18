"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Camera, CheckCircle2, ScanLine, X } from "lucide-react"
import type QrScanner from "qr-scanner"
import { qrCheckInAction } from "@/app/(app)/visits/actions"
import { Button } from "@/components/ui/button"

type Result = { ok: boolean; text: string }

export function QrCheckinScanner() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const handledRef = useRef(false)
  const [open, setOpen] = useState(false)
  const [cameraError, setCameraError] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!open || !videoRef.current) return
    let cancelled = false

    async function startScanner() {
      const { default: Scanner } = await import("qr-scanner")
      if (cancelled || !videoRef.current) return
      handledRef.current = false
      const scanner = new Scanner(
        videoRef.current,
        (scan) => {
          if (handledRef.current) return
          handledRef.current = true
          scanner.stop()
          startTransition(async () => {
            const response = await qrCheckInAction(scan.data)
            setResult({
              ok: !!response.ok,
              text: response.error
                ? `${response.clientName ? `${response.clientName}: ` : ""}${response.error}`
                : `${response.clientName}: посещение отмечено${response.warning ? `. ${response.warning}` : ""}`,
            })
          })
        },
        { preferredCamera: "environment", highlightScanRegion: true, highlightCodeOutline: true },
      )
      scannerRef.current = scanner
      try {
        await scanner.start()
      } catch {
        setCameraError("Не удалось открыть камеру. Разрешите доступ к камере в настройках браузера.")
      }
    }

    startScanner()
    return () => {
      cancelled = true
      scannerRef.current?.destroy()
      scannerRef.current = null
    }
  }, [open])

  function close() {
    scannerRef.current?.stop()
    setOpen(false)
    setResult(null)
    setCameraError("")
  }

  function scanNext() {
    setResult(null)
    setCameraError("")
    handledRef.current = false
    scannerRef.current?.start().catch(() => setCameraError("Не удалось снова открыть камеру."))
  }

  return (
    <>
      <Button type="button" variant="outline" size="lg" onClick={() => setOpen(true)}>
        <ScanLine /> Сканировать QR
      </Button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="QR-чекин">
          <div className="w-full max-w-md overflow-hidden rounded-t-lg border border-border bg-card shadow-xl sm:rounded-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="font-semibold text-foreground">QR-чекин</p>
                <p className="text-xs text-muted-foreground">Наведите камеру на код клиента из Telegram</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={close} aria-label="Закрыть">
                <X />
              </Button>
            </div>

            <div className="relative aspect-square bg-black">
              <video ref={videoRef} className="size-full object-cover" muted playsInline />
              {!cameraError && !result && (
                <div className="pointer-events-none absolute inset-10 rounded-lg border-2 border-white/80" />
              )}
              {pending && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-medium text-white">
                  Проверяю абонемент...
                </div>
              )}
              {(cameraError || result) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card p-8 text-center">
                  {result?.ok ? <CheckCircle2 className="size-10 text-chart-2" /> : <Camera className="size-10 text-muted-foreground" />}
                  <p className={result?.ok ? "text-sm font-medium text-foreground" : "text-sm text-destructive"}>
                    {result?.text || cameraError}
                  </p>
                  {result && <Button type="button" onClick={scanNext}>Сканировать следующий</Button>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
