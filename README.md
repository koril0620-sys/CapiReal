# CapiReal (캐피로그)

경제 교육용 로그라이크 경영 시뮬레이션. 120개월(층) 동안 회사를 운영하며 독점 기업 MONOPOL의 조직원들을 시장에서 몰아내고, 최종 보스 혜경을 꺾는 게임입니다.

## 주요 특징
- **여러 시장 동시 운영**: 식품 → 생활용품 → 전자부품 → 가전 → IT → 첨단장비 순으로 새 시장이 열리고, 기존 시장은 유지하거나 철수할 수 있습니다 (최대 6개).
- **시장마다 여러 라이벌**: MONOPOL 조직원 10명 + 지원팀이 시장별로 경쟁하며, 각자 고유 특수 능력을 가집니다.
- **소비자 군별 점유율**: 품질·브랜드·가격·일반 소비자 비율에 따라 가격/품질/마케팅 전략의 효과가 달라집니다.
- **경기 순환(마르코프 연쇄)**, 신용등급과 대출, 공장 투자, 이벤트, 어드바이저 4종, 업적·경제용어 사전.

## 실행
```bash
npm install
cp .env.example .env.local   # Supabase·OpenAI 값 입력
npm run dev
```

- `npm run build` / `npm run lint`
- DB 스키마: `supabase/schema.sql`
- 이번 업데이트 내역: `docs/멀티시장_업데이트.md`

## 기술 스택
React 19 · Vite · Zustand · Supabase · OpenAI(gpt-4o-mini, AI 어드바이저)

> ⚠️ 배포 전: `VITE_OPENAI_API_KEY`는 브라우저 번들에 포함됩니다. 공개 배포 시 서버(Edge Function)로 옮기세요. Supabase RLS 정책도 `schema.sql` 주석을 참고해 강화가 필요합니다.
