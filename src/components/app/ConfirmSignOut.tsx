"use client"

import { useState } from "react"
import { LogOut } from "lucide-react"
import { signOut } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAppLocale } from "./ClubContext"

export function ConfirmSignOut() {
  const { t } = useAppLocale()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
        aria-label={t("auth.signOut")}
        title={t("auth.signOut")}
      >
        <LogOut className="size-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="pr-8">
            <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <LogOut className="size-5" />
            </div>
            <DialogTitle className="text-lg text-foreground">{t("auth.signOutTitle")}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("auth.signOutDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 flex-col-reverse sm:flex-row">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {t("auth.stay")}
            </Button>
            <form action={signOut} className="flex-1">
              <Button type="submit" variant="destructive" className="w-full">
                <LogOut /> {t("auth.signOut")}
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
