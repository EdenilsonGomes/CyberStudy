export function GET() {
  return Response.json({ status: "ok", release: "interactive-study-r4" }, { headers: { "Cache-Control": "no-store" } });
}
