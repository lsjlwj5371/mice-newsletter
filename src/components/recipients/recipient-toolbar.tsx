"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { RecipientFormDialog } from "./recipient-form-dialog";
import { RecipientBulkImportDialog } from "./recipient-bulk-import-dialog";
import {
  RECIPIENT_STATUSES,
  STATUS_LABELS,
} from "@/lib/validation/recipient";

interface Props {
  totalCount: number;
  filteredCount: number;
}

export function RecipientToolbar({ totalCount, filteredCount }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const currentSearch = params.get("q") ?? "";
  const currentStatus = params.get("status") ?? "all";

  const [searchValue, setSearchValue] = React.useState(currentSearch);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [bulkOpen, setBulkOpen] = React.useState(false);

  // Debounced search submission
  React.useEffect(() => {
    const handle = setTimeout(() => {
      if (searchValue !== currentSearch) {
        const next = new URLSearchParams(params.toString());
        if (searchValue) next.set("q", searchValue);
        else next.delete("q");
        router.replace(`/recipients?${next.toString()}`);
      }
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = new URLSearchParams(params.toString());
    if (e.target.value === "all") next.delete("status");
    else next.set("status", e.target.value);
    router.replace(`/recipients?${next.toString()}`);
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <Input
            placeholder="이메일·이름·조직 검색"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="max-w-xs"
          />
          <Select
            value={currentStatus}
            onChange={handleStatusChange}
            className="max-w-[160px]"
          >
            <option value="all">모든 상태</option>
            {RECIPIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <span className="text-xs text-muted-foreground ml-1">
            {filteredCount === totalCount
              ? `총 ${totalCount}명`
              : `${filteredCount} / ${totalCount}명`}
          </span>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)}>
            일괄 추가
          </Button>
          <Button onClick={() => setCreateOpen(true)}>+ 수신자 추가</Button>
        </div>
      </div>

      <RecipientFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <RecipientBulkImportDialog open={bulkOpen} onOpenChange={setBulkOpen} />
    </>
  );
}
