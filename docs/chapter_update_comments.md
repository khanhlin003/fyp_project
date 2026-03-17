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

### What is good
- Overall stack direction is accurate (Next.js + FastAPI + Supabase).
- Implementation sections are well-structured and understandable.

### Critical mismatches to fix
- Frontend stack versions appear outdated relative to code:
  - Tailwind appears v4 usage pattern in frontend config/readme.
  - Recharts and other versions should reflect package files, not assumed ranges.
- Backend Python version note should align with environment docs (project mentions Python 3.11+).
- External service line says GPT-4o specifically; confirm with deployed config or keep model reference generalized.
- Risk profiling section states 15 questions and 4 profiles, but current app quiz flow is around 8 questions and outputs conservative, balanced, aggressive.
- Recommendation engine narrative describes weighted formula with exact component percentages that do not match current route logic (current scoring is rule-based with category/beta/dividend/return/fee bonuses and penalties).
- Frontend structure snippet includes components/files that may not exist now and omits current modules (wallets, scenarios, app shell patterns).
- Testing summary in this chapter duplicates Chapter 5 purpose and includes hard counts that should be verified.

### Suggested edit actions
1. Re-sync all version tables to actual package/dependency files.
2. Rewrite risk profiling and recommendation sections to match implemented logic exactly.
3. Update frontend structure and route map to current pages.
4. Move final testing numbers to Chapter 5 and keep Chapter 4 implementation-focused.

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
