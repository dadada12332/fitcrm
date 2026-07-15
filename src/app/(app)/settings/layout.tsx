// All settings are rendered by /settings/page.tsx as a single RSC.
// Sub-routes (/settings/club, /settings/security, ...) redirect here.
// This layout is just a pass-through.
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
