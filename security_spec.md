# Security Specification — Krishi Mitra Firestore Rules

## 1. Data Invariants
1. All user preferences, price alerts, and farm notes reside strictly under `/users/{userId}` and subcollections owned by `request.auth.uid`.
2. Unauthenticated users and cross-user reads/writes are universally denied (default-deny catch-all at root).
3. No PII (email, phone number, physical address) is stored in Firestore user documents; only preference IDs, alert numbers, and short farm notes.
4. `uid`, `ownerUid`, `id`, and `createdAt` are immutable after creation; timestamps (`createdAt`, `updatedAt`) must equal `request.time`.
5. Every string and list enforces strict `.size()` and regex boundaries to prevent storage abuse.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read of `/users/userA`.
2. Cross-user read of `/users/userB` while signed in as `userA`.
3. Cross-user create in `/users/userB/alerts/alert1` while signed in as `userA`.
4. Identity spoofing: `userA` writes `/users/userA/alerts/a1` with `ownerUid: "userB"`.
5. Shadow field injection: `userA` writes `/users/userA` with extra `isAdmin: true`.
6. Oversized favorite list: `favoriteCropIds` array with 26+ elements (`> 25`).
7. Invalid language code: `selectedLanguage: "fr"` outside `["en", "kn", "hi", "te", "ta"]`.
8. Resource poisoning ID: `alertId` exceeding 128 chars or containing invalid symbols (`../bad`).
9. Negative or absurd price alert: `targetPrice <= 0` or `targetPrice > 100000`.
10. Timestamp forgery: `createdAt` set to a client timestamp instead of `request.time`.
11. Immutable field mutation: updating `ownerUid` or `createdAt` on an existing `FarmNote`.
12. Oversized farm note content: `content.size() > 2000` or `title.size() > 120`.
