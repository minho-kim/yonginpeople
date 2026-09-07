-- 2026-09-07 원격 Supabase 프로젝트에 적용한 주민참여예산 스키마.
-- 공개 제안과 관리자 전용 내부 메모를 분리한다.

create table if not exists public.participatory_budget_projects (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    fiscal_year integer not null,
    proposal_date date,
    project_name varchar(255) not null,
    district varchar(100),
    category varchar(100),
    description text,
    public_note text,
    source_url text,
    is_published boolean default true not null,
    constraint participatory_budget_fiscal_year_range check (fiscal_year between 2000 and 2200)
);

create table if not exists public.participatory_budget_private_notes (
    project_id uuid primary key references public.participatory_budget_projects(id) on delete cascade,
    internal_note text,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists participatory_budget_year_idx
    on public.participatory_budget_projects (fiscal_year desc, proposal_date desc);
create index if not exists participatory_budget_district_idx
    on public.participatory_budget_projects (district);
create index if not exists participatory_budget_category_idx
    on public.participatory_budget_projects (category);
create index if not exists participatory_budget_published_idx
    on public.participatory_budget_projects (is_published);

alter table public.participatory_budget_projects enable row level security;
alter table public.participatory_budget_private_notes enable row level security;

revoke all on table public.participatory_budget_projects from anon, authenticated;
grant select on table public.participatory_budget_projects to anon, authenticated;
grant insert, update, delete on table public.participatory_budget_projects to authenticated;

revoke all on table public.participatory_budget_private_notes from anon, authenticated;
grant select, insert, update, delete on table public.participatory_budget_private_notes to authenticated;

drop policy if exists "Allow public participatory budget read" on public.participatory_budget_projects;
create policy "Allow public participatory budget read"
on public.participatory_budget_projects
for select
to anon
using (is_published = true);

drop policy if exists "Allow budget admins read all" on public.participatory_budget_projects;
drop policy if exists "Allow authenticated budget read" on public.participatory_budget_projects;
create policy "Allow authenticated budget read"
on public.participatory_budget_projects
for select
to authenticated
using (
    is_published = true
    or exists (
            select 1
            from public.admin_users
            where admin_users.user_id = (select auth.uid())
        )
);

drop policy if exists "Allow budget admins insert" on public.participatory_budget_projects;
create policy "Allow budget admins insert"
on public.participatory_budget_projects
for insert
to authenticated
with check (
    exists (
        select 1
        from public.admin_users
        where admin_users.user_id = (select auth.uid())
    )
);

drop policy if exists "Allow budget admins update" on public.participatory_budget_projects;
create policy "Allow budget admins update"
on public.participatory_budget_projects
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

drop policy if exists "Allow budget admins delete" on public.participatory_budget_projects;
create policy "Allow budget admins delete"
on public.participatory_budget_projects
for delete
to authenticated
using (
    exists (
        select 1
        from public.admin_users
        where admin_users.user_id = (select auth.uid())
    )
);

drop policy if exists "Allow budget admins read private notes" on public.participatory_budget_private_notes;
create policy "Allow budget admins read private notes"
on public.participatory_budget_private_notes
for select
to authenticated
using (
    exists (
        select 1
        from public.admin_users
        where admin_users.user_id = (select auth.uid())
    )
);

drop policy if exists "Allow budget admins insert private notes" on public.participatory_budget_private_notes;
create policy "Allow budget admins insert private notes"
on public.participatory_budget_private_notes
for insert
to authenticated
with check (
    exists (
        select 1
        from public.admin_users
        where admin_users.user_id = (select auth.uid())
    )
);

drop policy if exists "Allow budget admins update private notes" on public.participatory_budget_private_notes;
create policy "Allow budget admins update private notes"
on public.participatory_budget_private_notes
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

drop policy if exists "Allow budget admins delete private notes" on public.participatory_budget_private_notes;
create policy "Allow budget admins delete private notes"
on public.participatory_budget_private_notes
for delete
to authenticated
using (
    exists (
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
          and tablename = 'participatory_budget_projects'
    ) then
        alter publication supabase_realtime add table public.participatory_budget_projects;
    end if;
end;
$$;
