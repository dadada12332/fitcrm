import { PlatformLoginForm } from "@/components/platform/PlatformLoginForm"

// Динамическая страница: статический prerender ломает Set-Cookie при redirect
// из server action (Vercel вырезает куки на закешированном роуте).
export const dynamic = "force-dynamic"

export default function PlatformLoginPage() {
  return <PlatformLoginForm />
}
