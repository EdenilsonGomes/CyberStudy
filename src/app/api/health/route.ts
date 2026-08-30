export function GET() {
  return Response.json({ status: "ok", release: "interactive-study-r5" }, { headers: { "Cache-Control": "no-store" } });
}
