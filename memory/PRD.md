# EFYL Digital Address Book — PRD

## Product
EFYL GmbH digital addressing MVP for Sub-Saharan Africa, piloted in Bonamoussadi (Douala, Cameroun). Allows residents to measure their doorstep with sub-meter GPS, generate a standardized address code, share it via QR/WhatsApp/SMS, and view all addresses on an offline-capable map.

## Tech Stack
- Frontend: Expo (SDK 54) + expo-router file-based navigation, TypeScript, react-native-qrcode-svg, expo-camera (mobile), expo-location, AsyncStorage
- Backend: FastAPI + MongoDB (motor)
- Fonts: DM Sans (UI) + JetBrains Mono (address codes only)
- Color system: Deep Forest Green #0D5C3A + Warm Amber #E8851A on warm off-white #F8F6F0

## Architecture
- 12 screens via expo-router (splash, onboarding, 4 tabs, new-address wizard, address detail, qr, verify, login, import)
- Offline-first: all CRUD writes go to AsyncStorage first, queued in `efyl:sync_queue`, flushed via POST /api/sync
- Bilingual FR (default) / EN with instant language switch
- Demo data seeded on first launch (5 addresses across Bonamoussadi, Akwa, Makepe)

## Backend Endpoints (all prefixed `/api`)
- GET `/health`
- POST `/addresses` — upsert by (address_id, owner_id)
- GET `/addresses?owner_id=&q=` — list / search
- GET `/addresses/{address_id}` — single (falls back to public)
- PUT `/addresses/{address_id}` — partial update
- DELETE `/addresses/{address_id}`
- POST `/sync` — bulk push pending operations
- POST `/verify` — Haversine distance check; flags if > 10 m, marks verified if ≤ 10 m
- GET `/addresses-nearby?lat=&lng=&radius_km=`
- POST `/auth/otp/request` — **MOCKED** (returns `demo_code: "123456"`)
- POST `/auth/otp/verify` — accepts `123456`

## Key Features Delivered
- ✅ GPS measurement wizard with animated pulsing accuracy ring (red/yellow/green) and 3.0 m save threshold
- ✅ QR code generation + scanning (mobile) / web fallback demo import
- ✅ Address detail with directions deep-link, share, QR display, report inaccuracy
- ✅ Pseudo-map view with brand-coloured pins (verified=green, unverified=amber, flagged=red)
- ✅ Profile with sync queue badge, language toggle, full data wipe
- ✅ Phone-OTP login (mock) + guest mode
- ✅ Deep-link import handler (`/import?id=...`)

## Mocked / Deferred for v1.0.0 MVP
- Twilio SMS OTP (using mock 123456 for investor demo)
- Mapbox / OSM real tiles (custom canvas + pins used)
- Native push for sync notifications

## Test Credentials
None — guest mode is default. Login uses any phone + code `123456`.

## Next Steps (post-MVP)
- Real Twilio + remove `demo_code` field from API response
- react-native-maps with offline tile cache for Douala
- Verified Contributor gamification badge
- Municipality dashboard (web)
