# 오류 가능 지점 점검 및 수정 계획

## 현재 확인한 상태

- `npm run build`: 성공
  - 경고: `/assets/images/backgrounds/bg_title.png`가 빌드 시점에 해석되지 않아 런타임 404 가능성이 있음
  - 경고: JS 청크가 500 kB를 초과함
- `npm run lint`: 성공
- 런타임 위험은 컴파일 오류보다 환경값, 리소스 경로, 화면 흐름, 저장/게임 상태 동기화 쪽에 몰려 있음

## P0. 앱 시작 또는 핵심 화면을 막을 수 있는 항목

### 1. Supabase 환경값이 잘못되면 앱이 import 단계에서 터질 수 있음

- 관련 파일
  - `.env.local:1`
  - `.env.local:2`
  - `.env.example:1`
  - `.env.example:2`
  - `src/lib/supabaseClient.js:3`
  - `src/lib/supabaseClient.js:6`
- 위험
  - 현재 `.env.local`의 URL/키가 실제 HTTP(S) Supabase 값이 아닌 placeholder 형태임
  - `createClient()`가 모듈 로드 시 바로 실행되므로 잘못된 URL이면 로그인 화면 이전에 런타임 오류가 날 수 있음
- 확인 근거
  - `createClient('기존_supabase_url', ...)` 형태는 `Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.` 오류를 냄
- 수정 계획
  - 실제 Supabase URL과 anon key를 `.env.local`에 넣기
  - `src/lib/supabaseClient.js`에 URL/키 유효성 검사를 추가해, 미설정 시 앱 전체 crash 대신 명확한 오류 상태 또는 게스트 모드로 분기
  - `.env.example`에는 값 형식 예시를 주석으로 보강
- 검증
  - 잘못된 env일 때도 앱이 최소한 로그인/게스트 안내 화면까지 렌더링되는지 확인
  - 올바른 env일 때 회원가입, 로그인, 자동 로그인, 저장 슬롯 조회 확인

### 2. public 리소스 경로가 실제 파일 구조와 맞지 않음

- 관련 파일
  - `index.html:8`
  - `src/logic/audioEngine.js:2`
  - `src/logic/audioEngine.js:22`
  - `src/styles/title.css:14`
  - `src/constants/advisors.js:15`
  - `src/constants/rivals.js:10`
  - `src/constants/achievements.js:8`
  - `src/screens/MainScreen.jsx:336`
  - `src/constants/events/external.js:12`
- 위험
  - 코드에서는 `/assets/images/...`, `/assets/audio/...` 하위 폴더를 기대하지만, 현재 `public/assets`에는 해시가 붙은 파일들이 평면 구조로 존재함
  - 배경, 아바타, 라이벌, 어드바이저, 업적 아이콘, 이벤트 이미지, BGM/SFX가 대량 404가 날 수 있음
  - `npm run build`에서도 `bg_title.png` 미해결 경고가 이미 발생함
- 수정 계획
  - 선택지 A: `public/assets/images/...`, `public/assets/audio/...` 폴더 구조를 코드가 기대하는 이름으로 복원
  - 선택지 B: `src/constants/assets.js` 같은 asset manifest를 만들고 현재 파일명에 맞춰 모든 참조를 한 곳에서 관리
  - 배포 안정성은 A가 더 단순함. 해시 파일명을 직접 참조하는 방식은 파일 교체 때마다 코드 수정이 필요함
- 검증
  - 브라우저 Network 탭에서 `/assets/...` 404가 없는지 확인
  - 타이틀 배경, 메인 배경, 캐릭터/라이벌/어드바이저 이미지, 업적 토스트 아이콘, BGM/SFX 재생 확인

### 3. 새 게임, 어드바이저, 캐릭터, 슬롯 흐름이 서로 어긋남

- 관련 파일
  - `src/screens/TitleScreen.jsx:29`
  - `src/screens/TitleScreen.jsx:35`
  - `src/screens/CharacterCreateScreen.jsx:16`
  - `src/screens/CharacterCreateScreen.jsx:17`
  - `src/screens/CharacterCreateScreen.jsx:43`
  - `src/screens/SlotSelectScreen.jsx:44`
  - `src/screens/SlotSelectScreen.jsx:46`
  - `src/logic/saveEngine.js:6`
- 위험
  - 타이틀의 새 게임은 `characterCreate`로 이동하지만, 캐릭터 생성은 이미 `selectedAdvisor`, `currentSlot`이 있다고 가정함
  - `selectedAdvisor`가 null인 상태로 `resetGame()`이 호출될 수 있음
  - `currentSlot`이 null이면 `saveOnFloorEnter()`가 항상 false를 반환해 저장이 되지 않음
  - 어드바이저 선택 뒤 빈 슬롯을 고르면 캐릭터 생성 없이 바로 `main`으로 이동함
- 수정 계획
  - 새 게임 표준 플로우를 하나로 고정
    - 권장: `title -> advisorSelect -> slotSelect -> characterCreate -> main`
  - `resetGame(advisorId, profile, slotNumber)`는 세 값이 모두 있을 때만 호출
  - 각 화면 진입 시 필수 상태가 없으면 이전 단계로 돌려보내는 guard 추가
- 검증
  - 게스트 새 게임
  - 로그인 새 게임
  - 빈 슬롯 새 게임
  - 기존 슬롯 덮어쓰기
  - 각 케이스에서 `selectedAdvisor`, `playerProfile`, `currentSlot`이 정상인지 확인

### 4. 기존 저장 슬롯을 이어서 할 수 없음

- 관련 파일
  - `src/logic/saveEngine.js:47`
  - `src/screens/SlotSelectScreen.jsx:3`
  - `src/screens/SlotSelectScreen.jsx:32`
  - `src/screens/SlotSelectScreen.jsx:37`
  - `src/screens/SlotSelectScreen.jsx:97`
- 위험
  - `loadSaveSlot()` 함수는 있지만 `SlotSelectScreen`에서 사용하지 않음
  - 저장된 슬롯을 클릭하면 이어하기가 아니라 덮어쓰기 확인만 뜸
  - 타이틀의 "계속하기"가 사실상 저장 불러오기로 이어지지 않음
- 수정 계획
  - 저장된 슬롯 클릭 시 "이어하기"와 "덮어쓰기"를 분리
  - 이어하기는 `loadSaveSlot(userId, slotNumber)`로 JSON을 불러와 `useGameStore.setState()`에 병합
  - 불러온 저장 데이터는 action 함수와 섞이지 않도록 순수 상태만 저장/복원하는 serializer를 둠
- 검증
  - 저장 슬롯 생성 후 새로고침
  - 같은 계정으로 로그인
  - 슬롯 선택 시 이전 floor, 자본, 캐릭터, 어드바이저가 복원되는지 확인

## P1. 게임 진행 중 기능이 깨지거나 반복 오류를 만들 수 있는 항목

### 5. MONOPOL 스테이지 데이터가 비어 있어 라이벌 시스템이 사실상 꺼져 있음

- 관련 파일
  - `src/constants/monopol.js:1`
  - `src/constants/monopol.js:3`
  - `src/screens/MainScreen.jsx:34`
  - `src/screens/MainScreen.jsx:123`
  - `src/components/RivalCapitalBar.jsx`
- 위험
  - `MONOPOL_STAGES = []`라서 `getCurrentStage()`가 항상 null을 반환함
  - 라이벌 등장 팝업, 라이벌 자본 바, 스테이지 전환, 시장 개입, 특수 능력, 라이벌 도감 진행이 동작하지 않음
  - 보스전만 `floor === 120` 조건으로 따로 동작해 중간 progression이 비어 보일 수 있음
- 수정 계획
  - `src/constants/rivals.js`의 라이벌 목록과 연결되는 stage 데이터를 `MONOPOL_STAGES`에 채우기
  - floor 구간, rival id, 회사명, 자본 배율, 개입 규칙, 특수 능력, 등장 메시지를 한 구조로 정리
  - stage 진입 시 `metRivals` 업데이트도 함께 처리
- 검증
  - 1층부터 구간 이동 시 라이벌 등장 여부 확인
  - 라이벌 자본 감소, 파산 판정, 도감 등록 확인

### 6. 업적이 로컬 상태에 병합되지 않아 반복 해금될 수 있음

- 관련 파일
  - `src/logic/achievementEngine.js:5`
  - `src/logic/achievementEngine.js:9`
  - `src/logic/settlementEngine.js:182`
  - `src/screens/MainScreen.jsx:100`
  - `src/screens/EventScreen.jsx:118`
  - `src/store/useGameStore.js:130`
- 위험
  - 새로 해금된 업적을 `newAchievements`에는 넣지만 `unlockedAchievements`에는 병합하지 않음
  - 같은 조건을 만족하는 업적이 매 턴 다시 해금되어 토스트가 반복될 수 있음
  - `addAchievement()` 액션이 정의되어 있지만 실제 흐름에서 사용되지 않음
- 수정 계획
  - `settle()` 결과 반영 시 `updatedState.unlockedAchievements`에 `newlyUnlocked`를 dedupe 병합
  - Supabase 저장 성공 여부와 무관하게 로컬 상태는 즉시 반영
  - `AchievementToast`는 표시 큐만 담당하고 해금 상태 관리는 엔진/스토어에서 담당하도록 역할 분리
- 검증
  - 첫 수익 업적이 한 번만 뜨는지 확인
  - 새로고침/저장 불러오기 후 이미 해금된 업적이 반복되지 않는지 확인

### 7. 업적 조건에 필요한 통계 대부분이 갱신되지 않음

- 관련 파일
  - `src/store/useGameStore.js:82`
  - `src/store/useGameStore.js:85`
  - `src/logic/settlementEngine.js:188`
  - `src/logic/achievementEngine.js:36`
  - `src/logic/achievementEngine.js:72`
- 위험
  - `updateStats()`는 playtime, profit/loss, maxShare 등 일부만 갱신함
  - 업적 조건은 `marketingCount`, `interestPaidCount`, `loanRepaidCount`, `phasesExperienced`, `eventTotalCount`, `dictionaryViewCount` 등 많은 값을 참조하지만 실제 증가 지점이 없음
  - 일부 업적은 정상 플레이로 달성 불가능할 수 있음
- 수정 계획
  - 업적 조건별로 필요한 stats 필드를 표로 정리
  - 이벤트 선택, 마케팅 투자, 대출 상환, 이자 납부, 경기 국면 변화, 결과 화면 조회, 도감/사전 조회 등 실제 행동 지점에서 카운터 갱신
  - 사용하지 않을 업적 조건은 제거하거나 조건명을 현재 stats에 맞춤
- 검증
  - 대표 업적 5개 이상을 수동 시나리오로 달성 확인
  - 업적 화면의 카테고리 카운트가 실제 해금 수와 일치하는지 확인

### 8. 대출 만기 로직이 화면과 엔진에 연결되지 않음

- 관련 파일
  - `src/logic/settlementEngine.js:100`
  - `src/logic/loanEngine.js:54`
  - `src/logic/loanEngine.js:61`
  - `src/components/LoanMaturityAlert.jsx:7`
  - `src/components/RightPanel.jsx:474`
- 위험
  - 매 턴 `remainingTurns`는 감소하지만 만기 도래 시 강제 상환, 연장, 신용점수 패널티가 자동 처리되지 않음
  - `LoanMaturityAlert` 컴포넌트와 `getMaturedLoans()`가 실제 화면 흐름에 연결되어 있지 않음
  - 만기 턴이 음수로 내려가도 원금이 남아 있는 상태가 지속될 수 있음
- 수정 계획
  - 정산 후 `getMaturedLoans()`를 확인해 만기 알림 상태를 store에 저장
  - 메인 또는 결과 화면에서 `LoanMaturityAlert`를 렌더링
  - 플레이어가 무시할 경우 신용점수 하락, 연체 이자, 자동 연장 불가 조건 등을 명확히 적용
- 검증
  - 단기 대출 후 10턴 진행
  - 만기 알림 노출, 상환, 연장, 미루기 각각의 결과 확인

### 9. 일시정지 메뉴에서 없는 화면으로 이동하거나 오버레이가 남을 수 있음

- 관련 파일
  - `src/components/menus/PauseMenu.jsx:31`
  - `src/components/menus/PauseMenu.jsx:46`
  - `src/components/menus/PauseMenu.jsx:66`
  - `src/App.jsx`
- 위험
  - `dictionary` 화면은 `App.jsx`의 screens 목록에 없음
  - 메뉴 항목 클릭 시 `setCurrentScreen()`만 호출하고 `isPaused`를 false로 바꾸지 않아, 이동한 화면 위에 PauseMenu가 계속 남을 수 있음
  - 등록되지 않은 화면은 fallback으로 로그인 화면이 렌더링될 수 있음
- 수정 계획
  - `dictionary` 화면을 실제로 만들거나 메뉴에서 제거
  - 메뉴 항목 이동 시 공통 핸들러에서 `setIsPaused(false)` 처리
  - `App.jsx`에 알 수 없는 screen에 대한 fallback을 로그인 대신 안전한 not-found 또는 title로 변경 검토
- 검증
  - 일시정지에서 설정, 기록, 업적, 어드바이저 정보, 라이벌 도감 이동 확인
  - 각 화면에서 뒤로가기 후 정상적으로 main/title로 돌아오는지 확인

### 10. 튜토리얼 설정값과 실제 체크값이 다름

- 관련 파일
  - `src/store/useGameStore.js:103`
  - `src/components/menus/GameSettings.jsx:65`
  - `src/screens/MainScreen.jsx:60`
- 위험
  - 설정 화면은 `settings.tutorial`을 바꾸지만 메인 화면은 `gameState.isTutorialEnabled`를 봄
  - 사용자가 튜토리얼을 꺼도 학습 팝업이 계속 뜰 수 있음
- 수정 계획
  - `isTutorialEnabled`를 제거하고 `settings.tutorial`만 사용하거나, 설정 변경 시 두 값을 동시에 동기화
  - 저장된 설정 로드 시 store의 튜토리얼 상태도 반영
- 검증
  - 설정에서 튜토리얼 OFF 후 새 층 진입 시 팝업 미노출 확인

## P2. 안정성, 유지보수, 배포 품질 항목

### 11. 저장 데이터에 Zustand action 함수까지 섞일 수 있음

- 관련 파일
  - `src/logic/saveEngine.js:9`
  - `src/store/useGameStore.js`
- 위험
  - `game_state_json: gameState`에 store 전체를 넘기면 action 함수와 UI transient 상태가 섞임
  - JSON 직렬화 과정에서 함수는 빠지더라도, 복원 시 어떤 필드가 저장 대상인지 불명확함
- 수정 계획
  - `serializeGameState()`로 저장할 순수 상태 필드 whitelist 작성
  - `hydrateGameState()`로 불러온 JSON을 현재 store action과 안전하게 병합
  - `currentScreen`, `isPaused`, 팝업 상태 등은 저장 대상에서 제외 검토
- 검증
  - 저장된 `game_state_json`에 함수/불필요한 UI 상태가 없는지 Supabase에서 확인
  - 저장 불러오기 후 버튼 액션이 정상 동작하는지 확인

### 12. 게스트 모드 저장 정책이 불명확함

- 관련 파일
  - `src/screens/LoginScreen.jsx:66`
  - `src/logic/saveEngine.js:6`
- 위험
  - 게스트는 `playerId`가 없어 Supabase 저장이 항상 skip됨
  - UI에서 저장 불가 상태가 명확히 안내되지 않으면 데이터가 사라진 것으로 보일 수 있음
- 수정 계획
  - 게스트는 localStorage 저장을 지원하거나, 명시적으로 "게스트 진행은 저장되지 않음"을 안내
  - 게스트 저장을 지원한다면 Supabase save와 local save 인터페이스를 분리
- 검증
  - 게스트 새 게임 후 새로고침 시 정책대로 동작하는지 확인

### 13. 보스전 상태와 메인 정산 흐름이 분리되어 있음

- 관련 파일
  - `src/screens/BossScreen.jsx:18`
  - `src/screens/BossScreen.jsx:22`
  - `src/screens/BossScreen.jsx:31`
  - `src/logic/settlementEngine.js:168`
- 위험
  - `BossScreen`의 `bossState`, counter warning, `handleBossResult()`는 화면을 `main`으로 넘긴 뒤 대부분 사용되지 않음
  - 실제 보스 클리어 판정은 `settlementEngine`의 boss stage 정산에서 별도로 처리됨
- 수정 계획
  - 보스전 상태를 store/engine으로 올리고, BossScreen은 소개/상태 표시만 담당하게 정리
  - 보스 counter 전략을 실제 시장 계산에 반영할지 결정
  - 사용하지 않을 로컬 보스 결과 코드는 제거
- 검증
  - 120층 진입, 보스 시작, 3턴 연속 조건 달성, 클리어/게임오버 분기 확인

### 14. 번들 크기 경고

- 관련 파일
  - `vite.config.js`
  - `src/App.jsx`
- 위험
  - 현재 빌드는 성공하지만 JS 청크가 500 kB를 넘음
  - 당장 오류는 아니지만 초기 로딩이 느려질 수 있음
- 수정 계획
  - 화면 단위 `React.lazy()`/dynamic import 적용 검토
  - 이미지/오디오를 코드 번들에 포함하지 않고 public 정적 리소스로 유지
- 검증
  - `npm run build`에서 chunk 경고 감소 확인

## 권장 작업 순서

1. Supabase env guard와 실제 `.env.local` 값 정리
2. public asset 경로 복원 또는 asset manifest 도입
3. 새 게임/이어하기/덮어쓰기 플로우 재설계
4. 저장 serializer/hydrator 추가
5. MONOPOL stage 데이터 연결
6. 업적 로컬 병합 및 stats 갱신 지점 추가
7. 대출 만기 알림과 처리 연결
8. PauseMenu 라우팅 및 overlay 정리
9. 튜토리얼 설정 동기화
10. 보스전 상태 흐름 정리
11. 전체 수동 플레이 smoke test

## 최종 검증 체크리스트

- `npm run lint`
- `npm run build`
- 잘못된 Supabase env에서도 앱이 안내 상태로 렌더링됨
- 올바른 Supabase env에서 회원가입/로그인/자동 로그인 성공
- 게스트/로그인 새 게임 모두 정상 시작
- 기존 저장 슬롯 이어하기 성공
- 덮어쓰기 후 이전 저장 데이터가 새 게임 데이터로 교체됨
- 타이틀, 메인, 이벤트, 결과, 보상, 보스, 엔딩 화면에서 이미지 404 없음
- BGM/SFX 경로 404 없음
- 5층 이상 진행하며 정산, 이벤트, 보상, 저장, 업적 토스트 확인
- 대출 만기 처리 3가지 선택지 확인
- 일시정지 메뉴의 모든 항목이 정상 이동하고 overlay가 남지 않음
