export function GET() {
  return Response.json({ status: "ok", release: "accounts-r1" }, { headers: { "Cache-Control": "no-store" } });
}
