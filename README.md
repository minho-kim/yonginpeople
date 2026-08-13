# 시민공론장 히스토리와 의제 장터

Supabase 기반으로 시민공론장 운영 히스토리와 연석회의 의제의 제안·논의·완료·중단 과정을 공개하는 정적 웹 서비스입니다.

## 파일 구성

- `index.html`: Bootstrap 5.3.2 CDN, 공용 모달, 공개 타임라인 화면
- `admin.html`: Supabase Auth 로그인 기반 히스토리 관리자
- `config.js`: 공개 페이지와 관리자 페이지가 함께 쓰는 Supabase URL/key 설정
- `styles.css`: 반응형 지그재그 타임라인 UI
- `app.js`: Supabase 조회, realtime 구독, 이벤트 위임, 모달 바인딩
- `admin.js`: 기록 생성/수정/삭제, Storage 사진/PDF 업로드, 기사 링크 관리
- `admin.css`: 관리자 화면 전용 스타일
- `agendas.html`, `agendas.css`, `agendas.js`: 공개 의제 카드, 검색, 상태 필터, 인라인 상세 화면
- `agenda-admin.html`, `agenda-admin.css`, `agenda-admin.js`: 관리자용 의제 생성·수정·삭제 화면
- `supabase/schema-and-seed.sql`: 테이블, RLS 정책, Storage 버킷, 2026년 초기 데이터

## Supabase 설정

1. Supabase Auth에서 관리자 사용자를 생성합니다.
2. Supabase SQL Editor에서 `supabase/schema-and-seed.sql`을 실행합니다.
3. SQL 파일은 현재 Auth 사용자들을 `admin_users` allowlist에 넣고, `timeline_history` 테이블을 Supabase Realtime publication에도 등록합니다.
4. Storage의 `event-images` 버킷에는 행사 이미지를, `event-documents` 버킷에는 회의록 PDF를 업로드합니다.
5. `timeline_history.image_url`에는 이미지 Public URL을 넣습니다. 사진이 여러 장이면 URL을 한 줄에 하나씩 넣습니다.
6. `timeline_history.minutes_pdf_url`에는 회의록 PDF Public URL을 넣습니다.
7. `timeline_history.articles`에는 아래 형태의 JSON 배열을 넣습니다.

```json
[
  {
    "title": "기사 제목",
    "url": "https://example.com/article"
  }
]
```

8. `config.js`의 설정값을 실제 프로젝트 값으로 교체합니다.

```js
export const TIMELINE_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY"
};
```

설정값이 비어 있으면 공개 화면은 `app.js`의 참조 데이터로 렌더링하고, 관리자 화면은 설정 안내를 표시합니다.

## 관리자 페이지

```txt
http://localhost:4173/admin.html
```

관리자 페이지에서는 Supabase Auth 계정 중 `admin_users`에 등록된 사용자만 `timeline_history` 기록을 생성, 수정, 삭제할 수 있습니다. 관리자 여부는 로그인한 사용자의 `admin_users` 본인 행 조회로 확인합니다. 날짜는 달력으로 선택하며, 공개 화면은 날짜 기준 최신순으로 자동 정렬합니다. 사진 업로드는 `event-images` 버킷에 저장하고, 여러 장을 한 번에 업로드할 수 있습니다. 업로드된 Public URL은 `image_url` 필드에 줄바꿈 목록으로 반영합니다. 회의록 PDF는 `event-documents` 버킷에 저장하고, 공개 상세 패널에서 바로 볼 수 있는 PDF 뷰어로 표시합니다.

관리자 폼은 작성 중인 내용을 브라우저에 임시저장합니다. 저장 전 페이지를 벗어나거나 새로고침해도 다시 관리자 화면에 들어오면 입력 중이던 값이 복원됩니다.

새 관리자 계정을 나중에 추가했다면 Supabase Dashboard에서 Auth 사용자를 만든 뒤 `admin_users` 테이블에도 해당 `user_id`를 추가해야 합니다. 현재 SQL은 실행 시점에 이미 존재하는 Auth 사용자들을 자동 등록합니다.

## 의제 장터

```txt
http://localhost:4173/agendas.html
http://localhost:4173/agenda-admin.html
```

공개 화면은 `논의 중`, `논의 중단` 상태를 카드 색과 아이콘으로 구분합니다. 제목, 내용, 참여자, 태그, 상태 메모, 빌드업 기록 전체를 검색할 수 있어 중단된 의제도 기록으로 다시 찾을 수 있습니다. 운영 히스토리와 의제 장터는 상단 탭으로 이동합니다.

의제 입력은 관리자만 할 수 있습니다. `agenda-admin.html`에서 의제 내용, 공개 참여자, 태그, 다음 모임, 빌드업 기록을 한 화면에서 관리합니다. 의제는 참여자 3명 이상일 때 저장할 수 있으며, 중단된 의제는 삭제하지 않고 `논의 중단` 상태와 이유를 남기는 방식을 권장합니다. 참여자에는 공개에 동의한 이름만 입력하고 연락처는 저장하지 않습니다.

## 보안 및 배포 메모

- 프론트엔드에는 Publishable key 또는 legacy anon public key만 둡니다. `service_role`, `secret`, `sb_secret_...` 키는 절대 넣지 않습니다.
- 공개 타임라인 읽기는 유지하되, DB 쓰기와 Storage 업로드/수정/삭제는 `admin_users` allowlist 관리자에게만 허용합니다.
- Storage 버킷은 public URL 표시를 유지하지만, `storage.objects`의 public 목록 조회 정책은 두지 않습니다.
- `event-images` 업로드는 JPG, PNG, WebP, GIF, HEIC/HEIF 형식의 15MB 이하 파일로 제한합니다.
- `event-documents` 업로드는 PDF 형식의 30MB 이하 파일로 제한합니다.
- Supabase Auth의 유출 비밀번호 보호는 Dashboard의 Auth 설정에서 별도로 켜는 것을 권장합니다.
- Bootstrap/Lucide CDN은 고정 버전과 SRI 무결성 값을 사용합니다. Supabase SDK도 현재 동작 확인한 `2.108.2`로 고정했습니다.
- 실제 배포 시 공개 웹 루트에는 HTML, JavaScript, CSS, `config.js`만 올리고 `README.md`, `WORK_HISTORY.md`, `supabase/` 같은 내부 작업 파일은 제외합니다.

## 로컬 실행

```bash
python3 -m http.server 4173
```

브라우저에서 `http://localhost:4173`을 열면 됩니다.
