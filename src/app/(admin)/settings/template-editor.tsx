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
