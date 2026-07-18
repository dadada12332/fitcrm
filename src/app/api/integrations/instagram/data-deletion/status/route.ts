export async function GET() {
  return Response.json({ status: "completed" }, { headers: { "Cache-Control": "no-store" } })
}
