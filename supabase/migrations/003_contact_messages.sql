-- お問い合わせメッセージテーブル
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  category   text not null default 'その他',
  subject    text not null,
  message    text not null,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

create policy "users can insert own contact messages"
  on public.contact_messages for insert
  with check (auth.uid() = user_id);
