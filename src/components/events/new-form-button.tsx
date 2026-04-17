"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  FORM_KINDS,
  FORM_KIND_LABELS,
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  type FieldType,
  type FormField,
  type FormKind,
} from "@/lib/validation/form";
import { createFormAction } from "@/app/(admin)/events/actions";

function makeFieldId() {
  return Math.random().toString(36).slice(2, 10);
}

const DEFAULT_FIELDS: FormField[] = [
  { id: makeFieldId(), label: "응답", type: "textarea", required: true },
];

export function NewFormButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [kind, setKind] = React.useState<FormKind>("feedback");
  const [successMessage, setSuccessMessage] = React.useState("");
  const [fields, setFields] = React.useState<FormField[]>(DEFAULT_FIELDS);

  function reset() {
    setTitle("");
    setDescription("");
    setKind("feedback");
    setSuccessMessage("");
    setFields(DEFAULT_FIELDS);
    setError(null);
  }

  function addField() {
    setFields((prev) => [
      ...prev,
      { id: makeFieldId(), label: "새 질문", type: "text" },
    ]);
  }

  function updateField(i: number, patch: Partial<FormField>) {
    setFields((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  function removeField(i: number) {
    setFields((prev) => prev.filter((_, idx) => idx !== i));
  }

  function moveField(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    setFields((prev) => {
      const next = [...prev];
      const [m] = next.splice(i, 1);
      next.splice(j, 0, m);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createFormAction({
        title,
        description: description || null,
        kind,
        fields,
        successMessage: successMessage || null,
      });
      if (res.ok && res.data?.id) {
        setOpen(false);
        reset();
        router.push(`/events/${res.data.id}` as never);
      } else if (!res.ok) {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ 새 폼 만들기</Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) reset();
        }}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>새 폼 만들기</DialogTitle>
            <DialogDescription>
              뉴스레터에 삽입할 이벤트 신청 · 의견 수집 폼을 설계합니다.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="form-title">제목 *</Label>
              <Input
                id="form-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="예: 4월 웨비나 신청"
                disabled={pending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="form-description">설명 (선택)</Label>
              <Textarea
                id="form-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="폼 페이지 상단에 표시되는 안내 문구"
                disabled={pending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="form-kind">유형</Label>
              <Select
                id="form-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as FormKind)}
                disabled={pending}
              >
                {FORM_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {FORM_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            </div>

            <div className="border-t border-border pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label>필드 *</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addField}
                  disabled={pending}
                >
                  + 필드 추가
                </Button>
              </div>
              <div className="space-y-2">
                {fields.map((f, i) => (
                  <div
                    key={f.id}
                    className="rounded-lg border border-border bg-background p-3 space-y-2"
                  >
                    <div className="flex gap-2 items-start">
                      <Input
                        value={f.label}
                        onChange={(e) =>
                          updateField(i, { label: e.target.value })
                        }
                        placeholder="질문 / 라벨"
                        disabled={pending}
                        className="flex-1"
                      />
                      <Select
                        value={f.type}
                        onChange={(e) =>
                          updateField(i, { type: e.target.value as FieldType })
                        }
                        disabled={pending}
                        className="w-32"
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {FIELD_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {f.type === "choice" && (
                      <Textarea
                        value={(f.choices ?? []).join("\n")}
                        onChange={(e) =>
                          updateField(i, {
                            choices: e.target.value
                              .split("\n")
                              .map((c) => c.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="선택지 한 줄에 하나씩"
                        rows={3}
                        disabled={pending}
                        className="text-xs"
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={f.required ?? false}
                          onChange={(e) =>
                            updateField(i, { required: e.target.checked })
                          }
                          disabled={pending}
                          className="h-3.5 w-3.5"
                        />
                        필수
                      </label>
                      <div className="ml-auto flex gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => moveField(i, -1)}
                          disabled={pending || i === 0}
                          className="h-7 w-7 text-xs"
                        >
                          ↑
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => moveField(i, 1)}
                          disabled={pending || i === fields.length - 1}
                          className="h-7 w-7 text-xs"
                        >
                          ↓
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeField(i)}
                          disabled={pending || fields.length === 1}
                          className="h-7 w-7 text-rose-600 text-xs"
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="form-success">제출 완료 메시지 (선택)</Label>
              <Input
                id="form-success"
                value={successMessage}
                onChange={(e) => setSuccessMessage(e.target.value)}
                placeholder="예: 신청해 주셔서 감사합니다. 확인 메일을 보내드릴게요."
                disabled={pending}
              />
            </div>

            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 whitespace-pre-wrap">
                {error}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "생성 중..." : "폼 만들기"}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  );
}
