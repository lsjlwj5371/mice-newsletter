import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * NCP 동기화 큐 (`ncp_sync_requests` 테이블) 전용 헬퍼.
 *
 * 본 콘솔은 외부 사용자의 추천 가입 / 수신 거부를 받기만 하고 실제 NCP 주소록
 * 반영은 관리자가 수기로 처리한다. 이 큐는 그 사이를 잇는 작업 리스트이며,
 * `recipients` 테이블과는 데이터적으로 완전히 분리된다.
 *
 * 같은 이메일·종류의 대기(completed_at IS NULL) 요청이 이미 존재하면 부분
 * 유니크 인덱스(uniq_ncp_sync_pending)에 의해 INSERT 가 무시된다 (멱등).
 */

export type NcpRequestType = "add" | "remove";

export type NcpAddSource = "referral_self" | "referral_token";
export type NcpRemoveSource =
  | "self_form"
  | "one_click_link"
  | "one_click_header";

export interface EnqueueAddParams {
  email: string;
  name?: string | null;
  organization?: string | null;
  referrerEmail?: string | null;
  sourceKind: NcpAddSource;
}

export interface EnqueueRemoveParams {
  email: string;
  sourceKind: NcpRemoveSource;
  notes?: string | null;
}

export interface EnqueueResult {
  /** 새로 큐에 들어갔으면 true. 이미 같은 종류의 대기 요청이 있어 스킵됐으면 false. */
  inserted: boolean;
  error?: string;
}

/**
 * 추가 요청을 큐에 넣는다. 이메일은 소문자로 정규화.
 */
export async function enqueueAddRequest(
  supabase: SupabaseClient,
  params: EnqueueAddParams
): Promise<EnqueueResult> {
  const email = params.email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("ncp_sync_requests")
    .insert({
      request_type: "add",
      email,
      name: params.name?.trim() || null,
      organization: params.organization?.trim() || null,
      referrer_email: params.referrerEmail?.trim().toLowerCase() || null,
      source_kind: params.sourceKind,
    })
    .select("id");

  if (error) {
    // 23505 = unique_violation (이미 같은 이메일·종류의 대기 행 존재)
    if (error.code === "23505") {
      return { inserted: false };
    }
    return { inserted: false, error: error.message };
  }

  return { inserted: (data?.length ?? 0) > 0 };
}

/**
 * 제거 요청을 큐에 넣는다. 이메일은 소문자로 정규화.
 */
export async function enqueueRemoveRequest(
  supabase: SupabaseClient,
  params: EnqueueRemoveParams
): Promise<EnqueueResult> {
  const email = params.email.trim().toLowerCase();

  const { data, error } = await supabase
    .from("ncp_sync_requests")
    .insert({
      request_type: "remove",
      email,
      source_kind: params.sourceKind,
      notes: params.notes ?? null,
    })
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return { inserted: false };
    }
    return { inserted: false, error: error.message };
  }

  return { inserted: (data?.length ?? 0) > 0 };
}
