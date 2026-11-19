# KRISHI-MITHRA Firestore Security Specification

## Collections & Access Matrix

1. `/users/{userId}` (`UserProfile`)
   - **Owner-only private profile**:
     - `get`: Authenticated, `email_verified == true`, `request.auth.uid == userId`, valid document ID.
     - `list`: Denied (`false`) to prevent user enumeration or PII exposure.
     - `create`: Owner-only; must satisfy `isValidUserProfile` with `uid == userId`, `email == request.auth.token.email`, non-empty `farmerName` (1–80 chars), bounded crop lists (`favoriteCropIds <= 80`, `savedVegetableIds <= 50`, `savedFruitIds <= 50`), and server timestamps `createdAt == request.time`, `lastLoginAt == request.time`, `updatedAt == request.time`.
     - `update`: Owner-only; immutable `uid` and immutable `createdAt` (once set); `updatedAt == request.time`; `affectedKeys().hasOnly(...)` strictly restricts mutable fields.
     - `delete`: Owner-only.

2. `/users/{userId}/alerts/{alertId}` (`PriceAlert`)
   - Owner-only `get`, `list` (with `resource.data.ownerUid == request.auth.uid`), `create` (`createdAt == request.time`), `update` (immutable `id`, `ownerUid`, `createdAt`; strict `affectedKeys`), `delete`.

3. `/users/{userId}/notes/{noteId}` (`FarmNote`)
   - Owner-only `get`, `list` (with `resource.data.ownerUid == request.auth.uid`), `create` (`createdAt == request.time`), `update` (immutable `id`, `ownerUid`, `createdAt`; strict `affectedKeys`), `delete`.

## Global Safety
- Default-deny root rule (`match /{document=**} { allow read, write: if false; }`).
- Verified email required for all access.
- Server secrets (`GEMINI_API_KEY`, `DATA_GOV_IN_API_KEY`, `IMD_API_KEY`) never touch Firestore or client bundles.
