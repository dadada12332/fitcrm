import { SettingsTabs } from "@/components/app/SettingsTabs"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-full">
      <div
        className="sticky top-0 z-10 -mx-4 lg:-mx-5 px-4 lg:px-5"
        style={{ background: "var(--bg, #fafafa)", borderBottom: "1px solid var(--border)" }}
      >
        <SettingsTabs />
      </div>
      <div className="pt-6">{children}</div>
    </div>
  )
}
