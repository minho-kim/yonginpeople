# 시민공론장 히스토리 웹 서비스 작업 기록

## 2026-06-16 초기 개발 지시

사용자는 매년 1회 개최되는 시민공론장의 진행 이력을 투명하게 기록하고 관리하기 위한 원페이지 타임라인 웹 서비스를 요청했다.

주요 지시 사항:

- Frontend는 HTML5, CSS3, Vanilla JavaScript ES6 module 방식으로 구현한다.
- UI는 Bootstrap 5.3.2 CDN을 사용한다.
- Backend와 DB는 Supabase Database, Storage, JavaScript Client SDK v2 CDN을 사용한다.
- 별도 복잡한 어드민 웹 없이 Supabase Dashboard 입력값이 프론트 화면에 동적 바인딩되도록 한다.
- `timeline_history` 테이블을 기준으로 행사 날짜, 배지, 제목, 설명, 이미지 URL, 기사 JSON을 관리한다. 초기 지시에는 정렬 순서가 있었으나 이후 날짜 자동 정렬로 변경했다.
- Storage 버킷 이름은 `event-images`로 하고 공개 읽기가 가능해야 한다.
- 타임라인은 날짜 기준으로 렌더링하며, 카드 클릭 시 상세 모달을 열어 사진과 기사 링크를 보여준다.
- 모달은 아이템마다 하드코딩하지 않고 `globalEventModal` 하나만 사용하는 단일 모달 구조로 구현한다.
- 이벤트 위임으로 카드 클릭을 처리한다.
- 데이터 로딩 중에는 스피너를 보여주고, 에러나 지연 시 UI가 깨지지 않게 한다.
- footer에는 `문의: minho@hoods.kr` 메일 링크를 고정 배치한다.
- 함수 코드는 생략 없이 작성하고, 함수 끝에 `// End of functionName` 주석을 남긴다.
- `<script type="module">` 전역 스코프에서는 메서드 축약형을 쓰지 않고 `function` 키워드를 명시한다.

초기 검증용 2026년 히스토리 데이터:

- 2026년 2월 11일 | TFT 빌드업 | 1차 TFT 회의
- 2026년 2월 26일 | TFT 빌드업 | 2차 회의
- 2026년 3월 3일~9일 | 의제 수렴 | 제안서 및 세부 논의
- 2026년 3월 10일 | 문서 확정 | 제안서 최종 확정
- 2026년 4월 2일 15:00~17:30 | 본 행사 | 제1차 공론장 진행
- 2026년 4월 6일 | 후속 조치 | 공론 후 모임
- 2026년 4월 22일 | 정책 제안 | 용인시장 후보 간담회 (현근택)
- 2026년 4월 29일 | 정책 제안 | 용인시장 후보 간담회 (이상일)
- 2026년 5월 4일 | 후속 조치 | 공론 후 모임 2차
- 2026년 5월 11일 | 후속 조치 | 공론 후 모임 3차
- 2026년 5월 26일 | 성과 확보 | 용인시장 후보 협약식 (현근택)
- 2026년 6월 16일 | 미래 비전 | 새시작 모임

## 2026-06-16 구현 내용

- `index.html`, `styles.css`, `app.js`를 생성해 정적 원페이지 타임라인 앱을 구현했다.
- Supabase 설정값이 비어 있으면 참조 데이터로 화면이 렌더링되도록 fallback을 넣었다.
- Supabase 설정값이 있으면 `timeline_history` 테이블을 조회하고 realtime 변경을 구독하도록 했다.
- 단일 공용 모달 `globalEventModal`에 선택 카드의 상세 설명, 이미지, 기사 링크를 바인딩하도록 했다.
- Bootstrap JS가 로드되지 않는 환경에서도 모달이 작동하도록 fallback modal 엔진을 추가했다.
- `supabase/schema-and-seed.sql`에 테이블, RLS 정책, Storage 버킷, realtime publication, seed data를 작성했다.
- `README.md`에 Supabase 설정과 로컬 실행 방법을 기록했다.

## 2026-06-17 Supabase 연결 지원

사용자는 Supabase 계정을 만들었고 연결 여부를 질문했다.

진행 내용:

- Supabase Project URL은 `https://dkutzurwvvluzouwujvu.supabase.co`로 확인했다.
- 프론트엔드에는 `service_role`, `secret`, `sb_secret_...` 키를 절대 넣지 말고, Publishable key 또는 legacy anon public key만 넣어야 한다고 안내했다.
- SQL 실행 중 `syntax error at end of input` 오류가 발생해 `DO $$ ... end; $$;` 블록의 `end;` 세미콜론을 수정했다.
- 사용자가 `supabase_yonginpeople` MCP 서버를 추가했으나, 처음에는 프로젝트 URL이 MCP URL로 들어가 있었다.
- MCP URL을 `https://mcp.supabase.com/mcp?project_ref=dkutzurwvvluzouwujvu` 형태로 고쳤다.
- MCP Authorization 헤더 설정을 정리했고, `execute_sql`은 승인 모드로 설정했다.
- CLI 기준으로 `supabase_yonginpeople` MCP 서버가 enabled 상태임을 확인했다.

## 2026-06-17 추가 개발 지시

사용자는 다음을 요청했다.

- 공개 `index.html`의 타임라인 순서를 역순으로 바꿔 최신 기록이 위로 오게 한다.
- 지금까지 작업한 히스토리 파일을 만들고, 사용자가 지시한 것들을 적어둔다.
- 관리자용 페이지를 만들어 사진 같은 자료를 업로드할 수 있게 한다.

진행 방향:

- 공개 타임라인은 날짜 내림차순으로 조회하고 렌더링한다.
- Supabase URL/key 설정을 `config.js`로 분리해 공개 페이지와 관리자 페이지가 함께 사용한다.
- 관리자 페이지는 Supabase Auth 로그인 후 `timeline_history` 기록을 생성, 수정, 삭제할 수 있게 한다.
- 관리자 페이지에서 `event-images` Storage 버킷에 사진을 업로드하고, 받은 Public URL을 `image_url`에 자동 반영한다.
- 관련 기사는 JSON 배열 대신 제목/URL 입력 행으로 관리하고 저장 시 `articles` JSONB 구조로 변환한다.

구현 내용:

- `config.js`를 ES module 설정 파일로 만들고 `app.js`, `admin.js`에서 직접 import하도록 바꿨다.
- 공개 타임라인은 `event_date`에서 날짜를 파싱해 내림차순으로 표시하고, 같은 날짜면 `created_at` 내림차순으로 표시한다.

## 2026-06-17 정렬 및 날짜 입력 방식 변경

사용자는 다음을 요청했다.

- 히스토리에 정렬 순서를 넣지 않고 날짜에 따라 자동 정렬되게 한다.
- 날짜도 직접 입력하지 않고 달력으로 선택할 수 있게 한다.

구현 내용:

- 공개 페이지와 관리자 페이지 모두 `sort_order`를 사용하지 않도록 변경했다.
- `event_date` 문자열에서 날짜를 파싱해 최신순으로 자동 정렬하도록 했다.
- 관리자 페이지의 날짜 입력을 `type="date"` 달력 입력으로 변경했다.
- 관리자 페이지에서 선택한 날짜는 저장 시 `2026년 6월 16일` 형식으로 자동 변환한다.
- `supabase/schema-and-seed.sql`에서 `sort_order` 컬럼과 seed 값을 제거했고, 기존 테이블의 `sort_order` 컬럼도 `drop column if exists`로 제거하도록 했다.
- MCP를 통해 실제 Supabase 프로젝트를 확인했고, `timeline_history.sort_order` 컬럼 제거 migration을 적용했다.
- MCP를 통해 `event-images` 버킷이 public이고 Storage 정책 4개가 설정되어 있음을 확인했다.
- Storage에는 업로드된 객체가 없고, 최근 히스토리 기록의 `image_url`도 `null`임을 확인했다.
- 기존 기록에서 사진을 업로드하면 `image_url`을 즉시 DB에 저장하도록 관리자 로직을 보강했다.
- Supabase Management API에서 브라우저용 publishable key를 확인해 `config.js`에 적용했다. secret/service_role 키는 프론트에 넣지 않았다.
- `admin.html`, `admin.css`, `admin.js`를 추가해 관리자 로그인, 기록 목록, 편집 폼, 사진 업로드, 기사 링크 입력 UI를 구현했다.
- Supabase 공개 키가 비어 있으면 관리자 화면은 설정 안내를 표시하고, 공개 화면은 참조 데이터 fallback을 유지한다.
