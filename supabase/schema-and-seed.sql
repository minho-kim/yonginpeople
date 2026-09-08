create extension if not exists pgcrypto;

create table if not exists public.timeline_history (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    event_date varchar(50) not null,
    badge_text varchar(30) not null,
    badge_color varchar(20) default 'primary',
    title varchar(255) not null,
    description text,
    image_url text,
    minutes_pdf_url text,
    articles jsonb default '[]'::jsonb
);

alter table public.timeline_history enable row level security;
alter table public.timeline_history drop column if exists sort_order;
alter table public.timeline_history add column if not exists minutes_pdf_url text;

revoke all on public.timeline_history from anon, authenticated;
grant select on public.timeline_history to anon, authenticated;
grant insert, update, delete on public.timeline_history to authenticated;

comment on column public.timeline_history.image_url is
'Public image URL. Multiple images can be stored as one URL per line for the static admin UI.';

comment on column public.timeline_history.minutes_pdf_url is
'Public PDF URL for meeting minutes.';

create table if not exists public.admin_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    email text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.admin_users enable row level security;

revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;

create table if not exists public.agendas (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    proposed_date date default current_date not null,
    title varchar(255) not null,
    category varchar(80),
    description text,
    status varchar(20) default 'discussing' not null,
    status_note text,
    participants jsonb default '[]'::jsonb not null,
    tags jsonb default '[]'::jsonb not null,
    updates jsonb default '[]'::jsonb not null,
    next_meeting_at timestamp with time zone,
    next_meeting_location varchar(255),
    constraint agendas_status_check check (
        status in ('discussing', 'dropped')
    ),
    constraint agendas_participants_array_check check (jsonb_typeof(participants) = 'array'),
    constraint agendas_tags_array_check check (jsonb_typeof(tags) = 'array'),
    constraint agendas_updates_array_check check (jsonb_typeof(updates) = 'array')
);

alter table public.agendas enable row level security;

revoke all on public.agendas from anon, authenticated;
grant select on public.agendas to anon, authenticated;
grant insert, update, delete on public.agendas to authenticated;

insert into public.admin_users (user_id, email)
select id, email
from auth.users
on conflict (user_id) do update
set email = excluded.email;

do $$
begin
    alter publication supabase_realtime add table public.timeline_history;
exception
    when duplicate_object then null;
    when undefined_object then null;
end;
$$;

do $$
begin
    alter publication supabase_realtime add table public.agendas;
exception
    when duplicate_object then null;
    when undefined_object then null;
end;
$$;

drop policy if exists "Allow public read access" on public.timeline_history;
create policy "Allow public read access"
on public.timeline_history
for select
using (true);

drop policy if exists "Allow timeline admins read admin users" on public.admin_users;
drop policy if exists "Allow users read own admin row" on public.admin_users;
create policy "Allow users read own admin row"
on public.admin_users
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Allow public agenda read access" on public.agendas;
create policy "Allow public agenda read access"
on public.agendas
for select
to anon, authenticated
using (true);

drop policy if exists "Allow timeline admin agenda insert access" on public.agendas;
create policy "Allow timeline admin agenda insert access"
on public.agendas
for insert
to authenticated
with check (
    exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    )
);

drop policy if exists "Allow timeline admin agenda update access" on public.agendas;
create policy "Allow timeline admin agenda update access"
on public.agendas
for update
to authenticated
using (
    exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    )
);

drop policy if exists "Allow timeline admin agenda delete access" on public.agendas;
create policy "Allow timeline admin agenda delete access"
on public.agendas
for delete
to authenticated
using (
    exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    )
);

drop policy if exists "Allow authenticated insert access" on public.timeline_history;
drop policy if exists "Allow timeline admin insert access" on public.timeline_history;
create policy "Allow timeline admin insert access"
on public.timeline_history
for insert
to authenticated
with check (
    exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    )
);

drop policy if exists "Allow authenticated update access" on public.timeline_history;
drop policy if exists "Allow timeline admin update access" on public.timeline_history;
create policy "Allow timeline admin update access"
on public.timeline_history
for update
to authenticated
using (
    exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    )
)
with check (
    exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    )
);

drop policy if exists "Allow authenticated delete access" on public.timeline_history;
drop policy if exists "Allow timeline admin delete access" on public.timeline_history;
create policy "Allow timeline admin delete access"
on public.timeline_history
for delete
to authenticated
using (
    exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    )
);

insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do update
set
    public = excluded.public,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'],
    file_size_limit = 15728640;

update storage.buckets
set
    public = true,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'],
    file_size_limit = 15728640
where id = 'event-images';

insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values ('event-documents', 'event-documents', true, array['application/pdf'], 31457280)
on conflict (id) do update
set
    public = excluded.public,
    allowed_mime_types = excluded.allowed_mime_types,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "Allow public event image reads" on storage.objects;

drop policy if exists "Allow authenticated event image uploads" on storage.objects;
drop policy if exists "Allow timeline admin event image uploads" on storage.objects;
create policy "Allow timeline admin event image uploads"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'event-images'
    and exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    )
);

drop policy if exists "Allow authenticated event image updates" on storage.objects;
drop policy if exists "Allow timeline admin event image updates" on storage.objects;
create policy "Allow timeline admin event image updates"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'event-images'
    and exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    )
)
with check (
    bucket_id = 'event-images'
    and exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    )
);

drop policy if exists "Allow authenticated event image deletes" on storage.objects;
drop policy if exists "Allow timeline admin event image deletes" on storage.objects;
create policy "Allow timeline admin event image deletes"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'event-images'
    and exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    )
);

drop policy if exists "Allow public event document reads" on storage.objects;

drop policy if exists "Allow timeline admin event document uploads" on storage.objects;
create policy "Allow timeline admin event document uploads"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'event-documents'
    and exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    )
);

drop policy if exists "Allow timeline admin event document updates" on storage.objects;
create policy "Allow timeline admin event document updates"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'event-documents'
    and exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    )
)
with check (
    bucket_id = 'event-documents'
    and exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    )
);

drop policy if exists "Allow timeline admin event document deletes" on storage.objects;
create policy "Allow timeline admin event document deletes"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'event-documents'
    and exists (
        select 1
        from public.admin_users
        where user_id = (select auth.uid())
    )
);

drop function if exists public.is_timeline_admin();

insert into public.timeline_history (
    id,
    event_date,
    badge_text,
    badge_color,
    title,
    description,
    image_url,
    minutes_pdf_url,
    articles
)
values
(
    '20260211-0000-4000-8000-000000000001',
    '2026년 2월 11일',
    'TFT 빌드업',
    'secondary',
    '1차 TFT 회의',
    '시민공론장 준비를 위한 첫 TFT 회의가 열렸습니다. 운영 방향, 의제 발굴 방식, 후속 실무 논의 체계를 점검했습니다.',
    null,
    null,
    '[]'::jsonb
),
(
    '20260226-0000-4000-8000-000000000002',
    '2026년 2월 26일',
    'TFT 빌드업',
    'secondary',
    '2차 회의',
    '1차 논의 내용을 바탕으로 세부 추진 일정을 조정하고, 제안서 작성과 참여자 협의 범위를 구체화했습니다.',
    null,
    null,
    '[]'::jsonb
),
(
    '20260303-0000-4000-8000-000000000003',
    '2026년 3월 3일 ~ 9일',
    '의제 수렴',
    'info',
    '제안서 및 세부 논의',
    '공론장 의제와 제안서 초안을 중심으로 의견을 수렴하고, 행사 구성과 정책 제안의 핵심 문장을 다듬었습니다.',
    null,
    null,
    '[]'::jsonb
),
(
    '20260310-0000-4000-8000-000000000004',
    '2026년 3월 10일',
    '문서 확정',
    'dark',
    '제안서 최종 확정',
    '시민공론장 진행을 위한 제안서가 최종 확정되었습니다. 이후 행사 준비와 대외 공유에 사용할 기준 문서로 정리했습니다.',
    null,
    null,
    '[]'::jsonb
),
(
    '20260402-0000-4000-8000-000000000005',
    '2026년 4월 2일 (15:00 ~ 17:30)',
    '본 행사',
    'primary',
    '제1차 공론장 진행',
    '용인문화원 국제회의실에서 제1차 시민공론장이 진행되었습니다. 이 항목은 Supabase Dashboard에서 행사 사진 image_url과 관련 기사 articles JSON을 함께 매핑해 관리하는 핵심 기록입니다.',
    null,
    null,
    '[]'::jsonb
),
(
    '20260406-0000-4000-8000-000000000006',
    '2026년 4월 6일',
    '후속 조치',
    'success',
    '공론 후 모임',
    '공론장 이후 참여자들이 모여 결과를 복기하고, 다음 정책 제안과 추가 협의에 필요한 후속 과제를 정리했습니다.',
    null,
    null,
    '[]'::jsonb
),
(
    '20260422-0000-4000-8000-000000000007',
    '2026년 4월 22일',
    '정책 제안',
    'info',
    '용인시장 후보 간담회 (현근택)',
    '시민공론장 결과와 제안 내용을 용인시장 후보 간담회에서 공유하고, 정책 반영 가능성을 논의했습니다.',
    null,
    null,
    '[]'::jsonb
),
(
    '20260429-0000-4000-8000-000000000008',
    '2026년 4월 29일',
    '정책 제안',
    'info',
    '용인시장 후보 간담회 (이상일)',
    '용인시장 후보와 시민공론장 의제 및 제안 사항을 공유하고, 지역 정책으로 이어질 수 있는 접점을 확인했습니다.',
    null,
    null,
    '[]'::jsonb
),
(
    '20260504-0000-4000-8000-000000000009',
    '2026년 5월 4일',
    '후속 조치',
    'success',
    '공론 후 모임 2차',
    '후속 모임을 통해 정책 제안 이후의 대응 방향과 시민 참여 기반 확대 방안을 이어서 논의했습니다.',
    null,
    null,
    '[]'::jsonb
),
(
    '20260511-0000-4000-8000-000000000010',
    '2026년 5월 11일',
    '후속 조치',
    'success',
    '공론 후 모임 3차',
    '공론장 성과를 정리하고, 후보 협약식과 향후 활동을 준비하기 위한 세부 역할을 조율했습니다.',
    null,
    null,
    '[]'::jsonb
),
(
    '20260526-0000-4000-8000-000000000011',
    '2026년 5월 26일',
    '성과 확보',
    'primary',
    '용인시장 후보 협약식 (현근택)',
    '시민공론장 논의와 정책 제안의 결과를 바탕으로 용인시장 후보 협약식이 진행되었습니다.',
    null,
    null,
    '[]'::jsonb
),
(
    '20260616-0000-4000-8000-000000000012',
    '2026년 6월 16일',
    '미래 비전',
    'dark',
    '새시작 모임',
    '시민공론장의 기록을 다음 활동으로 잇기 위한 새시작 모임이 열렸습니다. 이후의 거버넌스 방향을 함께 점검했습니다.',
    null,
    null,
    '[]'::jsonb
)
on conflict (id) do update
set
    event_date = excluded.event_date,
    badge_text = excluded.badge_text,
    badge_color = excluded.badge_color,
    title = excluded.title,
    description = excluded.description,
    image_url = excluded.image_url,
    minutes_pdf_url = excluded.minutes_pdf_url,
    articles = excluded.articles;
