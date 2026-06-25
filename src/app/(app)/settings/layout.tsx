import { SettingsTabs } from "@/components/app/SettingsTabs"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-full" style={{ gap: 24 }}>
      <SettingsTabs />
      <div>{children}</div>
    </div>
  )
}
