# ClaudePod Dependency Updates Plan

> **Status:** COMPLETED on 2026-01-15

**Goal:** Update ClaudePod dependencies to latest versions while maintaining stability.

**Architecture:** Review each Dependabot PR, assess compatibility, make required code changes, then merge.

**Tech Stack:** Node.js 18+, Express.js, dotenv, node-pty, GitHub Actions

---

## Summary of Open PRs

| PR | Update | Type | Risk | Action |
|----|--------|------|------|--------|
| #2 | github/codeql-action v3→v4 | CI | Low | Merge after rebase |
| #3 | actions/checkout v4→v6 | CI | Low | Merge after rebase |
| #4 | node-pty 1.0.0→1.1.0 | Minor | Low | Merge after rebase |
| #5 | dotenv 16.6.1→17.2.3 | Major | Low | Code change needed |
| #6 | actions/setup-node v4→v6 | CI | Low | Merge after rebase |
| #7 | express 4.22.1→5.2.1 | Major | Medium | Code change needed |

---

## Task 1: Merge Safe GitHub Actions PRs

**Files:** None (CI only)

**Step 1: Wait for Dependabot rebases to complete**

Run: `gh pr view 2 --json statusCheckRollup --jq '.statusCheckRollup | map(.conclusion) | unique'`
Expected: All checks should be running or passed after rebase

**Step 2: Merge GitHub Actions PRs in order**

After checks pass:
```bash
gh pr merge 2 --squash --auto
gh pr merge 3 --squash --auto
gh pr merge 6 --squash --auto
```

---

## Task 2: Merge node-pty Minor Update

**Files:** None (dependency only)

**Step 1: Verify node-pty 1.1.0 compatibility**

The 1.0.0→1.1.0 is a minor version bump. Should be backward compatible.

**Step 2: Merge after checks pass**

```bash
gh pr merge 4 --squash --auto
```

---

## Task 3: Update Code for dotenv v17

**Files:**
- Modify: `server.js:1`

**Breaking Change:** In v17, `quiet` defaults to `false`, showing a log message with file and keys count.

**Step 1: Update dotenv import to suppress logging**

Change line 1 from:
```javascript
require('dotenv/config');
```

To:
```javascript
require('dotenv').config({ quiet: true });
```

**Step 2: Verify tests pass**

Run: `npm test`
Expected: All 42 tests pass

**Step 3: Commit the change**

```bash
git add server.js
git commit -m "chore: update dotenv import for v17 compatibility"
```

**Step 4: Merge PR #5**

```bash
gh pr merge 5 --squash
```

---

## Task 4: Update Code for Express v5

**Files:**
- Modify: `server.js:408`
- Test: `test/server.test.js`

**Breaking Changes in Express 5:**
1. Wildcard routes must be named: `*` → `/*splat` or similar
2. `req.body` returns `undefined` if not parsed (code already handles this)
3. Route path matching uses path-to-regexp v8

**Step 1: Update catch-all route**

Change line 408 from:
```javascript
app.get('*', (req, res) => {
```

To:
```javascript
app.get('/{*any}', (req, res) => {
```

Note: Express 5 requires named wildcards. `{*any}` captures everything.

**Step 2: Run tests to verify compatibility**

Run: `npm test`
Expected: All tests pass

**Step 3: Run the app locally and verify SPA routing works**

```bash
npm start &
curl -s http://localhost:3000/some/random/path | head -5
# Should return HTML content (index.html)
kill %1
```

**Step 4: Commit the change**

```bash
git add server.js
git commit -m "chore: update to Express 5 compatible route syntax"
```

**Step 5: Merge PR #7**

```bash
gh pr merge 7 --squash
```

---

## Task 5: Final Verification

**Step 1: Pull latest main**

```bash
git pull origin main
npm ci
```

**Step 2: Run full test suite**

```bash
npm run test:all
```

**Step 3: Verify app runs correctly**

```bash
npm start
# Test in browser or with curl
```

---

## Risk Assessment

### Express 5 (Medium Risk)
- **Route syntax change** is the main concern
- The wildcard `*` MUST become a named parameter like `{*any}`
- Tests should catch any issues
- Run the expressjs codemod for safety: `npx @expressjs/codemod upgrade`

### dotenv 17 (Low Risk)
- Only changes logging behavior
- Simple fix: add `{ quiet: true }`

### GitHub Actions (Low Risk)
- Standard major version bumps
- Maintained by GitHub, should be backward compatible

### node-pty (Low Risk)
- Minor version bump
- Should be fully backward compatible

---

## Execution Order

1. Wait for Dependabot rebases (~5 min)
2. Merge CI PRs (#2, #3, #6) - no code changes
3. Merge node-pty PR (#4) - no code changes
4. Update server.js for dotenv v17, merge PR #5
5. Update server.js for Express v5, merge PR #7
6. Final verification
