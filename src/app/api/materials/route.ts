import { NextResponse } from "next/server";
import { getUserDb, withOwner } from "@/db/user-db";
import { materialChunks, materials } from "@/db/schema";
import { assertStudyScope, chunkText } from "@/lib/data";
import { redirectTo, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Origem inválida", { status: 403 });
  const { db, userId } = await getUserDb();

  try {
    const form = await request.formData();
    const disciplineId = String(form.get("disciplineId") || "");
    const topicId = String(form.get("topicId") || "") || null;
    const title = String(form.get("title") || "").trim().slice(0, 160);
    const pasted = String(form.get("content") || "").trim();
    const file = form.get("file");
    if (!disciplineId || !title) throw new Error("Título e disciplina são obrigatórios");
    await assertStudyScope(disciplineId, topicId);
    let content = pasted;
    let type = "TEXTO";
    if (file instanceof File && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) throw new Error("O PDF deve ter no máximo 5 MB");
      if (file.type !== "application/pdf") throw new Error("Envie somente arquivos PDF");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("Arquivo PDF inválido");
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: bytes });
      try { content = (await parser.getText()).text.trim(); } finally { await parser.destroy(); }
      type = "PDF";
    }
    if (content.length < 20) throw new Error("Não foi possível obter texto suficiente do material");

    const [material] = await db.insert(materials).values(withOwner(userId, { disciplineId, topicId, title, type, content })).returning({ id: materials.id });
    const chunks = chunkText(content).slice(0, 250);
    await db.insert(materialChunks).values(withOwner(userId, chunks.map((chunk, position) => ({ materialId: material.id, disciplineId, topicId, position, content: chunk }))));
    return redirectTo(request, `/disciplinas/${disciplineId}?material=ok`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar material";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
