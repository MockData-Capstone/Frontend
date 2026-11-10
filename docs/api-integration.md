# 백엔드 API와 프론트 화면 연결

2026-11-11 기준. Backend `72450c2`의 컨트롤러와 실제 응답을 기준으로 확인했다. 이 문서의 '연결'은 화면에서 API를 호출하고 결과·오류를 처리한다는 뜻이며, 외부 AI·OAuth·푸시 사업자의 실제 운영까지 보장한다는 뜻은 아니다.

## 연결 범위

`W`는 `/api/workspaces/{workspaceId}`를 의미한다.

| 기능 | API / 메시지 | 화면과 동작 |
|---|---|---|
| 자체 가입·로그인 | POST `/api/auth/signup`, `/login`; GET `/email-availability`, `/api/users/nickname-availability` | 기존 가입·중복 확인 유지, 로그인 |
| 로그인 유지·종료 | POST `/api/auth/token/refresh`, `/logout` | 메모리 접근 토큰 + httpOnly 재발급 쿠키, 새로고침 복원·동시 갱신 병합 |
| 소셜 로그인·가입·계정 병합 | GET `/api/auth/{kakao\|google}/authorize-url`; POST `/api/auth/{provider}`, `/signup/social`, `/{provider}/link` | 로그인 → 공급자 콜백 → 기존 계정 로그인/신규 가입/동일 이메일 계정 연결 |
| 내 정보 | GET/PATCH/DELETE `/api/users/me`; PATCH `/me/profile-image`; POST `/me/social/{provider}` | `/account`: 닉네임·이미지 업로드/초기화·비밀번호·소셜 연결·회원 탈퇴 |
| 비밀번호 재설정 | POST `/api/auth/password-reset/request`, `/confirm` | `/password-reset`: 메일 요청, 링크 토큰 검증·새 비밀번호 |
| 그룹 | POST/GET `/api/workspaces`; GET/PATCH/DELETE `W` | 기존 목록·생성, `/workspaces/:id/settings`의 정보 수정·삭제 |
| 멤버·초대 | GET `W/members`; PATCH `W/host`; DELETE `W/members/me`, `W/members/{id}`; POST `W/invitations`; GET `W/invitations/current`; GET `/api/invitations/{token}`, POST `/accept` | 설정의 호스트 위임·나가기·내보내기, 기존 초대 발급·미리보기·수락 |
| 채팅 | GET `W/messages?before=…&after=…`; 소켓 `CHAT_SEND`, `CHAT_MESSAGE`, `ERROR` | `/workspaces/:id/search`: 이전 기록·실시간 메시지·재접속 누락 복원·전송 재시도 |
| 추천 | POST/GET `W/recommendations`; `RECOMMENDATION_*` | 대화로 추천 요청, 비동기 로딩·오류·결과, 완료 이벤트/5초 폴링 |
| 후보지·입지 | POST/GET `W/candidates`; GET/PATCH/DELETE `/api/candidates/{id}` | 추천에서 추가, 기존 목록·상세·이름 수정·삭제, 경사·차량 진입 정보 표시 |
| 비교 | GET/POST `W/comparisons` | `/comparisons`: 선택 후보지 비교표·최신 정보 갱신 (2곳 이상) |
| 투표 | POST `/api/candidates/{id}/votes`; PATCH `/votes/me`; GET `W/votes` | `/votes`: 찬성·반대 등록/변경, 집계·멤버별 의견 |
| 조건 | GET/POST/PUT `W/condition`; GET `W/condition-suggestions`; POST `W/condition-suggestions/{type}/accept` | `/conditions`: 추출 초안→확정→전체 수정, 범위 검사, 제안 근거·수락 |
| 매물 링크 | GET `W/listing-links?candidateId=…` | `/listings`: 후보지 선택, 적용/제외 조건, 네이버부동산·직방 링크 |
| 알림 | GET `/api/notifications`, `/unread-count`; PATCH `/read-all`, `/{id}/read`; `/ws/notifications` | `/notifications`: 목록·커서 페이지·읽음·모두 읽음·필터·관련 화면·실시간 배지 |
| 푸시 구독 | GET `/api/push-subscriptions/vapid-public-key`; POST/DELETE `/api/push-subscriptions` | 알림함: 지원·서버 활성 여부 안내, 명시적 구독/해제·기존 구독 재연결, Service Worker |
| 미니게임 (기존) | POST `W/minigames`; GET `W/minigames/current`, `W/minigames`, `/api/minigames/{id}`; POST `/draw`, `/rounds/{round}/choices`; DELETE `/api/minigames/{id}` | 기존 룰렛·가위바위보·결과·중단 화면 유지 |
| 투어 (기존) | POST/GET `W/tours`; GET `W/tours/current`; POST `/api/tours/{id}/participants`, `/rejoin`; DELETE `/participants/me`, `/api/tours/{id}`; GET `/ice-servers`; 시그널링 소켓 | 기존 시작·참여·퇴장·종료·재참여·WebRTC 유지 |

그룹 기본 진입은 `/search`이며 단계 링크로 후보지·비교·투표·조건·매물 검색을 왕복할 수 있다. 헤더의 프로필과 알림 버튼은 각각 계정·알림 화면으로 연결된다.

## 오류·동시성 처리

- 채팅은 서버 메시지 ID로 중복을 제거한다. 재전송은 같은 `clientMessageId`를 사용하며 10초 안에 응답이 없으면 재시도를 안내한다. 연결이 끊기면 전송을 막고, 재접속 뒤 마지막 메시지 이후를 조회한다.
- 추천은 시작·완료·실패 이벤트에 맞춰 다시 조회한다. 실패나 빈 결과를 성공 결과로 꾸미지 않는다. 후보지 중복 추가·권한 오류를 서버 메시지로 표시한다.
- 금액은 정수·비음수, 면적은 비음수, 각 최소값은 최대값 이하로 검사한다. `0`, `false`, `null`을 보존한다. 실시간 조건 갱신이 사용자의 입력을 덮어쓰지 않으며 명시적으로 최신 조건을 불러온다.
- 최초 투표는 POST, 변경은 PATCH를 사용한다. 서버 충돌·권한·잘못된 ID 오류를 표시한다.
- OAuth는 공급자·용도와 함께 임의 `state`를 세션 저장소에 보관하고 10분 만료·불일치·재사용을 거부한다. 계정 연결의 현재 비밀번호는 저장하지 않는다.
- 프로필 파일은 JPEG/PNG/WebP, 5MB 이하이며 빈 파일을 막는다. 실제 업로드는 multipart로 보낸다.
- 그룹 삭제는 정확한 그룹 이름, 탈퇴는 확인 문구를 요구한다. 권한은 UI 표시와 별개로 서버에서 검증한다.
- 외부 매물 링크는 HTTP(S)만 허용한다. 푸시 해제의 서버 요청이 실패하면 브라우저 구독을 유지하여 재시도할 수 있다.

## 검증 결과

| 검사 | 결과 | 범위 |
|---|---|---|
| `npm test` | 26/26 통과 | 쿠키 인증 14개 + 채팅·조건·투표·OAuth state·프로필 검증·알림 경로·푸시 실패 12개 |
| `npm run lint` | 통과 | ESLint |
| `npm run build` | 통과 | TypeScript와 Vite 프로덕션 빌드 |
| `npm run test:integration` | 26/26 통과 | 실제 프론트 API 함수 → H2 백엔드 HTTP/WebSocket, 아래 상세 |
| Backend `gradlew.bat test --rerun-tasks` | 22개 스위트, 111/111 통과 | 백엔드 전체 테스트, 실패·오류·건너뜀 0 |
| 브라우저 | 확인 | 로그인 유지, 빈 채팅 추천 오류, 메시지 전송·추천·후보지 추가·비교, 투표 등록/변경, 조건 범위 오류/저장/제안 수락, 매물 링크, 알림 읽음, 닉네임·그룹 소개 수정 |

통합 검증에는 비멤버/비호스트 접근 거부, 채팅 중복 재전송·빈 메시지 오류, 추천 완료 소켓 이벤트, 후보지 중복·소유권, 투표 충돌, 확정 조건 없는 매물 검색, 조건 범위·중복 확정, 제안 수락, 알림 읽음, 푸시 구독 소유권, 프로필 중복·잘못된 이미지, 비밀번호 변경·재설정 토큰 재사용 거부, 잘못된 비밀번호의 소셜 연결, 호스트 위임 전 나가기/탈퇴 거부, 위임·강퇴·초대 무효화, 후보지·그룹·계정 삭제가 포함된다.

실제 외부 OAuth 로그인, 실제 수신 기기의 웹 푸시, 다기기 카메라·TURN 통화는 이번 검증에서 실행하지 않았다. 지도 SDK는 등록 도메인을 사용해야 한다. `127.0.0.1` 격리 환경에서는 카카오 지도 도메인 허용 설정에 따라 지도가 표시되지 않을 수 있다.

## 격리 통합 검증 재현 (PowerShell)

Node.js 22 이상과 JDK 21, 설치된 프론트 의존성이 필요하다. 테스트는 계정·그룹 생성/삭제를 포함한다. **Neon에 연결된 8080 서버에서는 실행하지 않는다.** 아래 설정은 전용 PowerShell 창에서만 지정하고 창을 닫아 해제한다. `.env`는 수정하지 않는다.

Backend 디렉터리의 첫 번째 터미널:

```powershell
# java -version이 21인지 확인. 필요한 경우 설치한 JDK 경로로 JAVA_HOME을 지정한다.
$env:SPRING_CONFIG_IMPORT='optional:file:build/integration-no-env.properties'
$env:DB_URL='jdbc:h2:mem:zipfit_frontend_integration;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1'
$env:DB_USERNAME='sa'
$env:DB_PASSWORD=''
$env:JWT_SECRET='isolated-integration-test-key-not-for-production-20261111'
$env:JWT_ACCESS_EXPIRE='30m'
$env:MAIL_USERNAME='test@example.invalid'
$env:MAIL_PASSWORD='test-only'
$env:SPRING_MAIL_HOST='127.0.0.1'
$env:SPRING_MAIL_PORT='2525'
$env:SPRING_MAIL_PROPERTIES_MAIL_SMTP_AUTH='false'
$env:SPRING_MAIL_PROPERTIES_MAIL_SMTP_STARTTLS_ENABLE='false'
$env:CORS_ALLOWED_ORIGINS='http://127.0.0.1:5175'
$env:FRONTEND_URL='http://127.0.0.1:5175'
$env:PUBLIC_BASE_URL='http://127.0.0.1:8081'
$env:STORAGE_LOCAL_DIR='build/frontend-integration-uploads'
.\gradlew.bat bootRun --args='--server.address=127.0.0.1 --server.port=8081'
```

`integration-no-env.properties`는 만들 필요 없다. 존재하지 않는 선택 파일로 기본 `.env` import를 대체한다. 기존 셸에 별도 DB/메일/AI/OAuth 설정이 있다면 깨끗한 전용 셸에서 실행한다. 서버가 시작된 뒤 Frontend 디렉터리의 두 번째 터미널:

```powershell
$env:ZIPFIT_TEST_ALLOW_WRITES='isolated-h2'
npm run test:integration
```

스크립트는 `127.0.0.1:8081`만 사용하며, 재설정 메일은 자체 로컬 SMTP `127.0.0.1:2525`에서 받는다. `.invalid` 테스트 주소로 외부 메일을 보내지 않는다. 결과와 브라우저용 테스트 계정은 Git에서 제외된 `node_modules/.cache/integration-{results,fixture}.json`에 저장된다. 실행 중인 백엔드에 테스트 데이터를 남기므로 종료하면 H2 데이터를 함께 폐기한다. 이미지 테스트 파일은 Backend의 `build` 아래에만 저장된다.

브라우저 검증이 필요하면 같은 두 번째 터미널에서:

```powershell
$env:VITE_API_BASE_URL='http://127.0.0.1:8081'
$env:VITE_NOTIFICATIONS='on'
npm run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

기존 `localhost:5173`/`localhost:8080` 개발 서버와 분리된다. 테스트 서버를 종료할 때 해당 터미널에서 Ctrl+C를 사용한다.

## 백엔드 또는 외부 설정이 남은 부분

- 현재 `FakeAiClient`의 추천·입지 결과는 예시 값이다. 프론트는 임시 추천 문구와 추정치 표시를 유지한다.
- `LoggingWebPushSender`는 발송 내용을 기록하는 구현이다. VAPID 조회·구독 저장/삭제 API와 브라우저 수신 코드가 있어도 실제 웹 푸시 발송 서버 구현이 추가로 필요하다.
- 카카오·구글은 서버 자격증명과 두 콜백 URL 등록, 실제 재설정 메일은 메일 서버 설정이 필요하다.
- 로드뷰 직접 보기, 지도 경사/차량 레이어, 일조·소음, 투어 메모는 대응 백엔드 API가 없어 이번 연결 범위에 포함하지 않았다.
- 기존 미니게임·투어 API 연결은 유지했다. 실제 영상 품질·다기기 복구·TURN 동작은 별도 실기기 검증 대상이다.
