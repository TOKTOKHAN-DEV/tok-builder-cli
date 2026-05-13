---
colors:
  primary:
    "50": "#e4f3ff"
    "100": "#dae9ff"
    "200": "#b9d3ff"
    "300": "#92b1ff"
    "400": "#7b95ff"
    "500": "#5f71ff"
    "600": "#464cfb"
    "700": "#3222d8"
    "800": "#242b87"
    "900": "#1a224b"
    "950": "#0d1239"
  gray:
    "50": "#f4f5fa"
    "100": "#eaebf0"
    "200": "#d9dadf"
    "300": "#c4c5ca"
    "400": "#abacb0"
    "500": "#8b8c90"
    "600": "#6c6d71"
    "700": "#505155"
    "800": "#393a3e"
    "900": "#252629"
    "950": "#16171a"
  semantic:
    background: "{colors.gray.50}"
    foreground: "{colors.gray.950}"
    card: "{colors.gray.50}"
    card-foreground: "{colors.gray.950}"
    popover: "{colors.gray.50}"
    popover-foreground: "{colors.gray.950}"
    primary: "#464cfb"
    primary-foreground: "#ffffff"
    secondary: "{colors.gray.100}"
    secondary-foreground: "{colors.gray.900}"
    muted: "{colors.gray.100}"
    muted-foreground: "#6c6d71"
    accent: "{colors.gray.100}"
    accent-foreground: "{colors.gray.900}"
    border: "{colors.gray.200}"
    input: "{colors.gray.200}"
    ring: "#464cfb"
    destructive: "#DC2626"
    destructive-foreground: "#ffffff"
    success: "#15803D"
    success-foreground: "#ffffff"
    warning: "#F59E0B"
    warning-foreground: "#000000"
    info: "#2563EB"
    info-foreground: "#ffffff"
typography:
  fontFamily:
    sans:
      - Pretendard
    mono:
      - JetBrains Mono
      - monospace
  weight:
    regular: 400
    medium: 500
    semibold: 600
    bold: 700
    normal: 400
  scale:
    headline-xl:
      size: 35px
      lineHeight: "1.15"
      weight: bold
    headline-lg:
      size: 28px
      lineHeight: "1.2"
      weight: bold
    headline-md:
      size: 21px
      lineHeight: "1.25"
      weight: semibold
    headline-sm:
      size: 18px
      lineHeight: "1.3"
      weight: semibold
    title-lg:
      size: 16px
      lineHeight: "1.35"
      weight: semibold
    title-md:
      size: 14px
      lineHeight: "1.45"
      weight: medium
    title-sm:
      size: 12px
      lineHeight: "1.45"
      weight: medium
    body-lg:
      size: 16px
      lineHeight: "1.7"
      weight: regular
    body-md:
      size: 14px
      lineHeight: "1.7"
      weight: regular
    body-sm:
      size: 12px
      lineHeight: "1.55"
      weight: regular
    body-xs:
      size: 12px
      lineHeight: "1.55"
      weight: regular
    caption:
      size: 12px
      lineHeight: "1.35"
      weight: medium
rounded:
  none: 0px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  2xl: 16px
  full: 9999px
spacing:
  "0": 0px
  "1": 4px
  "2": 8px
  "3": 12px
  "4": 16px
  "5": 20px
  "6": 24px
  "7": 28px
  "8": 32px
  "9": 36px
  "10": 40px
  "11": 44px
  "12": 48px
  "14": 56px
  "16": 64px
  "20": 80px
  "24": 96px
  "28": 112px
  "32": 128px
  "0.5": 2px
  "1.5": 6px
  "2.5": 10px
  "3.5": 14px
  breakpoints:
    lg: 1024px
    sm: 640px
    md: 768px
    xl: 1280px
    2xl: 1536px
icons:
  style: regular_rounded
  source: flaticon-uicons
  path: assets/icons/regular_rounded
  rationale: "default weight + moderate radius → regular_rounded: 전문성을 해치지 않으면서 일반 사용자도 부담 없이 탐색할 수 있는 균형형"
components:
  button-primary:
    background: "{colors.semantic.primary}"
    color: "{colors.semantic.primary-foreground}"
    border-radius: "{rounded.md}"
    font-weight: "{typography.weight.semibold}"
  button-primary-hover:
    background: "{colors.primary.700}"
  button-secondary:
    background: "{colors.gray.100}"
    color: "{colors.gray.900}"
    border: 1px solid {colors.gray.200}
    border-radius: "{rounded.md}"
    font-weight: "{typography.weight.medium}"
  input:
    border: 1px solid {colors.semantic.border}
    border-radius: "{rounded.md}"
    background: "{colors.semantic.background}"
    color: "{colors.semantic.foreground}"
  card:
    background: "{colors.semantic.background}"
    border: 1px solid {colors.semantic.border}
    border-radius: "{rounded.lg}"
  alert:
    border-radius: "{rounded.md}"
    border-width: 1px
    padding: 12px 16px
motion:
  duration:
    fast: 150ms
    normal: 200ms
    slow: 300ms
  ease:
    standard: cubic-bezier(0.4, 0, 0.2, 1)
    in: cubic-bezier(0.4, 0, 1, 1)
    out: cubic-bezier(0, 0, 0.2, 1)
    in-out: cubic-bezier(0.4, 0, 0.2, 1)
---

## 1. Overview

**서비스명 / 핵심 기능**: 차량 거래·렌트 심사 관리 웹. 차량 목록, 지도 탐색, 서류·심사 상태를 데스크탑 화면에서 빠르게 확인하는 실용 중심 서비스.

**타깃 사용자**: 혼합 연령대 / 일반 사용자와 관리자 모두를 고려한 중간 수준 디지털 숙련도 / 데스크탑 중심

**브랜드 키워드**: 차량 목록, 지도 탐색, 서류·심사 상태, 금융·렌트사 심사, 데스크탑 중심

**감성 방향**: 검증된 거래의 표준형 — 차량 목록, 지도 탐색, 서류·심사 상태를 한 화면에서 빠르게 확인할 수 있도록 정보 밀도와 가독성을 균형 있게 맞춘 안입니다. 사용자는 금융·렌트사 심사와 연결된 서비스라는 인상을 받고, 과도한 장식 없이 절차가 명확하다고 느낍니다.

**타이포그래피 조정**: PC 웹 중심의 차량 목록, 지도 UI, 관리자 테이블 화면이 많아 compact를 유지하되, 혼합 연령대와 일반 사용자 접근성을 고려해 weight는 default로 설정

**적용된 디자인 무드**: 무드 A안 선택.
데스크탑 중심의 차량 목록·지도·심사 상태 화면에서 정보 밀도와 판독성을 동시에 확보해야 하므로, 과도한 장식보다 명확한 절차와 검증된 거래 인상을 주는 A안이 적합합니다.

---

## 2. Colors

선명한 블루-바이올렛 계열 primary는 금융·렌트사 심사와 연결된 차량 거래 서비스에서 진행 상태와 주요 CTA를 명확하게 드러내는 데 적합합니다.
cool gray는 차량 목록, 지도 탐색, 서류·심사 상태처럼 정보량이 많은 화면에서 안정적이고 절제된 배경 정서를 제공합니다.
semantic.primary(#464cfb)는 primary.500이 아닌 WCAG AA 대비비 확보를 위해 더 진한 primary.600 단계를 사용했습니다.

---

## 3. Typography

**스케일 타입**: Headline(45px+) / Title(14~20px) / Body(12~20px) / Caption(12~14px)
각 타입은 size·lineHeight·weight를 포함한다.

compact sizePreset은 데스크탑 중심의 차량 목록, 지도 UI, 관리자 테이블처럼 한 화면에 많은 정보를 비교해야 하는 맥락에 적합합니다. weightPreset은 default를 사용해 혼합 연령대의 일반 사용자도 심사 상태, 서류 정보, 차량 속성을 부담 없이 읽을 수 있도록 했습니다. 강조는 semibold와 bold에 제한해 검증·심사 서비스의 절차적 명확성을 유지합니다.

---

## 4. Layout

**여백 감각**: default — 차량 목록과 지도, 서류·심사 상태를 동시에 다루는 데스크탑 화면에서 정보 밀도를 유지하면서도 요소 간 구분을 확보하기에 적합합니다.

그리드: 12컬럼 기준. 모바일은 4컬럼.

**반응형 전략**: PRD가 데스크탑 중심 사용을 명시하므로 필수 브레이크포인트는 `lg: 1024px`만 포함합니다. 지원 범위 이하의 화면 크기에서는 **"준비 중입니다"** 안내 화면 표시를 권장합니다.

---

## 5. Elevation & Depth

shadow 대신 배경색 명도 차이로 elevation을 표현한다.  
- 구현 예시: 기본 페이지 배경은 `{colors.gray.50}`, 차량 목록 카드와 심사 상태 패널은 `{colors.semantic.background}`에 1px border를 적용해 구분합니다.

surface → surface-variant → surface-container 계층 사용.  
- 구현 예시: 지도 위 필터 패널은 surface-variant 역할로 `{colors.gray.100}`, 드롭다운·상태 요약 컨테이너는 surface-container 역할로 `{colors.gray.200}` 수준의 명도 차이를 사용합니다.

---

## 6. Motion

**Duration**: fast(150ms) / normal(200ms) / slow(300ms) — 사용자 인지 가능한 최소 단위는 100ms, 200ms 미만은 즉각 반응으로 느껴지고 300ms 초과는 느리게 느껴진다.

**Ease 적용 가이드**:
- 호버/포커스 전환: `duration.fast` + `ease.standard`
- 모달/시트 진입: `duration.slow` + `ease.out`
- 모달/시트 퇴장: `duration.normal` + `ease.in`
- 일반 상태 전환: `duration.normal` + `ease.standard`

**금지**: 임의의 ms 값 (예: `120ms`, `180ms`) 사용 금지. 토큰 4단계 외 사용 금지.

---

## 7. Shapes

**radius 스타일**: moderate — 금융·렌트사 심사와 연결된 전문성을 유지하면서도 일반 사용자가 차량 탐색 UI를 딱딱하게 느끼지 않도록 균형 있는 곡률을 적용합니다.

| 토큰 | 값 | 주요 사용처 |
|------|----|------------|
| rounded.sm | 4px | 태그, 뱃지 |
| rounded.md | 6px | 버튼, 인풋 |
| rounded.lg | 8px | 카드 |
| rounded.xl | 12px | 모달, 시트 |
| rounded.full | 9999px | 아바타, 칩 |

---

## 8. Icons

**아이콘 소스**: Flaticon Free Interface Icons  
**선택 스타일**: regular_rounded  
**경로**: `assets/icons/regular_rounded/`  
**선택 근거**: default weight + moderate radius → regular_rounded: 전문성을 해치지 않으면서 일반 사용자도 부담 없이 탐색할 수 있는 균형형

**컬러 적용**: 모든 아이콘 SVG는 `currentColor`를 사용합니다. CSS `color` 속성으로 제어하세요.

```html
<!-- 시스템 컬러로 아이콘 사용 예시 -->
<img src="assets/icons/regular_rounded/fi-rr-bell.svg"
     class="w-5 h-5" style="color: var(--primary)" />

<!-- 인라인 SVG 방식 (Tailwind text-* 클래스로 색상 제어) -->
<svg class="w-5 h-5 text-muted-foreground"> ... </svg>
```

---

## 9. Components

YAML 토큰에 정의된 컴포넌트별 사용 지침입니다.

**button-primary**
- 배경: `{colors.semantic.primary}` — WCAG AA 보장된 브랜드 컬러
- 텍스트: `{colors.semantic.primary-foreground}` (#ffffff)
- hover: `{colors.primary.700}` 로 한 단계 진하게
- 사용: 페이지당 1개의 주요 CTA에만 사용. 복수 사용 금지.

**button-secondary**
- 배경: `{colors.gray.100}`, 텍스트: `{colors.gray.900}`
- 사용: 취소, 보조 액션, primary 옆에 쌍으로 배치할 때

**input**
- 포커스 ring: `{colors.semantic.ring}` (`box-shadow: 0 0 0 2px {ring}`)
- 에러 상태: border를 `{colors.semantic.destructive}`로 교체

**card**
- shadow 없이 border로만 구분 (border-over-shadow 규칙)
- 인터랙티브 카드의 hover: `border-color: {colors.semantic.ring}`

**alert** (4 variant: success / warning / error / info)
- base: token에 정의된 padding/border-radius/border-width
- variant 색상은 base 토큰 미정의 — CSS class에서 `colors.semantic.{success/warning/destructive/info}` + 대응하는 `*-foreground`를 직접 참조
- 사용: form validation, toast 알림, 페이지 안내 banner

---

## 10. Do's and Don'ts

### Do

아래 3~5개 규칙을 반드시 모두 작성한다. PRD의 서비스 특성에서 직접 도출한 구체적 행동 규칙이어야 한다.

- **do-status-first**: 차량 거래·렌트 심사 과정에서는 현재 상태와 다음 행동을 항상 먼저 보여준다.
  - ✅ 차량 상세 상단에 `심사 진행 중`, `서류 보완 필요`, `승인 완료` 같은 상태 뱃지와 다음 CTA를 함께 배치

- **do-list-map-sync**: 차량 목록과 지도 탐색은 사용자가 같은 대상을 보고 있다는 확신을 주도록 선택 상태를 동기화한다.
  - ✅ 목록에서 차량을 선택하면 지도 마커와 상세 패널에도 동일한 차량명이 강조됨

- **do-document-clarity**: 서류·심사 화면은 제출 여부, 검토 결과, 보완 사유를 표 형태로 명확히 구분한다.
  - ✅ `제출 완료 / 검토 중 / 반려` 상태와 반려 사유를 같은 행에서 확인 가능하게 구성

- **do-desktop-density**: 데스크탑 중심 화면에서는 목록, 필터, 지도, 상태 패널을 한 화면에서 비교 가능하도록 정보 밀도를 유지한다.
  - ✅ 12컬럼 그리드에서 좌측 필터, 중앙 차량 목록, 우측 지도 또는 심사 요약을 배치

### Don't

`<dont_rules>`의 모든 rule을 빠짐없이 아래 형식으로 나열한다. rule 수만큼 항목이 있어야 한다.

- **no-background-gradient**: 그라데이션은 hero 섹션 배경에만 허용한다. 카드·컴포넌트·사이드바 배경에 그라데이션 금지.
  - ❌ bg-gradient-to-r from-primary-500 to-secondary-500 (카드 배경)
  - ✅ bg-primary-500 (카드), 그라데이션은 <HeroSection> 한 곳만

- **single-accent-per-view**: 한 화면(viewport)에 accent 컬러(primary)가 강하게 나타나는 요소는 1개만 허용한다.
  - ❌ 상단 배너 primary + 사이드 CTA 버튼 primary 동시
  - ✅ 페이지당 primary CTA 버튼 1개, 나머지는 secondary/ghost

- **no-hardcoded-hex**: 임의의 hex 값을 토큰 없이 className이나 style에 직접 사용하지 않는다.
  - ❌ style={{ color: '#2563EB' }}
  - ✅ className='text-primary-500' 또는 CSS 변수 var(--primary)

- **no-opacity-for-text-color**: 텍스트 색상을 opacity로 표현하지 않는다. muted-foreground 토큰을 사용한다.
  - ❌ className='text-foreground opacity-50'
  - ✅ className='text-muted-foreground'

- **no-sub-caption-font-size**: caption(12px) 미만의 폰트 크기를 사용하지 않는다.
  - ❌ text-[10px], text-[11px]
  - ✅ 최소 text-caption (0.75rem / 12px)

- **no-arbitrary-font-weight**: typography.weight 토큰 외의 font-weight를 사용하지 않는다.
  - ❌ font-[350], font-[450]
  - ✅ font-regular / font-medium / font-semibold / font-bold

- **no-emoji-as-icon**: 이모지를 장식 아이콘이나 UI 아이콘으로 사용하지 않는다.
  - ❌ <span>✅ 완료</span>, <span>🚀 시작</span>
  - ✅ Lucide 컴포넌트 아이콘 또는 design.md icons 섹션의 Flaticon 아이콘

- **single-icon-style**: 한 프로젝트 내에서 design.md의 icons.style 하나만 사용한다. 스타일 혼용 금지.
  - ❌ 헤더에 line 아이콘, 카드에 filled 아이콘 혼용
  - ✅ design.md icons.style 에 지정된 스타일만 사용

- **no-card-hover-scale**: 카드·리스트 아이템에 hover 시 scale 또는 translate 변환을 적용하지 않는다.
  - ❌ hover:scale-105, hover:-translate-y-1 (카드 컴포넌트)
  - ✅ hover:shadow-md 또는 hover:border-primary-300 (정적 강조)

- **no-scroll-animate-all**: 스크롤 진입 시 모든 요소에 일괄 애니메이션을 적용하지 않는다.
  - ❌ 페이지 내 모든 <section>에 fadeInUp 적용
  - ✅ hero, 주요 CTA 섹션 등 2~3곳에만 제한적 적용

- **no-touch-target-below-44**: 버튼·링크·아이콘 버튼의 터치 타겟 크기는 최소 44×44px 이상이어야 한다.
  - ❌ <button className='w-6 h-6'> (아이콘 버튼)
  - ✅ <button className='w-11 h-11 flex items-center justify-center'>

- **no-arbitrary-z-index**: z-[숫자] 형태로 z-index를 직접 입력하지 않는다. Tailwind z-* 클래스 또는 CSS 변수를 사용한다.
  - ❌ z-[9999], z-[100]
  - ✅ z-dropdown / z-modal / z-tooltip (CSS 변수 정의 후 사용)

- **border-over-shadow**: 정보 구분이 목적일 때 shadow보다 1px border를 우선 사용한다.
  - ❌ shadow-md (카드 목록 구분 목적)
  - ✅ border border-border (구분), shadow-md는 인터랙티브 요소·드롭다운에만

- **no-oversized-shadow**: shadow-xl 이상은 모달·다이얼로그·오버레이에만 허용한다.
  - ❌ shadow-2xl (일반 카드)
  - ✅ shadow-2xl은 <Dialog>, <Sheet>, <Modal> 컴포넌트에만

- **no-ambiguous-review-status**: 서류·심사 상태를 색상만으로 구분하거나 모호한 문구로 표시하지 않는다.
  - ❌ 파란 점만 표시하거나 `확인 필요`만 단독 노출
  - ✅ `서류 보완 필요 · 보험증권 누락`처럼 상태명과 사유를 함께 표시

- **no-map-over-decoration**: 지도 탐색 화면에서 장식 요소가 차량 위치, 필터, 선택 마커보다 더 눈에 띄게 만들지 않는다.
  - ❌ 지도 위에 큰 배너, 과한 그림자 카드, 여러 primary 버튼을 겹쳐 배치
  - ✅ 선택 차량 마커와 필터 패널만 강조하고 나머지 정보는 neutral surface로 정리

- **no-mobile-first-assumption**: 데스크탑 중심 서비스임에도 모바일 우선 레이아웃만 설계하지 않는다.
  - ❌ 1024px 이상 화면에서 카드가 1열로 길게 나열되고 지도와 목록 비교가 불가능함
  - ✅ lg 이상에서 목록·지도·심사 요약을 12컬럼 그리드로 병렬 배치