import { createClient } from "@/lib/supabase/server"
import { getReportsData } from "@/lib/reports"
import { ReportsClient } from "@/components/app/ReportsClient"

export default async function ReportsPage() {
  const supabase = await createClient()
  const data = await getReportsData(supabase)
  return <ReportsClient data={data} />
}
