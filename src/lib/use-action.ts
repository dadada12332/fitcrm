"use client"

import { toast } from "sonner"

type ActionResult = { error?: string | null } | void | null | undefined

/**
 * Единый раннер серверных экшенов: тост загрузки → успех/ошибка, откат опциональный.
 * Возвращает результат экшена (или null при исключении).
 *
 *   await runAction(() => createClientAction({}, fd), {
 *     loading: "Создаём клиента…",
 *     success: "Клиент создан",
 *     onSuccess: () => router.refresh(),
 *     rollback: () => setOptimistic(prev),   // если был оптимистичный апдейт
 *   })
 */
export async function runAction<T extends ActionResult>(
  fn: () => Promise<T>,
  opts: {
    loading?: string
    success?: string | ((res: T) => string)
    error?: string
    onSuccess?: (res: T) => void
    onError?: (msg: string) => void
    rollback?: () => void
  } = {},
): Promise<T | null> {
  const id = opts.loading ? toast.loading(opts.loading) : undefined
  try {
    const res = await fn()
    const errMsg = res && typeof res === "object" && "error" in res ? res.error : null
    if (errMsg) {
      opts.rollback?.()
      toast.error(errMsg, { id })
      opts.onError?.(errMsg)
      return res
    }
    if (opts.success) {
      const msg = typeof opts.success === "function" ? opts.success(res) : opts.success
      toast.success(msg, { id })
    } else if (id) {
      toast.dismiss(id)
    }
    opts.onSuccess?.(res)
    return res
  } catch (e) {
    opts.rollback?.()
    const msg = opts.error ?? (e instanceof Error ? e.message : "Что-то пошло не так")
    toast.error(msg, { id })
    opts.onError?.(msg)
    return null
  }
}

export { toast }
