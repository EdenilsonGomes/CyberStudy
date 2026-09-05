export function GET() {
  return Response.json({ status: "ok", release: "copilot-r1" }, { headers: { "Cache-Control": "no-store" } });
}
