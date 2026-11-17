# PinkFinance — Firestore Security Specification (Shared Admin Workspace)

## 1. Data Invariants
1. **Isolated PII**: `/users/{userId}/private/profile` remains strictly owner-only (`userId == request.auth.uid && request.auth.token.email_verified == true`).
2. **Shared Company Workspace**: All company financial collections (`customers`, `invoices`, `payments`, `expenses`, `bankAccounts`, `wonSales`, `settings/exchangeRates`, `members`) reside under `/workspaces/pinkfinance/...` so every authenticated Google user shares the exact same company ledger as an Admin.
3. **RBAC-Ready Master Gate**: Every authenticated user registers their admin membership at `/workspaces/pinkfinance/members/{uid}` (`role: 'admin'`, `userId == request.auth.uid`). Single-document reads and all writes on `/workspaces/pinkfinance/...` verify `isWorkspaceAdmin('pinkfinance')` via the `members` gate so future role restrictions can be enforced without migrating collections.
4. **Legacy Workspace Read/Cleanup Support**: Existing `/users/{userId}/...` owner paths remain accessible strictly to the verified owner so previously entered personal records can be migrated seamlessly into `/workspaces/pinkfinance/...`.
5. **Strict Schema & Identity Integrity**: Every write enforces `isValid[Entity]`, immutable `createdBy` / `createdAt == request.time`, `updatedBy == request.auth.uid`, `updatedAt == request.time`, `workspaceId == 'pinkfinance'`, ID regex `^[a-zA-Z0-9_-]+$`, and `existsAfter` parent checks.

## 2. The "Dirty Dozen" Adversarial Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated List**: Unauthenticated client attempts `list` on `/workspaces/pinkfinance/customers`.
2. **Unverified Email Write**: Auth token with `email_verified: false` attempts write on `/workspaces/pinkfinance/customers/c1`.
3. **Member Spoofing**: User A attempts to create `/workspaces/pinkfinance/members/userB` (impersonating another member).
4. **Shadow / Ghost Field Injection**: User A creates Customer with extra field `superAdmin: true`.
5. **Orphaned Invoice**: User A creates Invoice with non-existent `customerId: "non-existent"`.
6. **Orphaned Payment**: User A creates Payment with non-existent `invoiceId: "non-existent"`.
7. **ID Poisoning**: User A attempts write to `/workspaces/pinkfinance/customers/` with invalid ID containing `$` or spaces.
8. **Client Timestamp Tampering**: User A creates Invoice with forged past `createdAt` instead of `request.time`.
9. **Immutable Creator Mutation**: User A attempts to update `createdBy` or `createdAt` on an existing Customer.
10. **Negative Amount / Value Poisoning**: User A creates Invoice with `amount: -500` or Expense with `amountTry: 0`.
11. **Immutable / Cross-Workspace Field Update**: User A attempts to mutate `workspaceId` or `createdBy` on an existing Invoice update.
12. **PII Blanket Read**: Non-owner authenticated user attempts `get` on `/users/{userA}/private/profile`.
