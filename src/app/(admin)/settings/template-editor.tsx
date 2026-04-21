"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import {
  updateTemplateSettingsAction,
  type UpdateTemplateInput,
} from "./template-actions";

interface Props {
  initial: UpdateTemplateInput;
}

/**
 * Form over the singleton template_settings row. Controls every fixed
 * section of a newsletter (wordmark, tagline, industryTag eyebrow,
 * description, referral CTA copy, footer links + tagline) in one place.
 *
 * {{UNSUBSCRIBE_HREF}} / {{REFERRAL_HREF}} placeholders stay intact in
 * the hrefs — they're resolved per-recipient at send time.
 */
export function TemplateEditor({ initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [msg, setMsg] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [header, setHeader] = React.useState(initial.header);
  const [referralCta, setReferralCta] = React.useState(initial.referralCta);
  const [footer, setFooter] = React.useState(initial.footer);

  function updateFooterLink(
    i: number,
    patch: Partial<{ label: string; href: string }>
  ) {
    setFooter((prev) => ({
      ...prev,
      links: prev.links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    }));
  }
  function addFooterLink() {
    setFooter((prev) => ({
      ...prev,
      links: [...prev.links, { label: "", href: "" }],
    }));
  }
  function removeFooterLink(i: number) {
    setFooter((prev) => ({
      ...prev,
      links: prev.links.filter((_, idx) => idx !== i),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await updateTemplateSettingsAction({
        header,
        referralCta,
        footer,
      });
      if (res.ok) {
        setMsg({ type: "success", text: res.message ?? "저장됨" });
        router.refresh();
      } else {
        setMsg({ type: "error", text: res.error });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-xl border border-border bg-background p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">헤더</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            뉴스레터 상단에 표시되는 브랜드 정보입니다. 업계 태그는 비워두면
            렌더링되지 않습니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="wordmark">워드마크 *</Label>
            <Input
              id="wordmark"
              value={header.wordmark}
              onChange={(e) =>
                setHeader({ ...header, wordmark: e.target.value })
              }
              disabled={pending}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tagline">태그라인</Label>
            <Input
              id="tagline"
              value={header.tagline}
              onChange={(e) => setHeader({ ...header, tagline: e.target.value })}
              disabled={pending}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="industryTag">업계 태그 (eyebrow)</Label>
          <Input
            id="industryTag"
            value={header.industryTag}
            onChange={(e) =>
              setHeader({ ...header, industryTag: e.target.value })
            }
            placeholder="예: MICE · PCO · Event Industry"
            disabled={pending}
          />
          <p className="text-[11px] text-muted-foreground">
            비워두면 헤더에서 해당 줄이 사라집니다.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">설명</Label>
          <Input
            id="description"
            value={header.description}
            onChange={(e) =>
              setHeader({ ...header, description: e.target.value })
            }
            disabled={pending}
          />
        </div>

        {/* ── Wordmark image (optional) ────────────────────── */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div>
            <Label className="text-xs font-semibold">워드마크 로고 이미지 (선택)</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              업로드하면 헤더 상단 워드마크 글자 대신 이 이미지가 렌더링됩니다.
              비워두면 위에서 설정한 텍스트 워드마크가 표시됩니다.
            </p>
          </div>
          <WordmarkLogoField
            value={header.wordmarkLogoUrl ?? null}
            height={header.wordmarkLogoHeight ?? null}
            onChangeUrl={(url) =>
              setHeader({ ...header, wordmarkLogoUrl: url })
            }
            onChangeHeight={(h) =>
              setHeader({ ...header, wordmarkLogoHeight: h })
            }
            disabled={pending}
          />
        </div>

        {/* ── Wordmark fine-tuning ─────────────────────────── */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div>
            <Label className="text-xs font-semibold">워드마크 세부 스타일</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              글자 수에 따라 자동으로 조절되지만, 원하는 크기·색상이 있으면 아래에
              입력하세요. 비워두면 자동으로 처리됩니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label
                htmlFor="wordmarkFontSize"
                className="text-xs text-muted-foreground"
              >
                글자 크기 (px, 10~120)
              </Label>
              <Input
                id="wordmarkFontSize"
                type="number"
                min={10}
                max={120}
                step={1}
                value={header.wordmarkFontSize ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setHeader({
                    ...header,
                    wordmarkFontSize:
                      v === "" ? null : Math.max(10, Math.min(120, Number(v))),
                  });
                }}
                disabled={pending}
                placeholder="자동"
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="wordmarkColor"
                className="text-xs text-muted-foreground"
              >
                글자 색상
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={
                    header.wordmarkColor && header.wordmarkColor.startsWith("#")
                      ? header.wordmarkColor
                      : "#000000"
                  }
                  onChange={(e) =>
                    setHeader({ ...header, wordmarkColor: e.target.value })
                  }
                  disabled={pending}
                  className="h-9 w-10 rounded border border-border cursor-pointer shrink-0 p-0.5"
                  aria-label="색상 선택"
                />
                <Input
                  id="wordmarkColor"
                  value={header.wordmarkColor ?? ""}
                  onChange={(e) =>
                    setHeader({
                      ...header,
                      wordmarkColor: e.target.value || null,
                    })
                  }
                  disabled={pending}
                  placeholder="#111111 (비워두면 기본 색)"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label
                htmlFor="wordmarkFontWeight"
                className="text-xs text-muted-foreground"
              >
                글자 굵기 (100~900)
              </Label>
              <Input
                id="wordmarkFontWeight"
                type="number"
                min={100}
                max={900}
                step={100}
                value={header.wordmarkFontWeight ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setHeader({
                    ...header,
                    wordmarkFontWeight:
                      v === "" ? null : Math.max(100, Math.min(900, Number(v))),
                  });
                }}
                disabled={pending}
                placeholder="자동 (기본 900)"
              />
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="wordmarkLetterSpacing"
                className="text-xs text-muted-foreground"
              >
                자간 (px, 음수 가능)
              </Label>
              <Input
                id="wordmarkLetterSpacing"
                type="number"
                step={0.5}
                value={header.wordmarkLetterSpacing ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setHeader({
                    ...header,
                    wordmarkLetterSpacing: v === "" ? null : Number(v),
                  });
                }}
                disabled={pending}
                placeholder="자동 (기본 -1)"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setHeader({
                ...header,
                wordmarkFontSize: null,
                wordmarkColor: null,
                wordmarkFontWeight: null,
                wordmarkLetterSpacing: null,
              })
            }
            disabled={pending}
            className="text-[11px] text-muted-foreground hover:text-foreground underline"
          >
            네 개 모두 자동으로 되돌리기
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-background p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">추천 CTA</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            헤더 아래 추천 섹션에 표시되는 메시지와 버튼입니다.
            <code className="ml-1 px-1 py-0.5 rounded bg-muted font-mono text-[10px]">
              {"{{REFERRAL_HREF}}"}
            </code>
            는 수신자별 고유 링크로 자동 치환됩니다.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cta-message">메시지</Label>
          <Textarea
            id="cta-message"
            value={referralCta.message}
            onChange={(e) =>
              setReferralCta({ ...referralCta, message: e.target.value })
            }
            rows={3}
            disabled={pending}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="cta-label">버튼 라벨 *</Label>
            <Input
              id="cta-label"
              value={referralCta.buttonLabel}
              onChange={(e) =>
                setReferralCta({
                  ...referralCta,
                  buttonLabel: e.target.value,
                })
              }
              disabled={pending}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cta-href">버튼 URL</Label>
            <Input
              id="cta-href"
              value={referralCta.buttonHref}
              onChange={(e) =>
                setReferralCta({ ...referralCta, buttonHref: e.target.value })
              }
              disabled={pending}
              placeholder="{{REFERRAL_HREF}}"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-background p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">푸터</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            푸터에 노출할 브랜드 정보와 외부 링크입니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="brandName">브랜드명</Label>
            <Input
              id="brandName"
              value={footer.brandName}
              onChange={(e) =>
                setFooter({ ...footer, brandName: e.target.value })
              }
              disabled={pending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="brandTagline">브랜드 태그라인</Label>
            <Input
              id="brandTagline"
              value={footer.brandTagline}
              onChange={(e) =>
                setFooter({ ...footer, brandTagline: e.target.value })
              }
              disabled={pending}
            />
          </div>
        </div>

        {/* ── Footer logo (optional) ───────────────────────── */}
        <div className="space-y-3 pt-4 border-t border-border">
          <div>
            <Label className="text-xs font-semibold">푸터 로고 이미지</Label>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              이메일 하단에 표시되는 로고입니다. 업로드하지 않으면 기본
              <code className="mx-1 px-1 py-0.5 rounded bg-muted font-mono text-[10px]">
                /logo.png
              </code>
              가 사용됩니다.
            </p>
          </div>
          <FooterLogoField
            value={footer.logoSrc ?? null}
            width={footer.logoWidth ?? null}
            onChangeUrl={(url) => setFooter({ ...footer, logoSrc: url })}
            onChangeWidth={(w) => setFooter({ ...footer, logoWidth: w })}
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>링크 ({footer.links.length}개)</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addFooterLink}
              disabled={pending || footer.links.length >= 10}
            >
              + 링크 추가
            </Button>
          </div>
          <div className="space-y-2">
            {footer.links.map((link, i) => (
              <div key={i} className="flex gap-2 items-start">
                <Input
                  placeholder="라벨"
                  value={link.label}
                  onChange={(e) =>
                    updateFooterLink(i, { label: e.target.value })
                  }
                  disabled={pending}
                  className="w-40"
                />
                <Input
                  placeholder="https://…"
                  value={link.href}
                  onChange={(e) =>
                    updateFooterLink(i, { href: e.target.value })
                  }
                  disabled={pending}
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFooterLink(i)}
                  disabled={pending}
                  className="text-rose-600"
                >
                  제거
                </Button>
              </div>
            ))}
            {footer.links.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                링크가 없습니다. &quot;링크 추가&quot;로 등록하세요.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="unsubscribeHref">구독 해지 URL</Label>
          <Input
            id="unsubscribeHref"
            value={footer.unsubscribeHref}
            onChange={(e) =>
              setFooter({ ...footer, unsubscribeHref: e.target.value })
            }
            disabled={pending}
            placeholder="{{UNSUBSCRIBE_HREF}}"
          />
          <p className="text-[11px] text-muted-foreground">
            <code className="px-1 py-0.5 rounded bg-muted font-mono">
              {"{{UNSUBSCRIBE_HREF}}"}
            </code>
            는 수신자별 고유 링크로 자동 치환됩니다.
          </p>
        </div>
      </section>

      {msg && (
        <div
          className={
            msg.type === "success"
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
              : "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 whitespace-pre-wrap"
          }
        >
          {msg.text}
        </div>
      )}

      <div className="flex gap-2 sticky bottom-0 py-3 bg-muted/30 border-t border-border">
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중..." : "템플릿 저장"}
        </Button>
        <p className="text-xs text-muted-foreground self-center">
          저장 시 아직 발송되지 않은 초안에도 자동 반영됩니다. (각 호의 &quot;호 번호&quot;는 유지. 발송 완료된 호는 변경되지 않음)
        </p>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────
// Wordmark logo upload field
// Uploads via /api/uploads/image (shared with block images). The
// returned URL flows into the parent form state; actual persistence
// to template_settings happens when the admin clicks 템플릿 저장.
// ─────────────────────────────────────────────
function WordmarkLogoField({
  value,
  height,
  onChangeUrl,
  onChangeHeight,
  disabled,
}: {
  value: string | null;
  height: number | null;
  onChangeUrl: (next: string | null) => void;
  onChangeHeight: (next: number | null) => void;
  disabled?: boolean;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/image", {
        method: "POST",
        body: fd,
      });
      const body = (await res.json()) as
        | { ok: true; url: string }
        | { ok: false; error: string };
      if (!res.ok || !body.ok) {
        setError(("error" in body && body.error) || `업로드 실패 (HTTP ${res.status})`);
        return;
      }
      onChangeUrl(body.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`업로드 실패: ${msg}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="space-y-2">
          <div className="rounded-lg border border-border bg-muted/20 p-4 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="로고 미리보기"
              style={{
                display: "block",
                height: `${height ?? 64}px`,
                width: "auto",
                maxWidth: "100%",
              }}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Label
              htmlFor="wordmarkLogoHeight"
              className="text-xs text-muted-foreground"
            >
              이미지 높이 (px, 16~200)
            </Label>
            <Input
              id="wordmarkLogoHeight"
              type="number"
              min={16}
              max={200}
              step={2}
              value={height ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onChangeHeight(
                  v === "" ? null : Math.max(16, Math.min(200, Number(v)))
                );
              }}
              disabled={disabled}
              placeholder="64"
              className="w-24"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || disabled}
            >
              {uploading ? "업로드 중..." : "다른 이미지로 교체"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-rose-600"
              onClick={() => {
                onChangeUrl(null);
                onChangeHeight(null);
              }}
              disabled={uploading || disabled}
            >
              로고 제거
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            이 필드가 채워져 있는 한, 위의 텍스트 워드마크 스타일(글자
            크기/색상 등)은 무시됩니다. 텍스트로 다시 돌아가려면 &quot;로고 제거&quot;를
            누르세요.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || disabled}
          className="w-full rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 text-center hover:bg-muted/40 transition disabled:opacity-50"
        >
          <div className="text-sm text-muted-foreground">
            {uploading ? (
              <>업로드 중…</>
            ) : (
              <>
                <div className="text-lg mb-1">🖼️</div>
                <div className="font-medium">로고 업로드</div>
                <div className="text-xs mt-1">
                  PNG · JPEG · WebP (투명 배경 PNG 권장)
                </div>
              </>
            )}
          </div>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFile}
        className="hidden"
      />
      {error && (
        <p className="text-xs text-rose-600 whitespace-pre-wrap">{error}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Footer logo upload field. Same upload plumbing as the wordmark logo,
// but sized by width rather than height because the footer layout
// budgets a fixed column width for the brand block.
// ─────────────────────────────────────────────
function FooterLogoField({
  value,
  width,
  onChangeUrl,
  onChangeWidth,
  disabled,
}: {
  value: string | null;
  width: number | null;
  onChangeUrl: (next: string | null) => void;
  onChangeWidth: (next: number | null) => void;
  disabled?: boolean;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/image", {
        method: "POST",
        body: fd,
      });
      const body = (await res.json()) as
        | { ok: true; url: string }
        | { ok: false; error: string };
      if (!res.ok || !body.ok) {
        setError(("error" in body && body.error) || `업로드 실패 (HTTP ${res.status})`);
        return;
      }
      onChangeUrl(body.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`업로드 실패: ${msg}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="space-y-2">
          <div className="rounded-lg border border-border bg-muted/20 p-4 flex items-center justify-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="푸터 로고 미리보기"
              style={{
                display: "block",
                width: `${width ?? 160}px`,
                height: "auto",
                maxWidth: "100%",
              }}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Label
              htmlFor="footerLogoWidth"
              className="text-xs text-muted-foreground"
            >
              이미지 너비 (px, 40~320)
            </Label>
            <Input
              id="footerLogoWidth"
              type="number"
              min={40}
              max={320}
              step={4}
              value={width ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onChangeWidth(
                  v === "" ? null : Math.max(40, Math.min(320, Number(v)))
                );
              }}
              disabled={disabled}
              placeholder="160"
              className="w-24"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || disabled}
            >
              {uploading ? "업로드 중..." : "다른 이미지로 교체"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-rose-600"
              onClick={() => {
                onChangeUrl(null);
                onChangeWidth(null);
              }}
              disabled={uploading || disabled}
            >
              로고 제거
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            제거하면 기본 /logo.png 로 돌아갑니다.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || disabled}
          className="w-full rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 text-center hover:bg-muted/40 transition disabled:opacity-50"
        >
          <div className="text-sm text-muted-foreground">
            {uploading ? (
              <>업로드 중…</>
            ) : (
              <>
                <div className="text-lg mb-1">🖼️</div>
                <div className="font-medium">푸터 로고 업로드</div>
                <div className="text-xs mt-1">
                  PNG · JPEG · WebP (투명 배경 PNG 권장)
                </div>
              </>
            )}
          </div>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFile}
        className="hidden"
      />
      {error && (
        <p className="text-xs text-rose-600 whitespace-pre-wrap">{error}</p>
      )}
    </div>
  );
}
