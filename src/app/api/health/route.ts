export function GET() {
  return Response.json({ status: "ok", release: "interactive-study-r3" }, { headers: { "Cache-Control": "no-store" } });
}
