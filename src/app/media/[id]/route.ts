import { getCurrentStaff } from "@/lib/auth";
import { getUpload, readUploadFile } from "@/lib/uploads";

/** Product images are public. Customer files are visible only to logged-in staff. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getUpload(id);
  if (!row) return new Response("Not found", { status: 404 });
  const isPublic = row.kind === "product";
  if (!isPublic && !(await getCurrentStaff())) return new Response("Not found", { status: 404 });
  let data: Buffer;
  try {
    data = await readUploadFile(row);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(data.length),
      "Cache-Control": isPublic ? "public, max-age=31536000, immutable" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": row.mime === "application/pdf" ? `inline; filename="${row.id}.pdf"` : "inline",
    },
  });
}
