import { AppLayoutFrame } from "@/components/app/AppLayoutFrame"

export default function SupportRecoveryLayout({ children }: { children: React.ReactNode }) {
  return <AppLayoutFrame recoveryMode="support">{children}</AppLayoutFrame>
}
