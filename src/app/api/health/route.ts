export function GET() {
  return Response.json({ status: "ok", release: "interactive-study-r2" }, { headers: { "Cache-Control": "no-store" } });
}
