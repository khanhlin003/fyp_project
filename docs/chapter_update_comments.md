# Chapter Cross-Check Comments and Required Updates

This review cross-checks documentation against the current codebase implementation in backend and frontend.

## Chapter 1 (Introduction)

### What is good
- Background, motivation, and objectives are aligned with the current product direction.
- Scope includes key modules now in production (recommendations, chatbot, scenario analysis, sentiment/news).

### What to update
- Report organization is inconsistent with current chapter files:
  - Chapter 1 currently says Chapter 6 is conclusions/future work.
  - Current docs set appears to end at Chapter 5 plus appendix.
- Update wording for recommendation model:
  - Current implementation is mainly rule-based multi-factor scoring, not predictive ML.
- Optional precision update:
  - Mention wallet-centric portfolio organization as part of scope.

### Suggested edit actions
1. Fix chapter numbering and organization section to match actual report structure.
2. Add one sentence that the platform includes wallet-level planning and profiling.
3. Keep claims educational and avoid implying autonomous investment advice.

## Chapter 2 (Literature Review)

### What is good
- Core finance concepts (risk metrics, MPT, VaR, sentiment) are relevant.
- Rationale for explainable recommendation systems is strong and aligned.

### What to update
- LLM section references GPT-4 in general terms; implementation currently uses GPT model via API and should be kept version-agnostic in thesis text unless frozen by evidence.
- VaR discussion includes Monte Carlo as common method; current implemented product emphasizes historical and parametric style outputs.
- Recommendation approaches section should explicitly tie to your implemented rule-based profile constraints and scoring logic.

### Suggested edit actions
1. Add implementation tie-back subsection at end of chapter:
   - why risk-profile gating + explainable scoring was chosen.
2. Clarify which VaR approaches are implemented now vs future extensions.
3. Keep LLM statements grounded as educational assistant behavior, not advisory automation.

## Chapter 3 (System Requirements and Design)

### What is good
- Three-tier architecture framing is correct.
- Functional requirement categories are broadly aligned.

### Critical mismatches to fix
- API table says recommendations endpoint requires auth, but current implementation allows recommendation retrieval by profile without auth.
- Risk profile naming mismatch:
  - Current app consistently uses conservative, balanced, aggressive.
  - Avoid mixed labels such as moderate/growth in system design sections.
- Database section does not include wallet tables now implemented:
  - wallets
  - wallet_profiles
  - wallet_holdings
- UI section says six screens, but current frontend has more key screens:
  - wallets
  - scenarios
  - profile settings

### Non-functional requirement caution
- Hard performance numbers (for example under 500ms) should be supported by actual benchmark/test evidence in Chapter 5.

### Suggested edit actions
1. Update API design table auth requirements and endpoint list.
2. Expand ERD description with wallet entities and relationships.
3. Update UI section to include wallet and scenarios pages.
4. Harmonize risk profile terms across all chapters.

## Chapter 4 (System Implementation)

### Walkthrough Evaluation (Section-by-Section)

### 4.1 Technology Stack Overview
- Status: Mostly aligned.
- Verified alignment:
  - Frontend stack versions are consistent with package files (Next.js 14.2.5, TypeScript 5.x, Tailwind 4.x, Recharts 3.x, TanStack Query 5.x, Axios 1.x).
  - Backend runtime is aligned with Python 3.11+ (runtime shows Python 3.11.7).
  - FastAPI/SQLAlchemy/Pydantic/JWT/bcrypt claims are consistent with backend dependencies.
- Gaps to fix:
  - Pandas is documented as 2.x, but dependency currently allows 1.5+.
  - APScheduler is listed in stack, but implementation evidence should cite where jobs are initialized (not just that the package exists).

### 4.2 Data Pipeline Implementation
- Status: Partially aligned.
- Strengths:
  - Multi-source ingestion narrative is coherent and matches project structure.
  - Incremental update idea and validation stages are appropriate for financial data.
- Gaps to fix:
  - Rate-limit numbers are not explicit enough in this section; state the enforced policy directly (per-minute and per-day) and keep it consistent with implementation.
  - This section currently does not explain operational refresh ownership clearly (what is scheduler-driven vs script-driven), especially for daily news refresh and incremental OHLCV updates.

### 4.3 Backend Implementation
- Status: Mostly aligned with important wording fixes needed.
- Strengths:
  - Modular route/service architecture description is accurate.
  - Risk profile taxonomy in chapter is now correct (conservative, balanced, aggressive).
  - Recommendation section now correctly describes rule-based multi-factor scoring.
- Gaps to fix:
  - Quiz route comments and payload examples in code still mention 15 questions, while configured quiz now has 8; chapter text should acknowledge current 8-question configuration.
  - Scenario/VaR section currently emphasizes historical VaR only; implementation also exposes parametric VaR path, so chapter wording should mention both.
  - Chatbot section currently overstates retrieval grounding. Implemented route sends prompt context but does not describe a full retrieval pipeline.
  - Minor LaTeX style issue: use \texttt{APIRouter} instead of markdown-style backticks.

### 4.4 Frontend Implementation
- Status: Aligned.
- Verified alignment:
  - Route map includes wallets, scenarios, profile, recommendations, ETF browse/detail.
  - Project structure reflects current module layout and app-router organization.
- Minor caution:
  - Keep structure snippets synchronized when files/components are renamed to avoid future drift.

### 4.5 Implementation Challenges
- Status: Conceptually good, but evidence needs tightening.
- Strengths:
  - Challenges selected are realistic (API limits, data continuity, risk metric stability).
- Gaps to fix:
  - Operational numbers (daily update volume, queue throughput, cache horizon) should be explicitly tied to implemented scheduler/service limits.

### 4.6 Deployment Configuration
- Status: Aligned at high level.
- Strengths:
  - Vercel + Render + Supabase separation is clear and correct for architecture communication.
- Gaps to fix:
  - If row-level security is claimed, add one sentence on where policy enforcement is configured or narrow the wording to avoid unverifiable claims.

### 4.7 Testing and Evaluation Placement
- Status: Correct direction.
- Note:
  - Keeping Chapter 4 implementation-focused and deferring formal testing results to Chapter 5 is the right structure.

### Suggested edit actions for Chapter 4
1. Add a short "Implementation Snapshot" table that lists exact pinned versions from frontend package.json, backend requirements, and runtime.
2. Update quiz narrative to "8-question configuration" and keep taxonomy fixed to conservative, balanced, aggressive.
3. Update scenario risk text to explicitly state historical and parametric VaR outputs.
4. Soften chatbot wording from "retrieval-style grounding" to "context-enriched prompting" unless a true retrieval pipeline is implemented.
5. Add evidence anchors for operational claims (rate limits, scheduler throughput, refresh cadence) in Chapter 5 or appendix.

## Chapter 5 (Conclusions and Future Work)

### What is good
- Conclusion narrative is coherent and aligned with project goals.
- Limitations section is mostly realistic.

### What to update
- Ensure consistency with actual delivered features:
  - Wallet module should be mentioned explicitly.
  - Scenario analysis supports portfolio, wallet, and ETF targets.
- Future work should separate near-term feasible scope from long-term aspirational scope.
- Any claim about VaR assumptions should match implemented method descriptions in Chapter 4.

### Suggested edit actions
1. Add wallet and target-scoped risk analysis to achievements summary.
2. Split future work into short-term, medium-term, long-term with realistic engineering effort.
3. Ensure model/architecture claims are consistent with implementation chapter.

## Appendix (Use Cases)

### What is good
- Use-case format is detailed and structured.
- Most primary interactions are covered.

### Critical mismatches to fix
- Password business rule in UC-01 says minimum 8 characters, but frontend validation currently allows minimum 6 characters.
- Risk questionnaire use case still uses four-profile taxonomy (Conservative, Moderate, Growth, Aggressive); current platform is conservative, balanced, aggressive.
- Several use cases mark authentication as required even where current implementation allows guest access (for ETF browsing and details).
- Missing explicit wallet use cases despite wallet module being implemented.

### Suggested new/updated use cases
1. Add UC: Create wallet.
2. Add UC: Update wallet profile.
3. Add UC: Assign holding to wallet.
4. Add UC: Run scenario analysis by target type (portfolio/wallet/ETF).
5. Update UC-01 password rule to match actual product validation or update code to match thesis rule.

## UML and Diagram Notes

The UML tracking file has been prepared and populated here:
- docs/diagram_uml.md

It now contains:
1. Diagram-by-diagram update checklist.
2. Missing sequence/component diagrams to add.
3. Consistency rules for naming and risk-profile taxonomy.

## High Priority Fix Order

1. Fix taxonomy consistency across all chapters (conservative, balanced, aggressive).
2. Update Chapter 3 API and ERD sections for wallet module and auth boundaries.
3. Update Chapter 4 implementation details to match real code behavior (quiz size, scoring logic, versions).
4. Update appendix business rules and add wallet-specific use cases.
5. Reconcile chapter numbering/organization in Chapter 1.

## Optional Next Step

If you want, I can do a second pass where I draft exact replacement paragraphs (ready-to-paste LaTeX) for each chapter section you need to update.
