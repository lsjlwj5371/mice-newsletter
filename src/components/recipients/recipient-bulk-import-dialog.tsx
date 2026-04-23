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
import { Textarea, Label } from "@/components/ui/input";
import {
  bulkCreateRecipientsAction,
  type BulkRecipientRow,
} from "@/app/(admin)/recipients/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedRow {
  line: number;
  raw: string;
  row: BulkRecipientRow | null;
  error: string | null;
}

/**
 * Parse the admin's pasted text into recipient rows.
 *
 * Supports three input shapes — detected automatically, the admin
 * doesn't pick a mode:
 *
 *   1) Plain emails, one per line
 *        alice@a.com
 *        bob@b.com
 *
 *   2) Plain emails, comma-separated (single line or across lines)
 *        alice@a.com, bob@b.com, carol@c.com
 *
 *   3) CSV with header row — columns are mapped by header name. Only
 *      `email` is required. Accepted column names (case-insensitive):
 *        email | name | organization (또는 org, 회사) |
 *        position (직책) | job_function (직무) | tags | notes
 *
 *      예)
 *        email,name,organization,tags
 *        alice@a.com,앨리스,카카오,"vip, seoul"
 *        bob@b.com,밥,네이버,
 */
function parseBulkInput(text: string): ParsedRow[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Split into non-empty lines, stripping inline commas in the "plain
  // comma-separated" case by re-splitting when no header is found.
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // CSV mode: first line contains "email" as one of the header tokens
  // separated by commas.
  const firstLineTokens = lines[0]
    ?.split(",")
    .map((t) => t.trim().toLowerCase()) ?? [];
  const looksLikeCsvHeader =
    firstLineTokens.includes("email") && firstLineTokens.length > 1;

  if (looksLikeCsvHeader) {
    return parseCsv(lines);
  }

  // Plain-list mode: each line can be a single email OR multiple
  // comma-separated emails. Flatten.
  const out: ParsedRow[] = [];
  let lineNum = 0;
  for (const line of lines) {
    const parts = line.split(/[,\s;]+/).filter(Boolean);
    for (const p of parts) {
      lineNum += 1;
      out.push(parseEmailOnly(p, lineNum));
    }
  }
  return out;
}

function parseEmailOnly(value: string, line: number): ParsedRow {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      line,
      raw: value,
      row: null,
      error: "이메일 형식이 아닙니다",
    };
  }
  return {
    line,
    raw: value,
    row: { email },
    error: null,
  };
}

function parseCsv(lines: string[]): ParsedRow[] {
  const headers = splitCsvLine(lines[0]).map((h) =>
    h.trim().toLowerCase()
  );
  const colIndex = (name: string) => headers.indexOf(name);
  const emailIdx = colIndex("email");
  const nameIdx = colIndex("name");
  // Accept synonyms — common Korean column names admins may use.
  const orgIdx = [colIndex("organization"), colIndex("org"), colIndex("회사")].find(
    (i) => i !== -1
  );
  const posIdx = [colIndex("position"), colIndex("직책")].find((i) => i !== -1);
  const jobIdx = [colIndex("job_function"), colIndex("직무")].find(
    (i) => i !== -1
  );
  const tagsIdx = colIndex("tags");
  const notesIdx = colIndex("notes");

  const out: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    const email = (cols[emailIdx] ?? "").trim().toLowerCase();
    const raw = lines[i];
    if (!email) continue; // skip blank lines
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      out.push({ line: i + 1, raw, row: null, error: "이메일 형식이 아닙니다" });
      continue;
    }
    const row: BulkRecipientRow = {
      email,
      name: nameIdx >= 0 ? cols[nameIdx]?.trim() || null : null,
      organization:
        orgIdx !== undefined && orgIdx >= 0
          ? cols[orgIdx]?.trim() || null
          : null,
      position:
        posIdx !== undefined && posIdx >= 0
          ? cols[posIdx]?.trim() || null
          : null,
      job_function:
        jobIdx !== undefined && jobIdx >= 0
          ? cols[jobIdx]?.trim() || null
          : null,
      tags:
        tagsIdx >= 0
          ? (cols[tagsIdx] ?? "")
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      notes: notesIdx >= 0 ? cols[notesIdx]?.trim() || null : null,
    };
    out.push({ line: i + 1, raw, row, error: null });
  }
  return out;
}

/** RFC 4180-ish CSV line splitter — handles "quoted, values" with commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function RecipientBulkImportDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [text, setText] = React.useState("");
  const [result, setResult] = React.useState<
    | {
        inserted: number;
        skippedDuplicate: number;
        invalid: Array<{ line: number; value: string; error: string }>;
      }
    | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setText("");
      setResult(null);
      setError(null);
    }
  }, [open]);

  const parsed = React.useMemo(() => parseBulkInput(text), [text]);
  const validRows = parsed.filter((p) => p.row !== null);
  const invalidRows = parsed.filter((p) => p.row === null);
  const uniqueEmails = new Set(validRows.map((p) => p.row!.email));

  function handleSubmit() {
    setError(null);
    if (validRows.length === 0) {
      setError("유효한 이메일이 한 건도 없습니다. 형식을 확인해 주세요.");
      return;
    }
    startTransition(async () => {
      const res = await bulkCreateRecipientsAction(
        validRows.map((p) => p.row!)
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult({
        inserted: res.inserted,
        skippedDuplicate: res.skippedDuplicate,
        invalid: res.invalidRows,
      });
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>수신자 일괄 추가</DialogTitle>
        <DialogDescription>
          이메일만 붙여넣거나, 헤더가 있는 CSV 형식으로 입력하세요. 중복
          이메일은 자동으로 건너뜁니다.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        {result ? (
          // ── Post-submit summary view ─────────────────────
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <div className="font-semibold mb-1">
                {result.inserted}명이 추가되었습니다
              </div>
              <ul className="text-xs space-y-0.5 text-emerald-700">
                {result.skippedDuplicate > 0 && (
                  <li>
                    · 이미 등록된 이메일 {result.skippedDuplicate}건은
                    건너뛰었습니다
                  </li>
                )}
                {result.invalid.length > 0 && (
                  <li>
                    · 형식 오류로 제외된 {result.invalid.length}건이 있습니다
                    (아래 목록)
                  </li>
                )}
              </ul>
            </div>
            {result.invalid.length > 0 && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 max-h-40 overflow-auto">
                <div className="font-semibold mb-1.5">제외된 항목</div>
                <ul className="space-y-0.5 font-mono">
                  {result.invalid.map((e, i) => (
                    <li key={i}>
                      줄 {e.line}: {e.value || "(빈 값)"} — {e.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          // ── Input view ──────────────────────────────────
          <>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-text">이메일 목록</Label>
              <Textarea
                id="bulk-text"
                rows={10}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={[
                  "# 방법 1 — 이메일만 줄바꿈으로 구분",
                  "alice@example.com",
                  "bob@example.com",
                  "",
                  "# 방법 2 — 헤더 있는 CSV (email은 필수)",
                  "email,name,organization,tags",
                  'alice@example.com,앨리스,카카오,"vip, seoul"',
                ].join("\n")}
                disabled={pending}
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                지원 형식: 이메일만 한 줄씩 / 쉼표 구분 / CSV 헤더
                (email·name·organization·position·job_function·tags·notes).
                한 번에 최대 2,000명까지 가능합니다.
              </p>
            </div>

            {/* Live parse summary */}
            {text.trim() && (
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs space-y-1">
                <div className="font-semibold text-foreground">
                  파싱 결과 미리보기
                </div>
                <div className="text-muted-foreground">
                  · 유효 이메일:{" "}
                  <span className="font-semibold text-emerald-700">
                    {uniqueEmails.size}건
                  </span>
                  {validRows.length !== uniqueEmails.size && (
                    <span className="ml-2 text-amber-700">
                      (입력한 목록 내 중복 {validRows.length - uniqueEmails.size}건
                      제외)
                    </span>
                  )}
                </div>
                {invalidRows.length > 0 && (
                  <div className="text-rose-700">
                    · 형식 오류: {invalidRows.length}건 (제출 시 자동 제외)
                  </div>
                )}
                {invalidRows.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-muted-foreground text-[11px]">
                      오류 항목 보기
                    </summary>
                    <ul className="mt-1.5 font-mono text-[11px] text-rose-700 max-h-24 overflow-auto">
                      {invalidRows.slice(0, 50).map((r) => (
                        <li key={r.line}>
                          줄 {r.line}: {r.raw} — {r.error}
                        </li>
                      ))}
                      {invalidRows.length > 50 && (
                        <li>... 외 {invalidRows.length - 50}건</li>
                      )}
                    </ul>
                  </details>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {error}
              </div>
            )}
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={pending}
        >
          {result ? "닫기" : "취소"}
        </Button>
        {!result && (
          <Button
            onClick={handleSubmit}
            disabled={pending || uniqueEmails.size === 0}
          >
            {pending
              ? "추가 중…"
              : `${uniqueEmails.size}명 추가`}
          </Button>
        )}
      </DialogFooter>
    </Dialog>
  );
}
