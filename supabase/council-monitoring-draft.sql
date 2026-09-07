-- 2026-09-08 원격 Supabase 프로젝트에 비공개 관리용으로 적용한 스키마.
-- 공개 페이지를 열기 전까지 테이블과 첨부 자료는 등록 관리자만 읽을 수 있다.

create table if not exists public.council_monitoring (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    monitoring_date date not null,
    council_term varchar(40),
    session_name varchar(120),
    committee varchar(120),
    meeting_type varchar(80) default '기타' not null,
    title varchar(255) not null,
    description text,
    members jsonb default '[]'::jsonb not null,
    keywords jsonb default '[]'::jsonb not null,
    search_text text,
    source_url text,
    attachments jsonb default '[]'::jsonb not null,
    is_published boolean default false not null,
    constraint council_monitoring_members_array check (jsonb_typeof(members) = 'array'),
    constraint council_monitoring_keywords_array check (jsonb_typeof(keywords) = 'array'),
    constraint council_monitoring_attachments_array check (jsonb_typeof(attachments) = 'array')
);

create index if not exists council_monitoring_date_idx
    on public.council_monitoring (monitoring_date desc, created_at desc);
create index if not exists council_monitoring_session_idx
    on public.council_monitoring (session_name);
create index if not exists council_monitoring_committee_idx
    on public.council_monitoring (committee);
create index if not exists council_monitoring_published_idx
    on public.council_monitoring (is_published);

alter table public.council_monitoring enable row level security;

revoke all on table public.council_monitoring from anon, authenticated;
grant select, insert, update, delete on table public.council_monitoring to authenticated;

drop policy if exists "Allow public council monitoring read" on public.council_monitoring;
drop policy if exists "Allow council admins read all" on public.council_monitoring;
drop policy if exists "Allow council admins read" on public.council_monitoring;
create policy "Allow council admins read"
on public.council_monitoring
for select
to authenticated
using (
    exists (
        select 1
        from public.admin_users
        where admin_users.user_id = (select auth.uid())
    )
);

drop policy if exists "Allow council admins insert" on public.council_monitoring;
create policy "Allow council admins insert"
on public.council_monitoring
for insert
to authenticated
with check (
    exists (
        select 1
        from public.admin_users
        where admin_users.user_id = (select auth.uid())
    )
);

drop policy if exists "Allow council admins update" on public.council_monitoring;
create policy "Allow council admins update"
on public.council_monitoring
for update
to authenticated
using (
    exists (
        select 1
        from public.admin_users
        where admin_users.user_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1
        from public.admin_users
        where admin_users.user_id = (select auth.uid())
    )
);

drop policy if exists "Allow council admins delete" on public.council_monitoring;
create policy "Allow council admins delete"
on public.council_monitoring
for delete
to authenticated
using (
    exists (
        select 1
        from public.admin_users
        where admin_users.user_id = (select auth.uid())
    )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'council-documents',
    'council-documents',
    false,
    52428800,
    array[
        'application/pdf',
        'application/x-hwp',
        'application/haansofthwp',
        'application/vnd.hancom.hwpx',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
        'application/octet-stream',
        'text/csv',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/webp'
    ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Allow council admins select documents" on storage.objects;
create policy "Allow council admins select documents"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'council-documents'
    and exists (
        select 1
        from public.admin_users
        where admin_users.user_id = (select auth.uid())
    )
);

drop policy if exists "Allow council admins insert documents" on storage.objects;
create policy "Allow council admins insert documents"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'council-documents'
    and exists (
        select 1
        from public.admin_users
        where admin_users.user_id = (select auth.uid())
    )
);

drop policy if exists "Allow council admins update documents" on storage.objects;
create policy "Allow council admins update documents"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'council-documents'
    and exists (
        select 1
        from public.admin_users
        where admin_users.user_id = (select auth.uid())
    )
)
with check (
    bucket_id = 'council-documents'
    and exists (
        select 1
        from public.admin_users
        where admin_users.user_id = (select auth.uid())
    )
);

drop policy if exists "Allow council admins delete documents" on storage.objects;
create policy "Allow council admins delete documents"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'council-documents'
    and exists (
        select 1
        from public.admin_users
        where admin_users.user_id = (select auth.uid())
    )
);

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'council_monitoring'
    ) then
        alter publication supabase_realtime add table public.council_monitoring;
    end if;
end;
$$;
