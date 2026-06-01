# EFYL Digital Address Book — Comprehensive Project Prompt (FR + EN)

> Ce document est un **brief complet** destiné aux développeurs, designers, testeurs QA, partenaires gouvernementaux et bailleurs. Il décrit la mission, les fonctionnalités, l'architecture technique, les flux utilisateurs et la roadmap. Lisez-le en entier avant tout test ou intégration.
>
> This document is a **complete brief** intended for developers, designers, QA testers, government partners and donors. It describes the mission, the features, the technical architecture, the user flows and the roadmap. Read it entirely before any test or integration.

---

## 1. 🇫🇷 Version Française

### 1.1 Vision et Mission

**EFYL Address Book** est une application mobile **hors ligne d'abord** destinée à **créer, partager et vérifier des adresses numériques précises** dans les zones de l'Afrique Sub-Saharienne (et au-delà) où la nomenclature de rues classique est inexistante, partielle ou obsolète.

L'objectif est triple :

1. **Permettre à chaque citoyen** de créer une adresse numérique unique (ex : `BES-AKW-3-12`) en se tenant simplement devant sa porte, sans dépendre d'un service public ou d'un opérateur télécom.
2. **Faciliter les livraisons, secours, recensement et planification urbaine** en mettant à disposition des coordonnées GPS centimétriques + photo + direction d'entrée vérifiables.
3. **Cartographier de manière participative** tous les commerces visibles d'un quartier afin que n'importe quel utilisateur puisse trouver une pharmacie, un atelier ou une clinique à proximité, même quand l'État ne tient aucun registre.

### 1.2 Public cible

* Particuliers (foyers) qui veulent enregistrer leur logement pour le partager via WhatsApp/SMS.
* Commerçants qui veulent rendre leur boutique trouvable par tout le quartier.
* ONG et opérateurs humanitaires pour le recensement de bénéficiaires.
* Mairies, services postaux, livreurs, services d'urgence.
* Statisticiens et chercheurs pour études socio-économiques.

### 1.3 Principes fondateurs

| Principe | Implémentation concrète |
|---|---|
| Hors-ligne d'abord | Toute donnée est sauvegardée dans **AsyncStorage** avant tout appel réseau. Une file de synchronisation se vide automatiquement dès que la connectivité revient (détection via `@react-native-community/netinfo`). |
| Confidentialité par défaut | Les enquêtes **Foyer** restent strictement privées (`owner_id` filtré côté serveur). Aucun partage par défaut. |
| Commerces publics | Les enquêtes **Commerce** sont publiques par construction (`is_commerce = true`) pour alimenter la carte communautaire. |
| Précision GPS | Mesure haute précision multi-échantillons (jusqu'à 60 lectures, écart-type, EMA Kalman simplifié). Fallback "Sauvegarder quand même" en dessous d'un seuil. |
| Vérification croisée | Tout utilisateur peut se rendre devant une adresse et la "vérifier" — si la distance dépasse 10 m elle est signalée. 3 signalements = adresse marquée comme suspecte. |
| Multilingue | Français + Anglais. Sélection persistée. |

### 1.4 Fonctionnalités principales

#### 1.4.1 Création d'adresse — Assistant en 5 étapes

1. **Mesurer la porte** : multi-lectures GPS jusqu'à atteindre <= 1 m de précision (vert), avec fallback "Sauvegarder quand même" si la précision plafonne. Affichage des satellites verrouillés.
2. **Détails** : Quartier (auto-détecté via géocodage inverse Nominatim), Secteur, Rue, Numéro de maison, Contact, Notes.
3. **Direction & Photo** : 
    - **Boussole (azimut)** : pointer le téléphone vers l'entrée, verrouiller la direction. L'azimut est sauvegardé en degrés.
    - **Photo du bâtiment** : optionnelle, prise par caméra, encodée en base64 dans l'enregistrement.
4. **Correction satellite** : carte Leaflet avec image OpenStreetMap (option satellite Esri). L'utilisateur peut glisser un point orange pour corriger manuellement la position si la mesure GPS est légèrement décalée. Les coordonnées brutes (lat_raw, lng_raw) et corrigées (lat_corrected, lng_corrected) sont stockées séparément.
5. **Vérifier** : Aperçu complet + enregistrement.

#### 1.4.2 Enquête guidée (bifurcation Foyer/Commerce)

À la fin de la création d'adresse, l'utilisateur est invité à compléter une **enquête** en répondant à une première question : **« Foyer ou Commerce ? »**.

- **Foyer (privé)** :
    - Nombre de personnes, sources de revenus, niveau de revenus.
    - Téléphones, internet, électricité, eau, toilettes, cuisine, pièces de vie, étages.
    - Matériaux : murs, fenêtres, toiture.
    - Véhicules (vélos, motos, voitures, camions).
    - Liste des personnes (nom, téléphone/email, âge, genre, éducation, profession, lieu fréquenté).
- **Commerce (public)** :
    - Nom du commerce, propriétaire, téléphone.
    - Produits/activité.
    - Horaires (Lun-Ven, Sam, Dim).

L'enquête se termine par un récapitulatif. Le bouton « Enregistrer » fait apparaître un toast de confirmation et déclenche la sync différée.

#### 1.4.3 Carte communautaire

Sur l'écran **Carte**, l'utilisateur voit :
- ✅ Ses propres adresses (pinpoints verts/jaunes/rouges selon précision et vérification).
- 🏪 Les commerces partagés par toute la communauté (pinpoints orange) — toggle activable/désactivable.
- Bascule **Plan / Satellite**.

#### 1.4.4 QR code et partage

Chaque adresse génère un QR code contenant l'ID d'adresse + coordonnées. Boutons partage WhatsApp, SMS, Email, générique. Scan d'un QR d'un autre utilisateur permet d'ajouter l'adresse à son carnet et d'obtenir l'itinéraire.

#### 1.4.5 Vérification communautaire

Quand un utilisateur se rend devant une adresse partagée par un tiers, il peut appuyer sur « Vérifier ». Le serveur calcule la distance haversine entre sa position et celle enregistrée. Si <= 10 m, l'adresse est marquée `verified`. Sinon, le `flag_count` est incrémenté.

#### 1.4.6 Authentification

* OTP par SMS via **Twilio Verify** (production).
* Fallback mock : le code `123456` est toujours valide en mode démo (variable d'environnement `TWILIO_ENABLED=false`).
* Mode invité accessible sans authentification — toutes les fonctionnalités restent disponibles mais les données restent locales.

#### 1.4.7 Synchronisation

* File d'attente d'opérations (`CREATE`, `DELETE`, `UPSERT survey`) persistée dans AsyncStorage.
* Vidage automatique au retour du réseau via `NetInfo.addEventListener`.
* Endpoint `/api/sync` (bulk upsert) pour les adresses + endpoints `POST /api/surveys` et `DELETE /api/surveys/{id}` pour les enquêtes.

#### 1.4.8 Export CSV / JSON

* `/api/export/csv?owner_id=<id>` : fichier CSV téléchargeable avec toutes les colonnes adresse + enquête + commerce + résumé des personnes.
* `/api/export/json?owner_id=<id>` : payload JSON équivalent pour intégrations tierces.

### 1.5 Architecture technique

```
┌─────────────────────────┐         ┌─────────────────────────┐
│  Expo React Native App  │         │     FastAPI + MongoDB   │
│  (expo-router, TS)      │ ◄────► │  (Motor async, Pydantic)│
│  - AsyncStorage         │   API   │  - twilio (optionnel)   │
│  - NetInfo              │  /api   │  - Haversine math       │
│  - Leaflet (WebView)    │         │  - CSV / JSON export    │
│  - expo-location        │         │                         │
│  - expo-camera          │         │                         │
│  - expo-sensors         │         │                         │
└─────────────────────────┘         └─────────────────────────┘
```

* Stockage local : `AsyncStorage` (clés : `addresses`, `surveys`, `sync_queue`, `survey_queue`, `last_sync`, `prefs`, `user`).
* Carte : `react-native-webview` + `Leaflet 1.9` + tiles OSM/Esri.
* Géocodage inverse : `Nominatim OpenStreetMap`.
* GPS : `expo-location` avec `Accuracy.BestForNavigation` et multi-échantillonnage.
* Boussole : `expo-sensors/Magnetometer`.

### 1.6 Modèle de données (MongoDB)

* `addresses` : `{ address_id, latitude, longitude, accuracy_meters, lat_raw, lng_raw, lat_corrected, lng_corrected, azimuth_degrees, photo_base64, is_commerce, has_survey, owner_id, district, sector, street_id, house_number, contact_name, contact_phone, notes, verified, flag_count, low_accuracy, created_at }`
* `surveys` : `{ address_id, owner_id, survey_type ('household' | 'commerce'), total_persons, main_income_source, ... commerce: {…}, persons: [{name, age, gender, education, …}] }`
* `users` : `{ user_id, phone, last_login }`
* `otp_codes`, `otp_attempts` : pour rate-limit et stockage des hash OTP en mode mock.
* `flags` : historique des vérifications.

### 1.7 Roadmap

| Sprint | Lot |
|---|---|
| ✅ S1 | MVP adresses + GPS + QR + carte basique |
| ✅ S2 | Carte Leaflet, auto-sync, low-accuracy fallback |
| ✅ S3 | Enquêtes guidées, boussole, photo, correction satellite, export CSV |
| ✅ S4 | Bifurcation Foyer/Commerce + carte communautaire |
| 🟡 S5 | Twilio production, Google Play Store |
| 🔵 S6 | Mode hors ligne enrichi (tuiles préchargées), Analytics |

### 1.8 Identifiants de test

* Numéro de test : `+237 600 000 000` (ou n'importe quel format).
* Code OTP démo : `123456`.

### 1.9 KPIs cibles

* Précision GPS médiane : <= 2 m.
* Temps moyen création adresse : <= 60 s.
* Taux de complétion enquête Foyer : >= 70 %.
* Taux de complétion enquête Commerce : >= 85 %.
* Taux de sync réussie après reconnexion : 100 %.

---

## 2. 🇬🇧 English Version

### 2.1 Vision & Mission

**EFYL Address Book** is an **offline-first mobile application** designed to **create, share and verify accurate digital addresses** in Sub-Saharan Africa (and beyond), where standard street naming is missing, partial or outdated.

The triple goal is:

1. **Empower every citizen** to create a unique digital address (e.g. `BES-AKW-3-12`) by simply standing in front of their door, without depending on public services or telecom operators.
2. **Enable deliveries, emergency response, census and urban planning** by exposing verifiable centimetre-grade GPS coordinates + photo + door direction.
3. **Crowd-map all visible commerces** in a neighbourhood so any user can find a pharmacy, workshop or clinic nearby — even when no official registry exists.

### 2.2 Target audience

* Households who want to register their home and share via WhatsApp/SMS.
* Shop owners who want to be found by anyone in the neighbourhood.
* NGOs and humanitarian operators for beneficiary census.
* City councils, postal services, couriers, emergency services.
* Statisticians and researchers for socio-economic studies.

### 2.3 Core principles

| Principle | Implementation |
|---|---|
| Offline-first | Every record is saved to **AsyncStorage** before any network call. The sync queue auto-flushes once connectivity returns (`@react-native-community/netinfo`). |
| Private by default | **Household** surveys remain strictly private (`owner_id` filtered server-side). No sharing by default. |
| Public commerces | **Commerce** surveys are public by design (`is_commerce = true`) — they feed the community map. |
| GPS accuracy | High-precision multi-sample measurement (up to 60 readings, std-dev, simplified Kalman EMA). Fallback "Save anyway" under threshold. |
| Cross-verification | Any user can walk to an address and "verify" it — if the distance exceeds 10 m, the address is flagged. 3 flags = address marked suspicious. |
| Multilingual | French + English. Selection persisted. |

### 2.4 Main features

#### 2.4.1 Address creation — 5-step wizard

1. **Measure doorstep**: multi-sample GPS until <= 1 m accuracy (green), with fallback "Save anyway" if accuracy plateaus. Locked-satellite count displayed.
2. **Details**: District (auto-detected via Nominatim reverse geocoding), Sector, Street, House number, Contact, Notes.
3. **Direction & Photo**:
    - **Compass (azimuth)**: point the phone at the entrance, lock direction. Saved in degrees.
    - **Building photo**: optional, captured via camera, encoded base64 in the record.
4. **Satellite correction**: Leaflet map with OpenStreetMap tiles (optional Esri satellite). User can drag an orange pin to manually correct the position. Raw (`lat_raw`/`lng_raw`) and corrected (`lat_corrected`/`lng_corrected`) coordinates are stored separately.
5. **Review**: full preview + save.

#### 2.4.2 Guided survey (Household/Commerce bifurcation)

After address creation, the user is invited to complete a **survey** starting with: **"Household or Commerce?"**.

- **Household (private)**:
    - People count, income sources, income level.
    - Phones, internet, electricity, water, toilets, kitchen, rooms, floors.
    - Materials: walls, windows, roof.
    - Vehicles (bicycles, motorcycles, cars, trucks).
    - Persons list (name, phone/email, age, gender, education, profession, frequented place).
- **Commerce (public)**:
    - Business name, owner, phone.
    - Products/activity.
    - Hours (Mon-Fri, Sat, Sun).

The survey ends with a summary. "Save" triggers a confirmation toast and the deferred sync.

#### 2.4.3 Community map

On the **Map** screen, the user sees:
- ✅ Their own addresses (green/yellow/red pins based on accuracy and verification).
- 🏪 Commerces shared by the whole community (orange pins) — toggleable.
- **Streets / Satellite** layer switch.

#### 2.4.4 QR code and sharing

Every address generates a QR code containing the address ID + coordinates. Share buttons: WhatsApp, SMS, Email, Generic. Scanning another user's QR adds the address to your book and lets you open turn-by-turn directions.

#### 2.4.5 Community verification

When a user stands at another user's address and taps "Verify", the server computes a haversine distance between the live GPS and the stored coordinates. If <= 10 m: address marked `verified`. Otherwise: `flag_count` incremented.

#### 2.4.6 Authentication

* SMS OTP via **Twilio Verify** (production).
* Mock fallback: code `123456` always works in demo mode (`TWILIO_ENABLED=false`).
* Guest mode accessible without auth — all features remain usable but data stays local.

#### 2.4.7 Synchronisation

* Op queue (`CREATE`, `DELETE`, `UPSERT survey`) persisted in AsyncStorage.
* Auto-flush on network return via `NetInfo.addEventListener`.
* Endpoint `/api/sync` (bulk upsert) for addresses + `POST /api/surveys` and `DELETE /api/surveys/{id}` for surveys.

#### 2.4.8 CSV / JSON export

* `/api/export/csv?owner_id=<id>`: downloadable CSV with all address + survey + commerce + persons summary columns.
* `/api/export/json?owner_id=<id>`: equivalent JSON payload for third-party integrations.

### 2.5 Technical architecture

```
┌─────────────────────────┐         ┌─────────────────────────┐
│  Expo React Native App  │         │     FastAPI + MongoDB   │
│  (expo-router, TS)      │ ◄────► │  (Motor async, Pydantic)│
│  - AsyncStorage         │   API   │  - twilio (optional)    │
│  - NetInfo              │  /api   │  - Haversine math       │
│  - Leaflet (WebView)    │         │  - CSV / JSON export    │
│  - expo-location        │         │                         │
│  - expo-camera          │         │                         │
│  - expo-sensors         │         │                         │
└─────────────────────────┘         └─────────────────────────┘
```

* Local storage: `AsyncStorage` (keys: `addresses`, `surveys`, `sync_queue`, `survey_queue`, `last_sync`, `prefs`, `user`).
* Map: `react-native-webview` + `Leaflet 1.9` + OSM/Esri tiles.
* Reverse geocoding: `Nominatim OpenStreetMap`.
* GPS: `expo-location` with `Accuracy.BestForNavigation` + multi-sampling.
* Compass: `expo-sensors/Magnetometer`.

### 2.6 Data model (MongoDB)

* `addresses`: `{ address_id, latitude, longitude, accuracy_meters, lat_raw, lng_raw, lat_corrected, lng_corrected, azimuth_degrees, photo_base64, is_commerce, has_survey, owner_id, district, sector, street_id, house_number, contact_name, contact_phone, notes, verified, flag_count, low_accuracy, created_at }`
* `surveys`: `{ address_id, owner_id, survey_type ('household' | 'commerce'), total_persons, main_income_source, ... commerce: {…}, persons: [{name, age, gender, education, …}] }`
* `users`: `{ user_id, phone, last_login }`
* `otp_codes`, `otp_attempts`: rate-limit + mock OTP hash storage.
* `flags`: verification history.

### 2.7 Roadmap

| Sprint | Scope |
|---|---|
| ✅ S1 | MVP addresses + GPS + QR + basic map |
| ✅ S2 | Leaflet map, auto-sync, low-accuracy fallback |
| ✅ S3 | Guided surveys, compass, photo, satellite correction, CSV export |
| ✅ S4 | Household/Commerce bifurcation + community map |
| 🟡 S5 | Twilio production, Google Play Store |
| 🔵 S6 | Enhanced offline mode (pre-cached tiles), Analytics |

### 2.8 Test credentials

* Test number: `+237 600 000 000` (or any format).
* Demo OTP code: `123456`.

### 2.9 Target KPIs

* Median GPS accuracy: <= 2 m.
* Average address creation time: <= 60 s.
* Household survey completion rate: >= 70 %.
* Commerce survey completion rate: >= 85 %.
* Sync success rate after reconnection: 100 %.

---

## 3. 📩 Contact & Crédits / Credits

* App nom / name: **EFYL Address Book**
* Tagline FR: *Votre adresse. Partout.*
* Tagline EN: *Your address. Everywhere.*
* Stack: Expo SDK 53+, FastAPI 0.110+, MongoDB 7+, Python 3.11+.
* Testing: pytest backend + testing_agent expo automation.
