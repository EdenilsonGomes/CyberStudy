export function GET() {
  return Response.json({ status: "ok", release: "interactive-study-r6" }, { headers: { "Cache-Control": "no-store" } });
}
