"use client"

import { useState } from "react"
import { LogOut } from "lucide-react"
import { signOut } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function ConfirmSignOut() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
        aria-label="Выйти из аккаунта"
        title="Выйти"
      >
        <LogOut className="size-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="pr-8">
            <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <LogOut className="size-5" />
            </div>
            <DialogTitle className="text-lg text-foreground">Выйти из аккаунта?</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Для продолжения работы потребуется снова ввести данные для входа.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 flex-col-reverse sm:flex-row">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Остаться
            </Button>
            <form action={signOut} className="flex-1">
              <Button type="submit" variant="destructive" className="w-full">
                <LogOut /> Выйти
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
