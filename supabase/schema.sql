-- player_accounts 테이블
create table if not exists public.player_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text,
  password_hash text not null,
  user_type text not null default 'general',
  achievements jsonb default '[]'::jsonb,
  education_progress jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- save_slots 테이블 (saveEngine.js가 쓰는 이름·컬럼과 일치)
create table if not exists public.save_slots (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references public.player_accounts(id) on delete cascade,
  slot_number integer not null check (slot_number between 1 and 5),
  game_state jsonb not null,
  saved_at timestamptz default now(),
  unique(player_id, slot_number)
);

-- records 테이블
create table if not exists public.records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.player_accounts(id) on delete cascade,
  result_type text not null default 'CLEAR',
  clear_grade text,
  advisor_id text,
  final_capital bigint,
  clear_floor integer,
  playtime integer,
  profit_turns integer,
  loss_turns integer,
  max_share float,
  bankruptcy_count integer,
  external_events integer,
  event_success_rate float,
  rival_dominated integer,
  monopol_clears jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

-- RLS 정책
-- ⚠️ 주의: 지금은 자체 로그인(player_accounts)이라 auth.uid()가 없어서 using (true)로 열려 있다.
--    anon 키만 있으면 누구나 모든 계정·password_hash·저장 데이터를 읽고 쓸 수 있다.
--    배포 전에는 Supabase Auth로 바꾸고 아래 정책을 auth.uid() 기준으로 교체해야 한다.
alter table public.player_accounts enable row level security;
alter table public.save_slots enable row level security;
alter table public.records enable row level security;

create policy "본인 계정 접근" on public.player_accounts
  for all using (true);

create policy "본인 저장 데이터 접근" on public.save_slots
  for all using (true);

create policy "본인 기록 접근" on public.records
  for all using (true);
