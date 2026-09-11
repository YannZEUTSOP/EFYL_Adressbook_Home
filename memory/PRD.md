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

## v5 — Field incident fix + Account system — August 2026 (iteration_8: 23/23 backend + all frontend PASS, total suite 93 tests)
- ROOT CAUSE FIX (quota crash): base64 photos moved OUT of AsyncStorage/localStorage into dedicated PhotoStore (src/services/photoStore.ts — IndexedDB on web, expo-file-system JSON per address on native). migratePhotosOut() runs at AppContext startup: auto-repairs saturated devices (validated: 1 MB localStorage → 795 bytes, photos preserved & displayed). Sync queue stores slim payloads; syncNow rehydrates photos from PhotoStore and uploads in chunks of 4. STORAGE_FULL friendly error replaces crash. photos_count field added (frontend + backend models + CSV export).
- ACCOUNT SYSTEM (phone + 4-digit PIN, guest mode kept): POST /api/auth/register (name+phone+PIN+OTP, bcrypt hash, 409 if exists), POST /api/auth/login (phone OR EFYL-XXXXXX + PIN, 5 fails → 15 min lockout, anti-enumeration dummy hash), GET /api/restore (JWT Bearer 90d, JWT_SECRET in backend/.env) → pulls all synced addresses(+photos)+surveys to a new device. EFYL ID = stable hash of phone (EFYL-XXXXXX). user_id format unchanged (user_<digits>) so pre-account synced data stays linked. login.tsx fully rewritten (choice/register/OTP/done/login modes); profile shows name + EFYL ID.
- Restore user projection restricted to explicit fields (post-review hardening).

## v6 — Data-Quality batch (réponse au Rapport Qualité Fotouni) — Août 2026 (iteration_9: 109/109 backend + frontend PASS)
- Azimut OBLIGATOIRE (step 3 new-address) + fallback manuel 8 directions (dir-N..dir-NO chips) — répond aux 64.7% missing_azimuth.
- Enquête foyer : bandeau compteur personnes (persons-count-banner, +/- déclaré inline), 'Terminer' bloqué si enregistrées < déclarées (persons_count_mismatch 69.2%). Lieux fréquentés OBLIGATOIRES par personne sauf case 'ne se déplace pas' (no_places) — répond aux 97.1% missing_persons_places.
- Commerce : NOUVEAU champ workers (obligatoire >=1) + horaires semaine obligatoires.
- Service public : NOUVEAUX champs obligatoires managing_org, phone (+chip 'Pas de téléphone'), workers, capacity_max, usage_current, hours (placeholders contextuels école/santé).
- Hint cuisine séparée = bâtiment à part (kitchen-hint).
- Écran QR : CTA accent 'Faire l'enquête maintenant' si pas d'enquête (no_survey 45%).
- CSV admin : nouvelles colonnes commerce_workers, public_workers, public_capacity_max, public_usage_current, public_hours + colonne quality_issues (flags QA par ligne).
- NOUVEAU GET /api/admin/address/{id}?pin= + recherche bâtiment dans /admin (fiche complète : adresse+enquête+habitants+lieux).
- Rapport utilisateur : /app/memory/RAPPORT_CORRECTIONS_QUALITE_DONNEES_FR.md
- IMPORTANT (réponse utilisateur) : l'export du soir doit utiliser le bouton Admin 'Exporter tout (CSV admin)' (serveur), PAS l'export Profil (local uniquement).

## v6.1 — Export CSV ENRICHI (copie lecture seule) — Août 2026
- NOUVEAU GET /api/admin/export/csv-enriched?pin= : copie enrichie du CSV admin, 85 colonnes (+auto_completed en dernière). Récupérations validées sur données réelles : 611 azimuts depuis les bearings photos (625 manquants → 17), lieux fréquentés depuis le champ texte legacy frequented_place, 3 enquêtes orphelines rattachées en lignes supplémentaires. Base NON modifiée, export normal inchangé.
- Fix CSV (les 2 exports) : le survey lookup privilégie l'enquête du owner de la ligne avant fallback (doublons multi-appareils).
- Bouton Admin « Exporter CSV ENRICHI (récupération auto) » (admin-export-enriched-btn) + hint.
- 109/109 tests backend verts.

## v6.2 — Référentiel PDF des questionnaires — Août 2026
- PDF complet généré : /app/memory/EFYL_Questionnaires_Complets_FR.pdf (script /app/scripts/generate_questionnaire_pdf.py, reportlab + police DM Sans de l'app). Contenu : question commune (type de bâtiment), Foyer 17 questions + fiche par personne (7) + fiche par lieu fréquenté (4), Commerce 8, Service public 9, Patrimoine 14, Annexe création d'adresse 11. Options de réponse, mentions OBLIGATOIRE/optionnel, règles de blocage et sous-questions conditionnelles incluses. Vérifié par extraction (accents OK).
- Téléchargement : GET /api/admin/docs/questionnaires.pdf?pin=237237 (protégé PIN, lecture seule).
- Aucune modification fonctionnelle de l'app (demande explicite de l'utilisateur).
- v6.2b : version anglaise du PDF ajoutée (/app/memory/EFYL_Questionnaires_Complets_EN.pdf, script generate_questionnaire_pdf_en.py). Endpoint accepte ?lang=en.

## v7 — Répertoire EFYL + Identité invité liée à l'appareil — Juin 2026

### A. Répertoire EFYL (registre & recherche publique)
- NOUVEL onglet « Répertoire » (5e onglet) → `app/(tabs)/directory.tsx` : 4 catégories avec compteurs (Foyers / Commerces / Services publics / Sites & Patrimoine) + total du registre central.
- `app/directory/list/[category].tsx` : recherche serveur debouncée (nom, matricule, code adresse, quartier, secteur, n° de maison — insensible casse/accents), tri A→Z / Le plus proche (GPS, permission contextuelle + lien Réglages) / Récents, pagination 40, états vide/hors-ligne.
- `app/directory/fiche/[id].tsx` : fiche filtrée par confidentialité + photo façade + mini-carte + bloc Localisation (quartier/secteur/rue/n°, repères d'accès, azimut d'entrée, source du point) + bloc Informations par catégorie + bouton « Se rendre à cette adresse » (bottom sheet : Google Maps / OpenStreetMap / copier coordonnées) + Appeler + partage.
- Backend `routes/directory.py` (+ `shared.py` pour db/JWT/normalisation) :
  - `GET /api/directory/summary` — compteurs par catégorie (dédoublonnage par code adresse : 2148 lignes → 1246 fiches uniques).
  - `GET /api/directory/entries` — index en cache 45 s, noms résolus depuis les enquêtes (family_name / commerce.name / public_service.name / heritage.name) sinon contact_name.
  - `GET /api/directory/entry/{address_id}` — LISTE BLANCHE par catégorie. Foyer = AUCUNE donnée d'enquête (pas d'habitants, revenus, téléphones, matériaux) ; commerce/public/patrimoine = infos publiques utiles.
  - Point de guidage : `nav_lat/nav_lng` (import terrain) > GPS corrigé satellite > GPS brut, source affichée à l'utilisateur.
- Nouveaux champs Address : `matricule`, `nav_lat`, `nav_lng`, `nav_note` (+ 4 colonnes ajoutées aux 2 exports CSV avant `quality_issues`).
- Import admin : `POST /api/admin/import/matricules?pin=` (`{csv_text, dry_run}`) — détection auto du séparateur (`,`/`;`) et des colonnes (address_id|code|code_adresse, matricule, latitude_exacte/nav_lat, longitude_exacte/nav_lng, acces/nav_note), mode test à blanc, rapport (lignes lues / adresses trouvées / matricules / points / codes inconnus). UI dans `/admin` via expo-document-picker.

### B. Identité invité liée à l'appareil (`routes/guest.py`)
- Empreinte d'appareil `src/services/device.ts` : SHA-256(identifiant d'installation Android/iOS ou signature navigateur + modèle + marque + OS) — volontairement INDÉPENDANTE d'AsyncStorage pour survivre à un effacement du stockage.
- Compte invité = `EFYL-G-XXXXXX` + PIN 4 chiffres généré serveur (PIN faibles exclus), bcrypt, `is_guest:true`, liste `devices[]`. `user_id = guest-<deviceId>` quand il est libre → toutes les données déjà enregistrées sur l'appareil restent rattachées.
- Cas d'usage couverts : 1re fois (création + affichage unique ID/PIN copiables) · reprise auto (session locale) · appareil reconnu après effacement du stockage (carte « Reprendre ») · nouvel appareil (recherche par prénom → candidats à identifiants MASQUÉS + `ref` JWT 15 min → PIN) · aucun candidat → création · 5 PIN faux → blocage 15 min · plusieurs invités par appareil · hors-ligne (`prefs.pendingGuestName` → enregistrement automatique au retour du réseau via `ensurePendingGuest()` dans AppContext) · consultation ID/PIN dans Profil.
- Sécurité : le prénom ne sert QU'À retrouver un compte (jamais à s'authentifier), identifiants masqués (`EFYL-G-••••C3`), `ref` opaque signé, hash d'appareil = indice seulement.
- `login.tsx` : nouveaux modes guest-choice / guest-new / guest-done / guest-lookup / guest-pin ; `Profil` affiche l'identité invité avec PIN révélable.

### C. CORRECTION v7.1 — cohérence Admin ↔ Répertoire (audit code adresse)
- Symptôme signalé par l'utilisateur : Admin annonçait 2 148 adresses (2003/89/41/15) alors que le Répertoire n'en montrait que 1 246 (1108/84/39/15).
- Cause : ma 1re version regroupait les fiches par `address_id` en supposant que les codes en double = même bâtiment enregistré sur plusieurs téléphones. **Hypothèse FAUSSE**, vérifiée sur les données réelles : 2 148 lignes pour seulement 1 166 codes distincts ; 363 codes sont partagés par 2 à 8 bâtiments DIFFÉRENTS (écarts mesurés de 49 m à 1 247 m), enregistrés par des enquêteurs différents. Le code est calculé depuis quartier+secteur+rue+maison saisis à la main (`buildAddressId`) → deux équipes dans le même quartier produisent le même code. Aucun couple (code, owner) en double → chaque ligne est bien un relevé distinct. 77 codes existent même dans 2 catégories différentes.
- Correction : le Répertoire liste désormais **une fiche par bâtiment relevé**, clé = `id` (uuid immuable de l'enregistrement, unique sur les 2 148 lignes). Compteurs strictement identiques à l'Admin (2003/89/41/15 = 2148).
- `GET /api/directory/entry/{key}` accepte l'uuid (nouveau) ou le code adresse (repli QR/anciens liens → fiche la plus complète).
- Nouveaux champs renvoyés : `key`, `surveyor` (nom de l'enquêteur), `shared_code` (bool). UI : ligne « 🔁 Relevé par X • date » dans la liste quand le code est partagé + bandeau d'avertissement sur la fiche.
- Cache d'index réduit à 10 s (reconstruction complète mesurée à ~50 ms).
- **Dette de données identifiée (à trancher avec l'utilisateur)** : le code adresse n'est PAS unique (1 345 bâtiments sur 2 148 concernés, 63 %). Impacts : lien de partage `/import?id=CODE` peut importer un homonyme (le QR lui-même embarque la donnée complète → non impacté) ; toute analyse CSV qui suppose l'unicité du code. Pistes proposées : (A) le matricule du CSV partenaire devient l'identifiant officiel unique, (B) suffixe unique ajouté dans les exports uniquement, (C) garde-fou à la création (avertir l'enquêteur si le code existe déjà à plus de X mètres et proposer le n° libre suivant).

## 📦 Livrables projet « AddressBook HOME » (nouveau produit dérivé) — Juin 2026
- Demande utilisateur : produire le descriptif projet complet + un prompt de lancement pour développer **AddressBook Home** dans un nouvel onglet Emergent. Home = version grand public/allégée de Census, limitée aux **domiciles personnels et petits commerces** (Service public et Patrimoine supprimés), palette **bleu ciel**, même stack, mêmes questionnaires Foyer/Commerce, plus un **échange d'adresses à consentement mutuel** et un **carnet personnel**.
- Livrables créés (téléchargeables via `GET /api/docs/download/<fichier>`) :
  - `memory/ADDRESSBOOK_HOME_DESCRIPTIF_PROJET_FR.md` + `memory/AddressBook_HOME_Descriptif_Projet_FR.pdf` (24 pages) — 21 sections : périmètre identique/nouveau/supprimé, thème bleu ciel (theme.ts complet), stack et arborescence, offline-first, identité téléphone+invité (10 cas d'usage), assistant 5 étapes avec seuils GPS exacts, matricule unique (corrige la dette des codes non uniques), questionnaires Domicile 17 Q + fiche personne + lieux et Commerce 8 Q (texte intégral), registre/carnet/échange avec machine à états et 12 cas limites, matrice de visibilité, modèle de données + API, i18n, console opérateur, 6 leçons qualité du terrain, 18 propositions d'amélioration (7 en P0), plan en 7 phases, 12 scénarios QA, 12 pièges à éviter.
  - `memory/ADDRESSBOOK_HOME_PROMPT_EMERGENT_FR.md` + `memory/AddressBook_HOME_Prompt_Emergent_FR.pdf` — prompt de lancement (rôle ingénieur senior, 8 règles d'or issues d'incidents réels, contraintes techniques, exigence design, méthode de travail par phases avec tests, 12 critères d'acceptation, interdits).
  - `scripts/md_to_pdf.py` — convertisseur Markdown → PDF (reportlab, polices DM Sans/JetBrains Mono, tableaux, blocs de code) réutilisable.
- Aucune modification du code de Census dans cette itération (livrables documentaires uniquement).
