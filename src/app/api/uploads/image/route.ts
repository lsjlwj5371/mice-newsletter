import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/uploads/image
 *
 * Multipart/form-data:
 *   file          : the uploaded image (png/jpeg/webp/gif)
 *   newsletterId? : optional — tie the upload to a specific draft so
 *                   orphan-cleanup can scope by newsletter
 *
 * Returns: { ok: true, url, path, width, height, bytes, mimeType }
 *
 * Pipeline:
 *  1. requireAdmin (auth)
 *  2. read file from form
 *  3. reject non-image or files > 10 MB (hard sanity check; bucket has 5 MB
 *     limit too but we want a clean error before pipelining into sharp)
 *  4. sharp → resize to max 640px wide, strip metadata, re-encode as webp
 *     (modern, small) with jpeg fallback for gifs
 *  5. upload to Supabase Storage `newsletter-images` bucket
 *  6. insert into image_assets
 *  7. audit log
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB incoming
const TARGET_WIDTH = 640; // matches email container width
// Full-bleed hero (MICE Insight) — resized WIDER (1280px) so the
// image stays crisp on HiDPI screens, but aspect is preserved so
// whatever the admin uploaded is what the reader sees. Previous
// version force-cropped to 2:1; the hero now renders at natural
// aspect so no cropping is needed.
const HERO_WIDTH = 1280;
const ACCEPTED_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();

  // Parse multipart
  const form = await req.formData();
  const file = form.get("file");
  const newsletterId =
    typeof form.get("newsletterId") === "string"
      ? (form.get("newsletterId") as string)
      : null;
  // `variant=hero` pre-crops to 2:1 for the MICE Insight full-bleed
  // layout. Everything else uses the default aspect-preserving resize.
  const variant =
    typeof form.get("variant") === "string"
      ? (form.get("variant") as string)
      : null;
  const isHero = variant === "hero";

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "파일을 첨부해 주세요." },
      { status: 400 }
    );
  }

  if (!(ACCEPTED_MIMES as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      {
        ok: false,
        error: `지원하지 않는 파일 형식입니다: ${file.type}. PNG/JPEG/WebP/GIF만 허용됩니다.`,
      },
      { status: 400 }
    );
  }

  if (file.size > MAX_INPUT_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: `파일 크기가 너무 큽니다. 최대 ${Math.floor(
          MAX_INPUT_BYTES / 1024 / 1024
        )}MB까지 업로드 가능합니다.`,
      },
      { status: 400 }
    );
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  // Process with sharp
  let outputBuffer: Buffer;
  let outputMime: string;
  let width: number;
  let height: number;
  try {
    const img = sharp(inputBuffer, { animated: file.type === "image/gif" });
    const meta = await img.metadata();

    // Resize to target width only if the source is wider; preserve aspect.
    const needsResize = (meta.width ?? 0) > TARGET_WIDTH;

    if (file.type === "image/gif") {
      // Keep gifs as gifs to preserve animation.
      const heroNeedsResize = isHero && (meta.width ?? 0) > HERO_WIDTH;
      const pipeline = isHero
        ? heroNeedsResize
          ? img.resize({ width: HERO_WIDTH, withoutEnlargement: true })
          : img
        : needsResize
        ? img.resize({ width: TARGET_WIDTH, withoutEnlargement: true })
        : img;
      outputBuffer = await pipeline.gif().toBuffer();
      outputMime = "image/gif";
    } else {
      // Everything else → webp for best email compression (Gmail/Apple
      // Mail/Outlook all support webp since 2022+). Hero keeps the
      // source's natural aspect — just widens the max to 1280px so
      // full-bleed shots don't look soft on HiDPI.
      const heroNeedsResize = isHero && (meta.width ?? 0) > HERO_WIDTH;
      const pipeline = isHero
        ? heroNeedsResize
          ? img.resize({ width: HERO_WIDTH, withoutEnlargement: true })
          : img
        : needsResize
        ? img.resize({ width: TARGET_WIDTH, withoutEnlargement: true })
        : img;
      outputBuffer = await pipeline
        .rotate() // respect EXIF orientation
        .webp({ quality: 82 })
        .toBuffer();
      outputMime = "image/webp";
    }

    const outMeta = await sharp(outputBuffer).metadata();
    width = outMeta.width ?? 0;
    height = outMeta.height ?? 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: `이미지 처리 실패: ${msg}` },
      { status: 500 }
    );
  }

  // Upload to Storage
  const ext = outputMime === "image/gif" ? "gif" : "webp";
  const path = `${admin.id}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const supabase = createAdminClient();
  const { error: uploadErr } = await supabase.storage
    .from("newsletter-images")
    .upload(path, outputBuffer, {
      contentType: outputMime,
      cacheControl: "31536000", // 1 year; we only serve this URL in sent emails
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json(
      { ok: false, error: `업로드 실패: ${uploadErr.message}` },
      { status: 500 }
    );
  }

  const { data: publicUrl } = supabase.storage
    .from("newsletter-images")
    .getPublicUrl(path);

  // Record the asset
  const { error: insertErr } = await supabase.from("image_assets").insert({
    path,
    public_url: publicUrl.publicUrl,
    mime_type: outputMime,
    bytes: outputBuffer.length,
    width,
    height,
    newsletter_id: newsletterId,
    uploaded_by: admin.id,
  });

  if (insertErr) {
    // Best-effort cleanup of the orphan blob
    await supabase.storage.from("newsletter-images").remove([path]);
    return NextResponse.json(
      { ok: false, error: `기록 저장 실패: ${insertErr.message}` },
      { status: 500 }
    );
  }

  await logAudit({
    adminId: admin.id,
    action: "image.upload",
    entity: "image",
    entityId: path,
    metadata: { bytes: outputBuffer.length, mimeType: outputMime, newsletterId },
  });

  return NextResponse.json({
    ok: true,
    url: publicUrl.publicUrl,
    path,
    width,
    height,
    bytes: outputBuffer.length,
    mimeType: outputMime,
  });
}
