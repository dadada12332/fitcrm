import { AppLayoutFrame } from "@/components/app/AppLayoutFrame"

export default function SubscriptionRecoveryLayout({ children }: { children: React.ReactNode }) {
  return <AppLayoutFrame recoveryMode="subscription">{children}</AppLayoutFrame>
}
