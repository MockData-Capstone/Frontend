# ZIPFIT — Frontend (`zipfit`)

> **같이 집 찾기.** 친구들과 워크스페이스를 만들어 함께 집을 알아보는 과정(대화 → AI 위치 추천 → 후보지 비교 → 투표 → 매물 검색 → 임장)을 하나의 공간에서 처리하는 서비스의 프론트엔드 저장소.

2026 계명대학교 컴퓨터공학전공 **캡스톤 디자인(1)** 프로젝트 · 팀 **목데이터**

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)

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

여럿이 함께 집을 구할 때 필요한 다섯 단계(조건 논의 → 지역 후보 → 후보지 비교 → 의사결정 → 임장)를 하나의 워크스페이스 화면 안에서 처리한다. 백엔드가 대화 분석·외부 API 조회·딥링크 조합을 전담하고, 프론트는 그 결과를 워크스페이스 흐름(채팅 → 지도 → 비교표 → 투표 → 매물 링크 → 투어)에 맞춰 보여주는 데 집중한다.

**1차 개발 범위(MVP)는 F-01 ~ F-08**이다. 지역 커뮤니티(F-09)는 Phase 2.

---

## Core Features

| # | 기능 | 설명 |
|---|------|------|
| **F-01** | 워크스페이스 생성 / 초대 | 워크스페이스 생성, 초대 링크(7일 만료)로 친구 참여 |
| **F-02** | 그룹 채팅 | 실시간 텍스트 채팅으로 지역·예산·평수 등 조건 논의 |
| **F-03** | AI 기반 위치 추천 | 대화 로그 기반 AI 추천 위치를 카카오맵에 마커로 표시 (비동기, 로딩 UI 필수) |
| **F-04** | 부가 정보 추천 | 추천 위치의 편의시설/경사도/차량 진입 가능 여부 등 추가 조회 제안 |
| **F-05** | 후보지 비교표 | 경사도·일조량·소음·편의시설 접근성 등 항목별 비교 |
| **F-06** | 후보지 투표 | 후보지별 👍/👎, 멤버당 1표(변경 가능) |
| **F-07** | 매물 검색 링크 연결 | 백엔드가 생성한 네이버부동산/직방 검색결과 딥링크로 이동 |
| **F-08** | 방문자 선정 미니게임 + 실시간 그룹 투어 | 임장 방문자 뽑기(가위바위보/룰렛), WebRTC 화상통화로 워크스페이스 멤버 실시간 참여 |

> 기능 상세는 **팀 기능명세서** 문서 참고.

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
| **지도** | react-kakao-maps-sdk | 지도/마커/로드뷰 렌더링 (F-03, F-04) |
| **실시간 통신** | STOMP.js + SockJS, 브라우저 내장 WebRTC API | 채팅(F-02), 투어(F-08) |
| **상태관리** | React Context API | 워크스페이스 단위로 상태 범위가 명확해 Redux/Zustand 미도입 |
| **HTTP 클라이언트** | axios | JWT 헤더 자동 첨부 인스턴스 |

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
| `VITE_KAKAO_JS_KEY` | 카카오맵 JavaScript 키 (도메인 제한 설정) | ✅ (F-03, F-04) |

> ⚠️ OpenAI API 키, 카카오 REST API 키는 **서버 전용**이라 프론트엔드 환경 변수로 두지 않는다.

---

## Folder Structure

```
src/
  app/
    providers/           # AuthProvider, WorkspaceProvider 등 전역 Context
  components/
    Workspace/            # 워크스페이스 생성/초대 (F-01)
    Chat/                 # 그룹 채팅 UI (F-02)
    Map/                  # 카카오맵, 로드뷰, 후보지 마커 (F-03, F-04)
    Comparison/           # 후보지 비교표 (F-05)
    Vote/                 # 👍/👎 투표 (F-06)
    Listing/              # 매물 검색 링크 카드 (F-07)
    Tour/                 # 방문자 뽑기, WebRTC 그룹 통화 (F-08)
  lib/
    api.ts                # axios 인스턴스 (JWT 헤더 자동 첨부)
    chatApi.ts, workspaceApi.ts, recommendationApi.ts, voteApi.ts, listingApi.ts, tourApi.ts
    websocket.ts          # STOMP 클라이언트 초기화
    webrtc.ts             # RTCPeerConnection 래퍼
  pages/                  # 라우트 단위 페이지
  types/                  # 백엔드 API 응답/DTO 타입 정의
```

---

## 화면 ↔ 기능 매핑

| 기능 | 담당 컴포넌트/페이지 |
|---|---|
| F-01 워크스페이스 생성/초대 | `components/Workspace`, `pages/WorkspaceCreate`, `pages/Invite` |
| F-02 그룹 채팅 | `components/Chat`, `lib/websocket.ts` |
| F-03 AI 위치 추천 | `components/Map`, `lib/recommendationApi.ts` (결과 폴링/구독, 로딩 UI 필수) |
| F-04 부가 정보 추천 | `components/Map` 내 추가 조회 제안 UI |
| F-05 후보지 비교표 | `components/Comparison` |
| F-06 후보지 투표 | `components/Vote` |
| F-07 매물 검색 링크 | `components/Listing` (백엔드가 조합한 딥링크로 이동만 수행) |
| F-08 방문자 미니게임/투어 | `components/Tour`, `lib/webrtc.ts` |

---

## 경계 원칙 — 백엔드와의 책임 분리

- **카카오맵 JS SDK만 클라이언트에서 직접 호출**한다 (도메인 제한된 JS 키 사용, 이미지 캡처/저장 금지).
- **OpenAI API, 카카오 로컬/모빌리티 API는 프론트에서 직접 호출하지 않는다.** F-03·F-04·F-07의 실제 조회/조합은 백엔드가 서버 키로 담당하고, 프론트는 결과 표시와 링크 이동만 수행한다.
- 매물 검색 링크는 백엔드가 만들어준 딥링크로 단순 이동만 하며, 프론트에서 URL 파라미터를 직접 조합하지 않는다(크롤링 금지 정책은 백엔드 쪽 정책 참고).

---

## Collaboration Rules

- 브랜치 전략: `main` / `develop` / `feature/F-{번호}-{요약}`
- 기능 단위 브랜치 생성 → PR 리뷰(1명 이상 승인) 후 merge, `main`/`develop` 직접 push 금지
- 커밋 컨벤션: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- 이슈·PR은 GitHub Issues / Projects로 관리

Team·Schedule은 [Backend README](https://github.com/MockData-Capstone/Backend#team--목데이터) 참고 (팀 구성/일정은 두 저장소 공통).

---

## 관련 문서

| 문서 | 내용 |
|---|---|
| 기능명세서 | F-01 ~ F-09 상세 요구사항 |
| 프론트엔드 아키텍처 명세서 | 화면-기능 매핑, 인증 흐름, 외부 연동 경계 |

---

<sub>© 2026 팀 목데이터 · 계명대학교 컴퓨터공학전공 캡스톤 디자인(1)</sub>
