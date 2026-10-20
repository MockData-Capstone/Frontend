# ZIPFIT — Frontend (`zipfit`)

> **같이 집 찾고, 비교하고, 투표하고, 실시간으로 둘러보기.** 친구·룸메이트 그룹이 하나의 Workspace에서 대화 → AI 분석 → 입지 검증(경사도·진입성) → 비교 → 투표 → 매물 검색 → 실시간 룸투어까지 이어서 처리하는 서비스의 프론트엔드 저장소.

2026 계명대학교 컴퓨터공학전공 **캡스톤 디자인(1)** 프로젝트 · 팀 **목데이터**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)

> 📄 이 README는 Notion [ZIPFIT PRD](https://app.notion.com/p/3ffb90513fa081478a30fd5e21aa6743) v0.8 · [ZIPFIT 기능명세서](https://app.notion.com/p/3ffb90513fa08135b7d9e3e1e0cbe012) v0.9 기준으로 작성되었습니다. 두 문서의 전문은 [Backend 저장소](https://github.com/MockData-Capstone/Backend)에 `PRD.md` / `기능명세서.md`로 미러링되어 있습니다(Notion 게스트 권한만 있어 Claude 연동이 안 되는 팀원을 위함). 원본은 Notion이며, 더 최신일 수 있습니다.

---

## 목차

1. [Overview](#overview)
2. [Core Features](#core-features)
3. [Tech Stack](#tech-stack)
4. [Getting Started](#getting-started)
5. [환경 변수](#환경-변수)
6. [Folder Structure](#folder-structure)
7. [화면 ↔ 기능 매핑](#화면--기능-매핑)
8. [경계 원칙 — 백엔드와의 책임 분리](#경계-원칙--백엔드와의-책임-분리)
9. [Collaboration Rules](#collaboration-rules)
10. [관련 문서](#관련-문서)

---

## Overview

여럿이 함께 집을 구할 때 필요한 흐름(로그인·초대 → 채팅 → AI 분석 → 입지 확인 → 비교 → 투표 → 조건 확정·매물 검색 → 미니게임·실시간 투어)을 하나의 Workspace 화면 안에서 처리한다. 백엔드가 대화 분석(로컬 LLM)·입지 분석(공공데이터+VLM)·외부 API 조회·딥링크 조합을 전담하고, 프론트는 그 결과를 흐름에 맞춰 보여주는 데 집중한다.

**1차 개발 범위(캡스톤(1) MVP)는 PRD 7장의 P0 요구사항 전체**다. 상세 기능 ID·CRUD·예외 규칙은 [Backend의 `기능명세서.md`](https://github.com/MockData-Capstone/Backend/blob/main/기능명세서.md) 참고.

---

## Core Features

> 기능 ID는 Backend [`기능명세서.md`](https://github.com/MockData-Capstone/Backend/blob/main/기능명세서.md) 기준. 기존 F-01~F-09 체계는 폐기되었다.

| 단계 | 기능 ID | 설명 |
|---|---|---|
| 0. 회원·Workspace | `AUTH`, `WS`, `MEM` | 카카오 로그인(P0)·자체 가입(P1), Workspace 생성, 초대 링크(7일 만료)로 참여, 멤버·호스트 관리 |
| 1. 채팅 | `CHAT` | 실시간 텍스트 채팅으로 지역·예산·평수 등 조건 논의 |
| 2. AI 위치 추천 | `REC` | 대화 로그 기반 추천 위치를 카카오맵에 마커로 표시 (비동기, 로딩 UI 필수). 대화에 없던 **조건 제안**도 근거와 함께 수락/거절 UI로 노출 |
| 3. 입지 분석 | `LOC` | 추천 위치의 경사도(평균·최대·등급)·차량 진입성(가능/제한적/불가) 표시. 신뢰도 낮은 값은 "추정치 — 현장 확인 필요" 표시. 로드뷰 직접 확인(P1) |
| 4. 후보지·비교 | `CAND`, `CMP` | 후보지 추가/제외/이름 수정, 경사도·진입성 비교표 |
| 5. 투표 | `VOTE` | 후보지별 👍/👎, 멤버당 1표(변경 가능), "의견 갈림" 하이라이트 |
| 6. 조건 확정·매물 검색 | `COND`, `LINK` | LLM 추출 조건을 초기값으로 검토·확정, 백엔드가 생성한 네이버부동산/직방 검색결과 딥링크로 이동 |
| 7. 미니게임·실시간 투어 | `GAME`, `TOUR`, `SIG` | 방문자 뽑기(룰렛/가위바위보), WebRTC 화상통화(P2P 우선, TURN 전환)로 워크스페이스 멤버 실시간 참여. 최대 6인, 끊김 시 자동 재연결 |
| 공통. 알림 | `NOTI` | 새 멤버 입장·새 메시지·AI 분석 완료·투표·투어 시작 앱 내 알림 + 알림함(P1), 웹 푸시(P2) |

---

## Tech Stack

### 확정 (`package.json` 기준)

| 계층 | 기술 |
|---|---|
| **Framework** | React 19 + TypeScript (Vite 8) |
| **Lint** | ESLint 10 (flat config) + typescript-eslint |

### 예정 (미적용)

| 계층 | 기술 | 용도 |
|---|---|---|
| **스타일링** | Tailwind CSS | 아직 설치되지 않음 — 필요 시 `npm install -D tailwindcss postcss autoprefixer` |
| **라우팅** | react-router-dom | 페이지 라우팅 |
| **지도** | react-kakao-maps-sdk | 지도/마커/로드뷰 렌더링 (REC, LOC) |
| **실시간 통신** | STOMP.js + SockJS, 브라우저 내장 WebRTC API | 채팅(CHAT), 투어(TOUR, SIG) |
| **소셜 로그인** | 카카오 로그인 SDK (JS) | AUTH-02 |
| **상태관리** | React Context API | 워크스페이스 단위로 상태 범위가 명확해 Redux/Zustand 미도입 |
| **HTTP 클라이언트** | axios | JWT 헤더 자동 첨부 인스턴스 |
| **웹 푸시** | Service Worker + Web Push 구독 | NOTI-04/05 (P2) |

> **TBD** — 이전 스캐폴드에는 Tailwind CSS가 포함돼 있었으나 현재 `package.json`에는 없다. 디자인 작업 시작 시 재도입 여부 팀 논의 필요.

---

## Getting Started

```bash
npm install
npm run dev
```

기본 포트: `http://localhost:5173`

```bash
npm run build      # 타입체크 + 프로덕션 빌드
npm run lint       # ESLint
npm run preview    # 빌드 결과 로컬 미리보기
```

---

## 환경 변수

Vite는 `VITE_` 접두사가 붙은 변수만 클라이언트에 노출한다. `.env.local`에 정의하고 커밋하지 않는다.

| 변수 | 설명 | 필수 |
|---|---|---|
| `VITE_API_BASE_URL` | 백엔드 API base URL | ✅ |
| `VITE_KAKAO_JS_KEY` | 카카오맵 JavaScript 키 (도메인 제한 설정) | ✅ (REC, LOC) |
| `VITE_KAKAO_LOGIN_JS_KEY` | 카카오 로그인 JavaScript 키 | ✅ (AUTH-02) |
| `VITE_WEB_PUSH_VAPID_PUBLIC_KEY` | 웹 푸시 구독용 VAPID 공개 키 | ⬜ (NOTI-04, P2) |

> ⚠️ 카카오 REST API 키, OpenAI 등 외부 LLM 키는 **서버 전용**이라 프론트엔드 환경 변수로 두지 않는다.

---

## Folder Structure

```
src/
  app/
    providers/           # AuthProvider, WorkspaceProvider 등 전역 Context
  components/
    Auth/                 # 카카오/자체 로그인, 내 정보 (AUTH)
    Workspace/            # 워크스페이스 생성/초대/멤버 관리 (WS, MEM)
    Chat/                 # 그룹 채팅 UI (CHAT)
    Map/                  # 카카오맵, 로드뷰, 후보지 마커, 입지 정보 표시 (REC, LOC)
    Candidate/            # 후보지 추가/제외/이름 수정 (CAND)
    Comparison/           # 후보지 비교표 (CMP)
    Vote/                 # 👍/👎 투표 (VOTE)
    Condition/            # 조건 확정 화면 (COND)
    Listing/              # 매물 검색 링크 카드 (LINK)
    MiniGame/             # 방문자 뽑기 (GAME)
    Tour/                 # WebRTC 그룹 통화 (TOUR, SIG)
    Notification/         # 알림함, 알림 배지 (NOTI)
  lib/
    api.ts                # axios 인스턴스 (JWT 헤더 자동 첨부)
    authApi.ts, workspaceApi.ts, chatApi.ts, recommendationApi.ts,
    locationApi.ts, candidateApi.ts, voteApi.ts, conditionApi.ts,
    listingApi.ts, minigameApi.ts, tourApi.ts, notificationApi.ts
    websocket.ts          # STOMP 클라이언트 초기화 (채팅)
    webrtc.ts             # RTCPeerConnection 래퍼, 시그널링 클라이언트
  pages/                  # 라우트 단위 페이지
  types/                  # 백엔드 API 응답/DTO 타입 정의
```

---

## 화면 ↔ 기능 매핑

| 기능 ID | 담당 컴포넌트/페이지 |
|---|---|
| `AUTH` 회원·로그인 | `components/Auth`, `pages/Login` |
| `WS`, `MEM` 워크스페이스·초대·멤버 | `components/Workspace`, `pages/WorkspaceCreate`, `pages/Invite` |
| `CHAT` 그룹 채팅 | `components/Chat`, `lib/websocket.ts` |
| `REC` AI 위치 추천 | `components/Map`, `lib/recommendationApi.ts` (결과 폴링/구독, 로딩 UI 필수, 조건 제안 수락/거절 UI) |
| `LOC` 입지 분석 표시 | `components/Map` 내 경사도·진입성 패널, 신뢰도 낮은 값 "추정치" 배지 |
| `CAND`, `CMP` 후보지·비교표 | `components/Candidate`, `components/Comparison` |
| `VOTE` 후보지 투표 | `components/Vote` |
| `COND`, `LINK` 조건 확정·매물 검색 | `components/Condition`, `components/Listing` (백엔드가 조합한 딥링크로 이동만 수행) |
| `GAME`, `TOUR`, `SIG` 미니게임·투어 | `components/MiniGame`, `components/Tour`, `lib/webrtc.ts` |
| `NOTI` 알림 | `components/Notification` |

---

## 경계 원칙 — 백엔드와의 책임 분리

- **카카오맵 JS SDK·카카오 로그인 JS SDK만 클라이언트에서 직접 호출**한다 (도메인 제한된 JS 키 사용, 로드뷰 이미지 캡처/저장 금지).
- **OpenAI 등 외부 LLM API, 카카오 로컬/모빌리티/도보경로 API는 프론트에서 직접 호출하지 않는다.** REC·LOC·LINK의 실제 조회/조합(로컬 LLM 분석, 경사도·진입성 산출, 딥링크 생성)은 백엔드가 서버 키·자체 GPU 서버로 담당하고, 프론트는 결과 표시와 링크 이동만 수행한다.
- 매물 검색 링크는 백엔드가 만들어준 딥링크로 단순 이동만 하며, 프론트에서 URL 파라미터를 직접 조합하지 않는다(크롤링 금지 정책은 Backend README 참고).
- 투어 영상은 녹화·저장하지 않는다. 시그널링(SDP/ICE)만 서버를 거치고 영상 스트림은 P2P(또는 TURN 중계)로만 흐른다.

---

## Collaboration Rules

- 브랜치 전략: `main` / `develop` / `feature/{기능ID}-{요약}` (예: `feature/REC-01-map-marker`)
- 기능 단위 브랜치 생성 → PR 리뷰(1명 이상 승인) 후 merge, `main`/`develop` 직접 push 금지
- 커밋 컨벤션: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- 이슈·PR은 GitHub Issues / Projects로 관리

Team·Schedule은 [Backend README](https://github.com/MockData-Capstone/Backend#team--목데이터) 참고 (팀 구성/일정은 두 저장소 공통).

---

## 관련 문서

| 문서 | 내용 | 링크 |
|---|---|---|
| PRD | 문제 정의, 목표, 요구사항(FR/NFR), 릴리스 범위 | [Backend `PRD.md`](https://github.com/MockData-Capstone/Backend/blob/main/PRD.md) · [Notion](https://app.notion.com/p/3ffb90513fa081478a30fd5e21aa6743) (원본) |
| 기능명세서 | 기능 ID별 CRUD·액터·입력·처리·예외 상세 | [Backend `기능명세서.md`](https://github.com/MockData-Capstone/Backend/blob/main/기능명세서.md) · [Notion](https://app.notion.com/p/3ffb90513fa08135b7d9e3e1e0cbe012) (원본) |
| 프론트엔드 아키텍처 명세서 | 화면-기능 매핑, 인증 흐름, 외부 연동 경계 | TBD |

> ⚠️ `PRD.md` / `기능명세서.md`는 Backend 저장소에만 있다(Notion 게스트 권한만 있어 Claude 연동이 안 되는 팀원을 위한 로컬 사본). 최신성이 의심되면 Notion 원본을 확인할 것.

---

<sub>© 2026 팀 목데이터 · 계명대학교 컴퓨터공학전공 캡스톤 디자인(1)</sub>
