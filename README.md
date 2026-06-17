# 시민공론장 히스토리

Supabase Dashboard에서 `timeline_history` 데이터를 관리하면 원페이지 타임라인과 단일 상세 모달에 즉시 반영되는 정적 웹 서비스입니다.

## 파일 구성

- `index.html`: Bootstrap 5.3.2 CDN, 공용 모달, Supabase 설정 객체
- `admin.html`: Supabase Auth 로그인 기반 히스토리 관리자
- `config.js`: 공개 페이지와 관리자 페이지가 함께 쓰는 Supabase URL/key 설정
- `styles.css`: 반응형 지그재그 타임라인 UI
- `app.js`: Supabase 조회, realtime 구독, 이벤트 위임, 모달 바인딩
- `admin.js`: 기록 생성/수정/삭제, Storage 사진 업로드, 기사 링크 관리
- `admin.css`: 관리자 화면 전용 스타일
- `supabase/schema-and-seed.sql`: 테이블, RLS 정책, Storage 버킷, 2026년 초기 데이터

## Supabase 설정

1. Supabase SQL Editor에서 `supabase/schema-and-seed.sql`을 실행합니다.
2. SQL 파일은 `timeline_history` 테이블을 Supabase Realtime publication에도 등록합니다.
3. Storage의 `event-images` 버킷에 행사 이미지를 업로드합니다.
4. `timeline_history.image_url`에는 이미지 Public URL을 넣습니다.
5. `timeline_history.articles`에는 아래 형태의 JSON 배열을 넣습니다.

```json
[
  {
    "title": "기사 제목",
    "url": "https://example.com/article"
  }
]
```

6. Supabase Auth에서 관리자 사용자를 생성합니다.
7. `config.js`의 설정값을 실제 프로젝트 값으로 교체합니다.

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

관리자 페이지에서는 Supabase Auth 계정으로 로그인한 뒤 `timeline_history` 기록을 생성, 수정, 삭제할 수 있습니다. 날짜는 달력으로 선택하며, 공개 화면은 날짜 기준 최신순으로 자동 정렬합니다. 사진 업로드는 `event-images` 버킷에 저장하고, 기존 기록을 수정 중이면 Public URL을 `image_url` 필드에 즉시 반영합니다.

## 로컬 실행

```bash
python3 -m http.server 4173
```

브라우저에서 `http://localhost:4173`을 열면 됩니다.
