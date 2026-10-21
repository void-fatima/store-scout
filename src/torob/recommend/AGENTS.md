# StoreScout Recommendation Agent

- Setayesh owns the Recommendation Agent module.
- Repository root: `C:\git\shared\store-scout`. All future StoreScout code belongs
  inside this cloned repository.
- Use the canonical `src/torob/recommend/` package. The old
  `apps/torob/recommend/` files are an untracked historical snapshot.
- Catalog offers come from `torob.catalog.contracts.OfferCandidate`; do not
  introduce a duplicate active offer model or change shared contracts without approval.
- Keep package initialization limited to contract/model imports.
- Preserve explicit inventory uncertainty, dataset provenance and coverage notices.
  A recorded offer is not proof of inventory; a shop category is not a product offer.
- Do not modify teammates' catalog, data, journey, frontend, shell or deployment files.
- Keep changes within this module and its explicitly owned tests.
- Git commits and pushes require explicit user authorization. Never stage unrelated
  untracked work, force-push, discard changes, or merge without authorization.
- Ranking, alternatives, follow-up and UI integration are separate tasks.
- Run tests from the repository root with
  `uv run pytest tests/test_recommend_contracts.py`; use the existing project environment.
