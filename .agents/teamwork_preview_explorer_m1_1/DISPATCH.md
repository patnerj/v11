## 2026-08-13T20:34:30Z

Milestone M1: Core API Client & Global Standards — Explorer 1

Required reading:
- Original Request: d:\Full Propfirm System for antigravity\.agents\ORIGINAL_REQUEST.md
- Scope Document: d:\Full Propfirm System for antigravity\.agents\teamwork_preview_orchestrator_3\PROJECT.md
- Survey Handoffs:
  - d:\Full Propfirm System for antigravity\.agents\teamwork_preview_explorer_survey_1\handoff.md
  - d:\Full Propfirm System for antigravity\.agents\teamwork_preview_spec_miner_survey_2\handoff.md
  - d:\Full Propfirm System for antigravity\.agents\teamwork_preview_explorer_survey_3\handoff.md

Objectives:
1. Examine `src/lib/api.ts` in `d:\Full Propfirm System for antigravity\propfirm-frontend-v10.7.1` (or `D:\Spark Propfirm\propfirm-frontend-v10.7.1`).
2. Propose concrete changes to standardize API base URL handling:
   - Primary: `process.env.NEXT_PUBLIC_API_URL`
   - Fallbacks: `process.env.NEXT_PUBLIC_FXSIM_API` -> `'/api/wp'`
   - Ensure header initialization supports authorization, JSON content types, and CORS without breaking cookie auth.
3. Detail how `api.ts` should catch 4xx, 5xx, CORS, and network errors cleanly without throwing unhandled exceptions to prevent UI crashes.
4. Record implementation recommendations in `handoff.md` in `d:\Full Propfirm System for antigravity\.agents\teamwork_preview_explorer_m1_1`.
