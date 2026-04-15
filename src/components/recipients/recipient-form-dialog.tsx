"use client";

import * as React from "react";
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
  RECIPIENT_STATUSES,
  RECIPIENT_SOURCES,
  STATUS_LABELS,
  SOURCE_LABELS,
  type Recipient,
} from "@/lib/validation/recipient";
import {
  createRecipientAction,
  updateRecipientAction,
  type ActionResult,
} from "@/app/(admin)/recipients/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Provided when editing; omit when creating. */
  recipient?: Recipient | null;
}

export function RecipientFormDialog({ open, onOpenChange, recipient }: Props) {
  const isEdit = !!recipient;
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<
    Record<string, string[]>
  >({});

  // Reset error state whenever the dialog is opened
  React.useEffect(() => {
    if (open) {
      setError(null);
      setFieldErrors({});
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      let result: ActionResult;
      if (isEdit && recipient) {
        result = await updateRecipientAction(recipient.id, formData);
      } else {
        result = await createRecipientAction(formData);
      }

      if (result.ok) {
        onOpenChange(false);
      } else {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "수신자 수정" : "수신자 추가"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "수신자 정보를 수정합니다."
              : "새 수신자를 등록합니다. 이메일은 필수입니다."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <Field
            label="이메일 *"
            name="email"
            type="email"
            required
            defaultValue={recipient?.email ?? ""}
            error={fieldErrors.email?.[0]}
            placeholder="name@example.com"
            autoFocus={!isEdit}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="이름"
              name="name"
              defaultValue={recipient?.name ?? ""}
              error={fieldErrors.name?.[0]}
              placeholder="홍길동"
            />
            <Field
              label="조직"
              name="organization"
              defaultValue={recipient?.organization ?? ""}
              error={fieldErrors.organization?.[0]}
              placeholder="그라운드케이"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="직책"
              name="position"
              defaultValue={recipient?.position ?? ""}
              error={fieldErrors.position?.[0]}
              placeholder="팀장"
            />
            <Field
              label="직무"
              name="job_function"
              defaultValue={recipient?.job_function ?? ""}
              error={fieldErrors.job_function?.[0]}
              placeholder="마케팅"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="status">상태</Label>
              <Select
                id="status"
                name="status"
                defaultValue={recipient?.status ?? "active"}
              >
                {RECIPIENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="source">소스</Label>
              <Select
                id="source"
                name="source"
                defaultValue={recipient?.source ?? "manual"}
              >
                {RECIPIENT_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <Field
            label="태그"
            name="tags"
            defaultValue={recipient?.tags?.join(", ") ?? ""}
            error={fieldErrors.tags?.[0]}
            placeholder="vip, 정부 (쉼표로 구분)"
            hint="쉼표(,)로 여러 태그를 구분합니다"
          />

          <div className="space-y-1">
            <Label htmlFor="notes">메모</Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={recipient?.notes ?? ""}
              placeholder="자유 메모"
            />
            {fieldErrors.notes?.[0] && (
              <p className="text-xs text-rose-600">{fieldErrors.notes[0]}</p>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            취소
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "저장 중..." : isEdit ? "수정 저장" : "추가"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

function Field({ label, error, hint, name, ...props }: FieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
