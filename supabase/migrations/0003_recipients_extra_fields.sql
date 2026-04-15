-- ─────────────────────────────────────────────
-- Phase 2 — add 직책(position) + 직무(job_function) to recipients
-- ─────────────────────────────────────────────

alter table recipients
  add column if not exists position      text,
  add column if not exists job_function  text;

comment on column recipients.position     is '직책 (e.g., 팀장, 부장, 대표)';
comment on column recipients.job_function is '직무 (e.g., 마케팅, 기획, 개발)';
