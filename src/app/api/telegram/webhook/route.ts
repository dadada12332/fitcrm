export async function POST() {
  return Response.json(
    { error: "Legacy webhook disabled. Reconnect the club bot in FitCRM." },
    { status: 410 },
  )
}
