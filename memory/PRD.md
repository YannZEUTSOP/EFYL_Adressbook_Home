# EFYL Digital AddressBook — PRD v2.0.0

## Product
Digital addressing platform for Sub-Saharan Africa with full household survey capability. Pilot Bonamoussadi, Douala, Cameroon.

## v2.1 — Bifurcation Foyer/Commerce + Carte communautaire (Sprint S4)

### Nouvelles fonctionnalités
13. **Bifurcation Foyer/Commerce** — la 1ère étape de l'enquête demande "Foyer ou Commerce ?" puis adapte les questions:
    - **Foyer**: 19 étapes (privées, `is_commerce=false`, visibles uniquement par le créateur).
    - **Commerce**: 3 étapes (publiques, `is_commerce=true`, visibles par toute la communauté).
14. **Endpoint public `/api/commerces`** — retourne tous les commerces partagés par n'importe quel utilisateur.
15. **Carte communautaire** — toggle dans l'onglet Carte qui affiche/masque les pins oranges 🏪 des commerces partagés.
16. **Section Accueil "Commerces de la communauté"** — liste sous "Mes adresses" avec tag Public.
17. **Badges Commerce** — pastilles visuelles (orange storefront) sur cartes d'adresse et page détail.

### Livrables QA
- `/app/memory/COMPREHENSIVE_PROMPT_FR_EN.md` — Description complète bilingue du produit (vision, fonctionnalités, architecture, modèle de données, roadmap, KPIs).
- `/app/memory/EFYL_QA_Test_Script_FR_EN.xlsx` — 51 scénarios FR + 51 EN avec colonnes ID/Module/Étape/Action/Résultat attendu/Résultat obtenu/Statut/Sévérité/Commentaires.

## v2.0 — Major Release (3 weeks of features in one)

### Week 1 Features (Field-ready)
1. **Real Twilio SMS OTP** (env-toggleable). Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE` to enable; falls back to mock `123456` otherwise.
2. **Real Leaflet/OpenStreetMap map** via WebView component — works on iOS/Android/Web. Plan + Satellite layers (Esri Imagery).
3. **NetInfo auto-sync** — flushes sync queue automatically when network returns.
4. **Save Anyway override** — after 120s without 3m precision, button appears; address saved with `low_accuracy:true` flag.

### Week 2 Features (Survey)
5. **Multi-step guided survey wizard** — 21 steps, one question at a time, per-question validation.
6. **Per-person records** — name, age, gender, education, profession, frequented place. Add one by one.
7. **Commerce sheet** — name, owner, phone, products, weekday/Sat/Sun hours.
8. **Full household conditions** — total persons, income source/level, phones, internet, electricity, water, toilets, kitchen, rooms, floors, walls, windows, roof, vehicles.

### Week 3 Features (Pro-grade)
9. **Compass / azimuth capture** — expo-sensors Magnetometer, locks N/E/S/W direction.
10. **Photo capture** — inline CameraView modal, base64 storage.
11. **Satellite GPS correction** — draggable orange pin on Esri satellite tiles. Stores both raw + corrected coords.
12. **CSV/JSON export endpoints** — `/api/export/csv` and `/api/export/json` for partner orgs.

## Backend (FastAPI + MongoDB + Twilio)
- 17 endpoints under `/api/*`
- Collections: addresses, surveys, flags, users, otp_codes, otp_attempts
- Rate limiting: 3 OTP requests / 10 min
- Hashed OTP storage (SHA-256)
- CSV header has 50+ columns for analytics

## Frontend (Expo SDK 54 + React Native 0.81)
- 13 screens (added /survey/[id])
- WebView+Leaflet cross-platform map
- Bilingual FR/EN (~250 strings)
- AsyncStorage offline-first + dual sync queues (addresses + surveys)
- NetInfo connectivity listener

## Tested
- 28/28 backend tests passing
- All frontend flows verified

## Mocked / Pending
- Twilio: env-toggleable. Provide credentials via .env to enable real SMS.
- Photo capture: works on mobile (Expo Go / native). Web fallback shows "needs mobile app".

## Test credentials
See /app/memory/test_credentials.md

## Offline Maps (Cartes hors ligne) — June 2026
- New screen `/offline-maps` (from Map tab button): download OSM tiles per city for full offline map usage.
- Preset cities: Fotouni + surroundings (Bafang, Bandja, Banka, Bana, Kékem) first, then major Cameroon cities; or "Ma position actuelle" (GPS).
- Radius 2/5/10 km, zooms 12–17, size estimate shown before download (~4/22/83 Mo), progress bar, cancel, resume ("Compléter") for partial zones, delete zones, storage total.
- Service `src/services/offlineTiles.ts`: slippy tile math, batched downloads (6 concurrent, resume-safe skip-existing), tiles in `documentDirectory/efyl_tiles/{z}/{x}/{y}.png`, region metadata in AsyncStorage.
- `LeafletMap` new prop `offlineMode`: when device offline (NetInfo), map switches to a custom Leaflet GridLayer fed by base64 tiles from local storage via WebView postMessage/injectJavaScript bridge (maxNativeZoom 17, upscales beyond). Applied on Map tab, address detail mini-map, new-address correction map.
- Web preview: download disabled with notice (native-only, expo-file-system). GPS positioning works offline natively.
- Tested: frontend iteration_5.json — 7/7 pass, no regressions.

## Twilio Production SMS — July 2026
- User provided real Twilio credentials (Account SID AC07d2..., Verify Service "EFYL GMBH" VAf50c...). Added to /app/backend/.env → twilio_enabled=true.
- Pipeline verified: account active (Trial), Verify service fetch OK, OTP request reaches Twilio (error 21608 for unverified numbers = expected Trial behavior).
- Fixed: auth HTTPException 502 → 400 (Cloudflare was masking 502 JSON with its own HTML error page).
- PENDING: account is TRIAL → SMS only to numbers verified in Twilio console. For public launch, user must upgrade Twilio account (add payment). Cost ≈ $0.37/successful login to Cameroon.
- UPDATE: At user request, Twilio keys temporarily COMMENTED OUT in backend/.env (mock 123456 active) until user upgrades his Trial account. Re-enable = uncomment 3 lines + restart backend.
- Session design confirmed: AsyncStorage login never expires (logout only manual) → one SMS per user lifetime, minimal SMS cost.

## Field-tester feedback batch (v3) — August 2026
All feedback from user's tester in Spain implemented & tested (iteration_6, 57/57 backend + full frontend pass):
- Satellite correction: Esri Hybrid tiles (imagery+roads+labels), full-height map, blue original GPS pin + orange draggable pin + dashed line, button "Enregistrer et continuer" after drag. Both raw & corrected coords already saved (confirmed).
- CSV/JSON export now CLIENT-SIDE from local storage (src/utils/exportData.ts): includes ALL addresses even unsynced; web=blob download, native=expo-sharing.
- Survey: NO defaults on any multiple choice (types allow ''/null, backend relaxed Literal→str); "Autre"→mandatory conditional text everywhere; income levels with FCFA guidance descriptions; rewordings (water/kitchen/rooms).
- Persons in wizard: list view + add/edit/delete with confirm; PersonsManager also requires gender/education.
- NEW 3rd survey type 'public' (Service public): PublicService model {name, category(8 cats), category_other, managing_org, phone, notes}; is_public propagated to address; visible on community map (violet pins) & /api/commerces.
- Commerce: HoursField structured picker (Open/Closed + hour/minute modal, format "HH:MM-HH:MM"|"closed", invalid impossible); ProductsPicker (21 predefined FR/EN products multi-select + custom add, stored comma-separated).
- Photos: up to 5 per address, each {base64,lat,lng,bearing,taken_at} (GPS via getLastKnownPositionAsync + heading at capture); delete with confirm; gallery on address detail. Address.photos in backend + photos_count in CSV.
- Compass: Location.watchHeadingAsync (sensor fusion, works phone upright) with magnetometer fallback; camera-aim mode: point camera at entrance, live heading overlay, capture locks azimuth + saves photo. NATIVE-ONLY (needs Expo Go/build for field test).
- Field test protocol for compass: pending user verification on 2-5 real buildings.

## Message-241 batch (v4) — August 2026 (iteration_7: 70/70 backend + 12/12 frontend PASS)
- BUGFIX: blank screen on community PUBLIC address detail (Fotouni TEST-PUB) — /address/[id] now falls back to Api.getAddress for remote community addresses; renders banner + map + GPS.
- Admin dashboard /admin (PIN 237237) → GET /api/admin/overview: per-tester stats, 4-category by_type, tester list, CSV export incl. heritage_* + persons_places columns.
- 4th survey type 'heritage' (Lieux sacrés et lieux touristiques): kind sacred/tourist/both, 10 categories, access free/paid(fee)/permission, hours, photos_allowed, facilities, road_access → is_heritage=true, publicly visible (map + /api/commerces).
- Survey wizard: "Retour" footer button preserving answers; draft save/resume "Continuer plus tard" (banner ↩️ on resume, draft cleared on final save).
- Person form: "Lieux fréquentés" (3-4 recommended) — category (boutique/travail/école/loisir/ami), name, frequency (Quotidien/Hebdo/Mensuel/Rarement), free-text reason.
- Compass instruction text on new-address step 3 (dehors, téléphone à hauteur de poitrine, haut vers la porte).
- GPS-correction step 4 CTA: "Continuer sans corriger" ↔ "Enregistrer et continuer" after pin drag.
- Camera permission flow with canAskAgain + Réglages redirect.
- SECURITY FIX: GET /api/addresses/{id} cross-owner fallback now restricted to is_commerce|is_public|is_heritage — private households return 404 for other users (per EFYL_STOCKAGE_ET_SCENARIOS_FR.md §3; QR share unaffected: QR payload imports locally).
- FIELD-DAY FIX (pre-test): native camera photos are now downscaled with expo-image-manipulator (640px, compress 0.4, ~40-60 KB base64) before local storage — prevents AsyncStorage saturation (6 MB Android limit) that raw 1-3 MB captures would have caused after ~10 photos. Web path already downscaled (800px).
