# EFYL Digital Address Book — PRD v2.0.0

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
