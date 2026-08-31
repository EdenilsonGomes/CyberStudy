export function GET() {
  return Response.json({ status: "ok", release: "trail-r1" }, { headers: { "Cache-Control": "no-store" } });
}
