# 기존 UI를 유지하는 API 연동 현황

2026-11-11 기준. Backend `72450c2`의 API 계약을 확인했다. **프론트 화면이 구현된 기능과 API 클라이언트만 준비된 기능은 구분한다.** Figma를 확인하지 않고 화면·버튼·스타일·이동 흐름을 새로 만들지 않는다.

기존 화면의 기준은 이번 API 연결 작업 전 커밋 `3f246cc`이다. 이 기준은 기존 프론트 코드이며, Figma 원본과의 일치 여부를 새로 검증했다는 뜻은 아니다. 이 작업 중 임의로 추가했던 화면·CSS·버튼·라우트는 제거하고 기존 구성을 복구했다.

## 기존 UI에서 연결된 기능

| 기존 화면/요소 | 연결 내용 |
|---|---|
| 자체 가입·로그인·로그아웃 | 가입·이메일/닉네임 중복 확인·로그인·내 정보 조회·세션 복원·로그아웃 |
| 카카오 로그인·가입·계정 연동 | 기존 버튼과 콜백/가입/연동 화면을 유지하며 OAuth 요청의 state 검증을 적용 |
| 그룹 목록·생성 | 그룹 조회·생성·상세·실시간 갱신 |
| 친구 초대·초대 수락 | 현재 링크 조회·링크 발급·공개 미리보기·수락 |
| 후보지 목록·상세 | 후보지 조회·이름 수정·삭제, 서버가 반환한 입지 정보 표시 |
| 미니게임 | 시작·진행 상태·결과·룰렛·가위바위보·중단 |
| 실시간 투어 | 시작·참여·재참여·퇴장·종료·ICE 설정·시그널링 |
| 기존 알림 배지 | 안 읽은 개수 조회·알림 소켓 갱신. 알림함 버튼의 미구현 상태는 유지 |

그룹 기본 진입은 기존과 동일하게 후보지 목록이다. 헤더·로그인·후보지 화면의 추가 버튼과 링크는 제거했다. 카카오 로그인 화면의 JSX는 작업 전과 같고, 요청/콜백 처리에만 state 검증이 추가됐다.

## API는 있으나 화면에서 이용할 수 없는 기능

| 기능 | 남아 있는 코드 | 화면 상태 |
|---|---|---|
| 채팅 | 기록 조회, 메시지 병합, Workspace 소켓 전송 함수 | 기존 `Chat` 컴포넌트는 TODO와 `return null` |
| 추천·후보지 추가 | 분석 요청/조회, 후보지 생성 API | 대화·추천 화면 미구현 |
| 비교·투표 | 비교 조회/갱신, 투표 조회/등록/변경 API | 기존 컴포넌트는 TODO와 `return null` |
| 조건 확정·제안 | 조건 조회/생성/수정, 범위 검사, 제안 조회/수락 API | 화면 미구현 |
| 매물 검색 | 서버 링크 조회와 URL 검사 | 기존 `Listing` 컴포넌트는 TODO와 `return null` |
| 계정 관리·재설정 | 프로필·비밀번호·소셜 연결·탈퇴·재설정 API 함수 | 별도 계정/재설정 화면 미구현 |
| 구글 로그인 | 공급자 공통 OAuth/API 함수 | 구글 버튼·콜백 라우트 미추가 |
| 그룹 설정·멤버 관리 | 수정·삭제·위임·나가기·내보내기 API | 설정 화면 미구현 |
| 알림함·푸시 구독 | 알림 목록/읽음 API, 구독 함수·수신 워커 | 알림함·구독 UI 미구현; 워커 자동 등록 없음 |

위 기능은 **API 클라이언트와 테스트가 준비된 상태**이며 UI 연동 완료라고 표현하지 않는다. Figma에 디자인이 있더라도 현재 저장소에 화면 코드가 없는 경우 임의의 대체 UI를 만들지 않는다.

## 검증

- `npm test`: 인증 14개 + API 클라이언트 관련 12개, 총 26개. 채팅 중복·삭제 메시지, 소켓 전송 상태, 조건 유효성/값 보존, 투표 POST/PATCH, 외부 URL, OAuth state, 이미지/비밀번호 입력 검사, 알림 경로, 푸시 실패를 검증한다. 미구현 화면의 브라우저 테스트를 의미하지 않는다.
- `npm run lint`, `npm run build`: 정적 검사 및 프로덕션 빌드.
- `npm run test:integration`: 실제 프론트 API 함수를 H2 백엔드 HTTP/WebSocket에 연결하는 26개 검사. 그룹 권한·채팅·추천·후보지·투표·비교·조건·알림·프로필·비밀번호·삭제의 정상/오류 계약을 검증한다. **화면이 없는 API도 테스트 대상**이다.
- Backend `gradlew.bat test --rerun-tasks`: 22개 스위트, 111개 통과 (백엔드 코드는 이번 범위 조정에서 변경하지 않음).

임시로 추가한 화면에서 수행한 과거 브라우저 검증은 현재 UI의 검증 근거로 사용하지 않는다. 범위 조정 뒤에는 기존 화면 복구와 인증/UI 구성 유지 여부를 확인한다. 외부 OAuth 공급자 로그인, 실제 푸시 수신, 다기기 카메라·TURN 통화는 별도 검증 대상이다.

## 격리 통합 검증 재현 (PowerShell)

Node.js 22 이상, JDK 21, 설치된 프론트 의존성이 필요하다. 계정·그룹 생성/삭제를 포함하므로 **Neon에 연결된 8080 서버에서는 실행하지 않는다.** 전용 터미널의 환경 변수로만 설정하고 `.env`는 수정하지 않는다.

Backend 디렉터리의 첫 번째 터미널:

```powershell
# java -version이 21인지 확인. 필요 시 JAVA_HOME을 설치한 JDK 경로로 지정한다.
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

`integration-no-env.properties`는 만들 필요 없다. 존재하지 않는 선택 파일로 기본 `.env` import를 대체한다. 별도 DB/메일/AI/OAuth 설정이 없는 전용 셸을 사용한다. 서버 시작 후 Frontend 디렉터리의 두 번째 터미널:

```powershell
$env:ZIPFIT_TEST_ALLOW_WRITES='isolated-h2'
npm run test:integration
```

스크립트는 `127.0.0.1:8081`만 사용하며 비밀번호 재설정 메일은 로컬 SMTP `127.0.0.1:2525`에서 받는다. 결과/테스트 계정은 Git에서 제외된 `node_modules/.cache`에 저장한다. 테스트 데이터는 H2 종료 시 폐기되고 이미지 파일은 Backend의 `build` 아래에 저장된다. `5173`/`8080` 개발 서버와 분리된다.

## 서버 측 제한

- 현재 `FakeAiClient` 추천·입지 결과는 예시 값이다.
- `LoggingWebPushSender`는 기록용 구현이므로 실제 웹 푸시 발송은 별도 구현이 필요하다.
- OAuth/메일/지도/TURN은 각 서비스의 환경 설정과 실기기 검증이 필요하다.
- 로드뷰 직접 보기, 지도 경사/차량 레이어, 일조·소음, 투어 메모는 대응 API가 없다.
