import { AppLayoutFrame } from "@/components/app/AppLayoutFrame"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppLayoutFrame>{children}</AppLayoutFrame>
}
