# ADDRESSBOOK **HOME** — Descriptif de projet complet
### Cahier des charges opérationnel, prêt à être exécuté par une équipe (ou un agent) de développement
**Version du document :** 1.0 — Juin 2026
**Produit de référence :** AddressBook **Census** v7.1 (en production, 2 148 adresses relevées, 600 enquêtes, 142 tests automatisés verts)
**Produit à construire :** AddressBook **Home** — version grand public, allégée, dédiée aux domiciles personnels et aux petits commerces

---

## 0. Comment lire ce document

Ce document est la **source de vérité unique** du projet Home. Il est écrit pour être exécuté sans avoir accès au code de Census : tout ce qui doit être reproduit à l'identique est **décrit explicitement** (seuils, règles, questions, textes, couleurs, endpoints, modèles de données).

Trois conventions :
- 🟢 **IDENTIQUE À CENSUS** → à reproduire au comportement près (même parcours, mêmes règles, mêmes messages).
- 🔵 **NOUVEAU DANS HOME** → n'existe pas dans Census, à concevoir avec les spécifications fournies ici.
- 🔴 **SUPPRIMÉ DANS HOME** → ne doit pas apparaître dans Home (ni écran, ni code mort, ni champ inutile).

---

## 1. Le produit

### 1.1 Origine — AddressBook Census

Census est une application de terrain (Expo + FastAPI + MongoDB) conçue pour l'**adressage numérique en Afrique subsaharienne** (pilote : Fotouni et Bonamoussadi, Cameroun). Des enquêteurs équipés de téléphones parcourent les quartiers, mesurent au GPS la **porte d'entrée** de chaque bâtiment, génèrent un **code d'adresse**, photographient la façade, mesurent l'**azimut de l'entrée** à la boussole, corrigent la position sur image satellite, puis remplissent un **questionnaire** dépendant du type de bâtiment (foyer, commerce, service public, patrimoine). Tout fonctionne **hors ligne** ; la synchronisation est automatique au retour du réseau. Un tableau de bord administrateur agrège le travail de tous les enquêteurs et exporte des CSV exhaustifs (92 colonnes).

Census est un outil **institutionnel** : il sert à *recenser*.

### 1.2 Ce qu'est AddressBook Home

Home est le **même moteur**, la même exigence de précision, mais retourné vers **l'individu** : ce n'est plus un enquêteur qui relève l'adresse des autres, c'est **chacun qui enregistre sa propre adresse** — son domicile, et/ou son commerce — puis qui peut **la partager et l'échanger** avec des personnes de confiance.

> **Phrase de positionnement :** « Dans un pays sans rues nommées, Home donne à chaque famille et à chaque boutique une adresse numérique précise à 3 mètres, un identifiant unique, un QR code, et la possibilité d'échanger son adresse avec qui elle veut — comme on échange un numéro de téléphone. »

**Deux catégories seulement**, et c'est la seule différence fonctionnelle de fond avec Census :
| Catégorie Home | Équivalent Census | Visibilité |
|---|---|---|
| 🏠 **Domicile** (maison d'habitation personnelle) | enquête « Foyer » | **Privé** — jamais visible sans consentement mutuel |
| 🏪 **Commerce / entreprise** (boutique, atelier, salon, petite entreprise) | enquête « Commerce » | **Public** — découvrable dans le Répertoire par tous |

🔴 **SUPPRIMÉ DANS HOME :** la catégorie *Service public* (école, santé, administration, point d'eau, antenne, lieu de culte) et la catégorie *Lieu sacré / touristique (patrimoine)*. Ni les écrans, ni les questionnaires, ni les champs de base de données, ni les icônes, ni les traductions correspondantes.
🔴 **SUPPRIMÉ DANS HOME :** toute la notion d'**enquêteur** (« Nom de l'enquêteur », « X adresses créées par enquêteur », suivi de productivité par agent, tableau de bord de supervision des équipes). Dans Home, l'utilisateur est le **propriétaire** de son adresse, pas un agent qui relève celle des autres.

### 1.3 Personas & cas d'usage

**P1 — Awa, 34 ans, Douala, vend du tissu depuis sa cour.**
Elle enregistre son domicile *et* sa boutique. Elle partage sa boutique sur WhatsApp avec ses clientes : le lien ouvre un itinéraire jusqu'à sa porte. Ses clientes trouvent la boutique sans l'appeler 3 fois.

**P2 — Jean-Marc, 41 ans, fonctionnaire à Bafoussam.**
Il enregistre son domicile pour recevoir ses colis et pour donner son adresse à sa banque. Il échange son adresse avec ses 6 frères et sœurs, sa mère au village, et 4 amis proches. Il refuse toutes les autres demandes.

**P3 — Ngo Bakang, 58 ans, au village de Fotouni.**
Sa fille en ville installe l'application pour elle et enregistre la maison familiale. Quand un taxi ou une ambulance doit venir, elle envoie un **lien de guidage temporaire** (voir §17-P3) : le chauffeur voit la photo de la façade, l'azimut de la porte et l'itinéraire — sans jamais accéder au reste.

**P4 — Éric, 27 ans, livreur.**
Il n'a pas de compte Home. Il reçoit des liens de guidage temporaires. Il scanne aussi des QR codes d'adresses imprimés sur les portails.

**Cas d'usage prioritaires (ordre d'importance) :**
1. Enregistrer mon domicile avec une précision GPS de 1 à 3 m et obtenir un identifiant + un QR code.
2. Enregistrer mon commerce et le rendre découvrable.
3. Retrouver dans le Répertoire une personne (par nom ou matricule) et **lui demander d'échanger nos adresses**.
4. Envoyer mon adresse à quelqu'un (WhatsApp, SMS, QR, lien de guidage temporaire).
5. Me rendre à une adresse de mon carnet (itinéraire Google Maps / OpenStreetMap).
6. Tout faire sans réseau, et retrouver mes données sur un nouveau téléphone.

### 1.4 KPI produit (à instrumenter dès la v1)

| KPI | Cible v1 |
|---|---|
| Temps médian pour créer une adresse complète (GPS + détails + azimut + photo) | < 4 min |
| % d'adresses avec précision ≤ 3 m | > 90 % |
| % d'adresses avec azimut renseigné | 100 % (champ bloquant) |
| % d'utilisateurs ayant au moins 1 échange d'adresse accepté à J+7 | > 30 % |
| % de données perdues par effacement de stockage | 0 % (identité + carnet restaurables) |
| Taux de demandes d'échange refusées/signalées | < 15 % (sinon revoir l'anti-abus) |

---

## 2. Périmètre : identique / nouveau / supprimé

### 2.1 🟢 Repris à l'identique depuis Census (comportement, textes, règles)

| Bloc | Détail |
|---|---|
| Assistant de création d'adresse | 5 étapes, seuils GPS, azimut obligatoire, photos, correction satellite, écran de vérification (§7) |
| Génération du code d'adresse | `DDD-SNNN-XNNN` (§8) |
| QR code + partage + import par scan | Écran QR, deep link, payload JSON auto-portant (§8.3) |
| Questionnaire Domicile | 17 questions + fiche par personne (7 questions) + lieux fréquentés (4 questions) — **texte intégral au §9.1** |
| Questionnaire Commerce | 8 questions — **texte intégral au §9.2** |
| Assistant d'enquête | 1 question par écran, validation par question, bouton « Retour » conservant les réponses, brouillon « Continuer plus tard », écran de résumé (§9.3) |
| Architecture offline-first | Carnet local → file d'attente → registre central, rejeu automatique, aucune perte (§5) |
| Stockage des photos | PhotoStore dédié (IndexedDB web / fichiers natifs), compression 640 px ~40-60 Ko (§5.4) |
| Comptes téléphone + PIN | OTP SMS, PIN 4 chiffres bcrypt, verrouillage 5 essais / 15 min, restauration multi-appareils (§6.2) |
| Identité invité liée à l'appareil | Identifiant + PIN générés, empreinte d'appareil, reprise après effacement du stockage, recherche par prénom (§6.3) |
| Carte | Leaflet dans WebView, fonds Plan + Satellite Esri Hybrid, pins, mini-carte sur les fiches (§12.7) |
| Cartes hors ligne | Téléchargement de tuiles par zone/rayon/zoom, reprise, suppression, affichage hors réseau (§12.8) |
| Répertoire & recherche | Catégories, recherche insensible casse/accents sur nom + matricule + code + quartier, tri A→Z / proximité / récents, pagination (§10) |
| Fiche d'adresse publique | Filtrage par confidentialité, bloc Localisation, repères d'accès, azimut, source du point de guidage, bouton « Se rendre à cette adresse » (Google Maps / OpenStreetMap / copier) (§10.4) |
| Import matricules & points de navigation | Import CSV opérateur avec détection automatique des colonnes et du séparateur, mode test à blanc (§15.3) |
| Exports | CSV/JSON local (mes données) + CSV opérateur (§15) |
| Bilingue FR/EN | 100 % des chaînes traduites, bascule instantanée dans Profil (§14) |
| Design system | Mêmes polices (DM Sans, JetBrains Mono), même grille 8 pt, mêmes composants — **palette changée en bleu ciel** (§3) |
| Stack technique | Expo SDK 54 / React Native 0.81 / expo-router / FastAPI / MongoDB (§4) |

### 2.2 🔵 Nouveau dans Home

| Bloc | Détail |
|---|---|
| **Mon carnet d'adresses** | Écran d'accueil = mes adresses + les adresses reçues par échange + les commerces ajoutés (§10.5) |
| **Échange d'adresses à consentement mutuel** | Demande → acceptation/refus → lien réciproque → révocation possible des deux côtés ; annulation d'une demande envoyée par erreur (§10.6) |
| **Ajout simple d'un commerce** | Un commerce se met dans son carnet sans demander la permission ; se retire à tout moment (§10.7) |
| **Matricule unique généré côté serveur** | Identifiant global unique et infalsifiable, clé de recherche et d'échange (§8.1) — corrige une dette majeure de Census |
| **Boîte de réception in-app** | Demandes reçues / envoyées, badge sur l'onglet, historique des échanges (§10.8) |
| **Anti-abus** | Blocage d'un utilisateur, plafond de demandes, signalement, aucune énumération possible du répertoire des domiciles (§10.9) |
| **Console opérateur allégée** | Statistiques produit (adresses, commerces, échanges), export CSV, import matricules — **sans supervision d'enquêteurs** (§15.2) |
| Propositions à fort impact | Code d'échange en face-à-face, lien de guidage temporaire, certificat d'adresse PDF, repère vocal, etc. (§17) |

### 2.3 🔴 Supprimé dans Home

Catégories Service public et Patrimoine · notion d'enquêteur et de productivité par agent · questionnaires Service public (9 Q) et Patrimoine (14 Q) · champs `is_public`, `is_heritage`, `public_service`, `heritage` · carte « communautaire » des services publics · colonnes CSV correspondantes · onglet de supervision des testeurs.

---

## 3. Identité visuelle — thème **bleu ciel**

Même système de design que Census (grille 8 pt, rayons, ombres, typographie), **palette recomposée autour du bleu ciel**. Le fichier ci-dessous est à créer tel quel : `frontend/src/theme/index.ts`. Aucune couleur ne doit être écrite en dur ailleurs dans l'application.

```ts
// AddressBook Home — Design System (palette bleu ciel)
export const Colors = {
  // Bleus (identité)
  primary: '#0E7FC1',        // bleu ciel profond — boutons, codes, actifs
  primaryDark: '#0A5A8A',    // états pressés, textes sur fond clair
  primaryLight: '#4FB3EE',   // illustrations, dégradés, pins
  primarySoft: '#E6F4FD',    // fonds de cartes, bandeaux informatifs
  // Accent chaud (CTA secondaires, « Se rendre à cette adresse »)
  accent: '#FF8A3D',
  accentLight: '#FFB784',
  accentSoft: '#FFF1E6',
  // États
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  gpsRed: '#DC2626',
  gpsYellow: '#D97706',
  gpsGreen: '#16A34A',
  // Neutres (légèrement bleutés)
  background: '#F6FAFD',
  card: '#FFFFFF',
  surface: '#EDF4FA',
  divider: '#DCE7F0',
  border: '#C9D9E6',
  textPrimary: '#0F1E2A',
  textSecondary: '#4A5C6B',
  textTertiary: '#8CA0B3',
  white: '#FFFFFF',
  // Pastilles
  pillRedBg: '#FEE2E2',
  pillYellowBg: '#FEF3C7',
  pillGreenBg: '#DCFCE7',
  pillBlueBg: '#E6F4FD',
};

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const Radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const Typography = {
  display:       { fontFamily: 'DMSans_700Bold',      fontSize: 32, lineHeight: 40, letterSpacing: -0.5, color: Colors.textPrimary },
  h1:            { fontFamily: 'DMSans_700Bold',      fontSize: 28, lineHeight: 36, letterSpacing: -0.3, color: Colors.textPrimary },
  h2:            { fontFamily: 'DMSans_700Bold',      fontSize: 22, lineHeight: 30, color: Colors.textPrimary },
  h3:            { fontFamily: 'DMSans_500Medium',    fontSize: 18, lineHeight: 26, color: Colors.textPrimary },
  body:          { fontFamily: 'DMSans_400Regular',   fontSize: 16, lineHeight: 24, color: Colors.textPrimary },
  bodySm:        { fontFamily: 'DMSans_400Regular',   fontSize: 14, lineHeight: 20, color: Colors.textSecondary },
  label:         { fontFamily: 'DMSans_500Medium',    fontSize: 14, lineHeight: 20, letterSpacing: 0.1, color: Colors.textPrimary },
  caption:       { fontFamily: 'DMSans_400Regular',   fontSize: 12, lineHeight: 16, color: Colors.textTertiary },
  addressCode:   { fontFamily: 'JetBrainsMono_700Bold', fontSize: 18, lineHeight: 24, letterSpacing: 1.2, color: Colors.primary },
  addressCodeLg: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 24, lineHeight: 32, letterSpacing: 1.5, color: Colors.primary },
};

export const Shadows = {
  card: { shadowColor: '#0F1E2A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  fab:  { shadowColor: '#0F1E2A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 6 },
};
```

**Polices** (identiques à Census) : `@expo-google-fonts/dm-sans` (400/500/700) et `@expo-google-fonts/jetbrains-mono` (700) chargées via **expo-font** au démarrage ; les codes d'adresse et les matricules sont **toujours** en JetBrains Mono avec `letterSpacing`.
**Iconographie :** `@expo/vector-icons` / Ionicons. Domicile = `home`, Commerce = `storefront`, Répertoire = `library`, Carnet = `bookmarks`, Scanner = `qr-code`, Carte = `map`, Profil = `person`.
**Splash / icône :** fond `#0E7FC1`.

**Règles UX non négociables :** cibles tactiles ≥ 44 px ; espacements multiples de 8 ; aucune position absolue pour le contenu principal ; `SafeAreaView` / `useSafeAreaInsets` partout ; feuilles modales (bottom sheets) pour les choix contextuels ; indicateurs de chargement pour toute opération asynchrone ; « pull-to-refresh » sur les listes ; états vides toujours illustrés et actionnables ; retour haptique (`expo-haptics`) sur les actions décisives (verrouillage de l'azimut, enregistrement, acceptation d'un échange).

---

## 4. Stack technique et arborescence

### 4.1 Stack (versions exactes de Census — ne pas rétrograder)

**Frontend** — Expo SDK `~54.0.35`, React Native `0.81.5`, React `19.1.0`, TypeScript `~5.9.3`, `expo-router ~6.0.24` (routage par fichiers), `react-native-webview 13.15.0` (carte Leaflet), `expo-location ~19.0.8`, `expo-camera ~17.0.10`, `expo-sensors ~15.0.8` (boussole), `expo-image-manipulator ~14.0.8` (compression photo), `expo-file-system ~19.0.23`, `@react-native-async-storage/async-storage 2.2.0`, `@react-native-community/netinfo 11.4.1`, `react-native-qrcode-svg`, `expo-clipboard`, `expo-sharing`, `expo-device`, `expo-application`, `expo-crypto`, `expo-document-picker`, `expo-haptics`, `react-native-safe-area-context`, `react-native-svg`. **Gestionnaire de paquets : yarn** (`yarn expo install <pkg>` uniquement).

**Backend** — FastAPI `0.110.1`, Uvicorn, Motor `3.3.1` (MongoDB async), Pydantic `>=2.6.4`, PyJWT, bcrypt `4.1.3`, python-dotenv, Twilio `9.10.9` (OTP SMS, activable par variables d'environnement), reportlab (PDF), pytest.

**Interdits** : `expo-av` (utiliser `expo-audio` / `expo-video`), `expo-barcode-scanner` (utiliser `expo-camera`), `react-router-dom`, MUI/Chakra/Ant, `tailwindcss`, `framer-motion`, tout paquet contenant « dom ». Aucun fichier CSS.

### 4.2 Arborescence cible

```
/app
├── backend/
│   ├── server.py                 # app FastAPI, modèles, adresses, enquêtes, auth, exports
│   ├── shared.py                 # db, JWT, helpers (normalisation accents, hash, PIN admin)
│   ├── routes/
│   │   ├── directory.py          # répertoire public + recherche + import matricules
│   │   ├── guest.py              # identité invité liée à l'appareil
│   │   ├── contacts.py           # 🔵 échange d'adresses, carnet, blocages
│   │   └── guidance.py           # 🔵 liens de guidage temporaires (si retenu)
│   ├── tests/                    # pytest — un fichier par domaine
│   ├── requirements.txt
│   └── .env                      # MONGO_URL, DB_NAME, JWT_SECRET, ADMIN_PIN, TWILIO_*
├── frontend/
│   ├── app/                      # ROUTES uniquement (expo-router)
│   │   ├── _layout.tsx           # polices, AppProvider, SafeArea, StatusBar
│   │   ├── index.tsx             # redirection : onboarding / tabs
│   │   ├── onboarding.tsx        # 3 écrans de présentation + choix de langue
│   │   ├── login.tsx             # compte téléphone + identité invité (tous les modes)
│   │   ├── new-address.tsx       # assistant 5 étapes
│   │   ├── survey/[id].tsx       # questionnaire Domicile / Commerce
│   │   ├── address/[id].tsx      # fiche de MON adresse (QR, carte, photos, actions)
│   │   ├── directory/
│   │   │   ├── list/[category].tsx   # registre + recherche
│   │   │   └── fiche/[id].tsx        # fiche publique + itinéraire + échange
│   │   ├── inbox.tsx             # 🔵 demandes reçues / envoyées
│   │   ├── offline-maps.tsx      # zones hors ligne
│   │   ├── import.tsx            # import d'une adresse partagée (deep link)
│   │   ├── admin.tsx             # console opérateur (PIN)
│   │   └── (tabs)/
│   │       ├── _layout.tsx       # 5 onglets
│   │       ├── index.tsx         # Mon carnet
│   │       ├── directory.tsx     # Répertoire (2 catégories)
│   │       ├── scan.tsx          # Scanner QR
│   │       ├── map.tsx           # Carte
│   │       └── profile.tsx       # Profil
│   └── src/                      # TOUT le reste (jamais dans /app)
│       ├── contexts/AppContext.tsx   # état global : données, file de sync, identité, langue
│       ├── services/
│       │   ├── api.ts            # client HTTP typé
│       │   ├── storage.ts        # AsyncStorage (clés, prefs, user, file d'attente)
│       │   ├── photoStore.ts     # photos hors AsyncStorage + compression
│       │   ├── offlineTiles.ts   # tuiles de carte hors ligne
│       │   └── device.ts         # empreinte d'appareil
│       ├── components/           # Button, Pill, AddressCard, LeafletMap, HoursField,
│       │                         # ProductsPicker, PersonsManager, RequestCard 🔵
│       ├── i18n/index.ts         # FR + EN (objet unique)
│       ├── theme/index.ts        # palette bleu ciel
│       ├── types/survey.ts       # types des questionnaires
│       └── utils/address.ts      # code d'adresse, QR, deep links, partage
└── memory/                       # PRD, identifiants de test, documents générés
```

### 4.3 Règles d'environnement (impératives)

- Toutes les routes backend sont préfixées par `/api` (l'ingress Kubernetes route `/api/*` vers le port 8001, le reste vers le port 3000).
- Le backend écoute sur `0.0.0.0:8001`. La base est atteinte **uniquement** via `MONGO_URL` (backend/.env).
- Le frontend appelle le backend **uniquement** via `process.env.EXPO_PUBLIC_BACKEND_URL` (+ `/api`). **Aucune URL ni port en dur nulle part.**
- Ne jamais modifier `EXPO_PACKAGER_PROXY_URL`, `EXPO_PACKAGER_HOSTNAME`, `MONGO_URL`, ni `metro.config.js`.
- `requirements.txt` : installer puis `pip freeze`. `package.json` : `yarn expo install` uniquement.

---

## 5. Architecture offline-first (le cœur du produit) — 🟢 identique à Census

### 5.1 Principe des deux étages

```
[Téléphone] --carnet local--> file d'attente --(Internet)--> [REGISTRE CENTRAL MongoDB]
```
1. Toute écriture (adresse, enquête, photo, échange) est **d'abord** enregistrée localement : instantané, fonctionne sans réseau.
2. Une **file d'attente de synchronisation** conserve ce qui n'a pas été transmis (deux files : adresses, enquêtes ; + une file pour les actions d'échange dans Home).
3. La file est vidée : à l'ouverture de l'application, au retour du réseau (écoute NetInfo), et sur le bouton « Synchroniser maintenant ».
4. Un envoi interrompu laisse les éléments dans la file → rejeu à la tentative suivante. **Aucune perte.**
5. Chaque élément porte un **uuid généré par le client** → la synchronisation est **idempotente** (un rejeu ne crée jamais de doublon).

### 5.2 Contrat de l'AppContext

`AppContext` est le seul point d'entrée pour écrire des données. **Aucun écran n'appelle l'API d'écriture directement.** Il expose : `addresses`, `surveys`, `contacts`, `requests`, `pendingCount`, `isOnline`, `lastSyncedAt`, `language`, `user`, `deviceId`, et les actions `saveAddress`, `updateAddress`, `deleteAddress`, `saveSurvey`, `syncNow`, `restoreAccount`, `setUser`, `setLanguage`, `requestExchange`, `respondExchange`, `revokeContact`.

### 5.3 États et messages réseau

Bandeau « Hors ligne — vos données sont enregistrées sur ce téléphone » sur l'accueil et la carte. Pastille « N en attente » dans Profil. Message d'erreur explicite si le stockage sature (`STORAGE_FULL`), jamais un plantage.

### 5.4 Photos — règle vitale apprise sur le terrain

Les photos ne vont **jamais** dans AsyncStorage/localStorage (Census a saturé le quota d'un navigateur en plein test terrain et bloqué une journée d'enquête).
- Compression **avant** stockage : largeur 640 px, qualité 0,4 → ~40-60 Ko en base64 (`expo-image-manipulator`).
- Stockage dans un **PhotoStore** dédié : IndexedDB sur le web, un fichier JSON par adresse via `expo-file-system` sur mobile.
- La file de synchronisation ne contient que des charges légères ; les photos sont réhydratées au moment de l'envoi et transmises par lots de 4.
- Jusqu'à **5 photos par adresse**, chacune avec `{base64, lat, lng, bearing, taken_at}`.

### 5.5 Restauration multi-appareils

Toute donnée synchronisée est rattachée à `owner_id`. Avec son identifiant + PIN (compte téléphone **ou** identité invité), l'utilisateur récupère sur un nouveau téléphone : ses adresses, ses enquêtes, ses photos, son carnet et ses échanges (`GET /api/restore`, jeton JWT 90 jours).

---

## 6. Identité & comptes

### 6.1 Principe

Home propose deux niveaux d'identité, **tous deux dotés d'un identifiant et d'un PIN** (pas d'utilisateur anonyme non récupérable) :

| Niveau | Identifiant | Récupération | Échange d'adresses |
|---|---|---|---|
| **Identité invité** (par défaut, sans SMS) | `HOME-G-XXXXXX` + PIN 4 chiffres généré | Prénom + identifiant + PIN, reconnaissance de l'appareil | ✅ autorisé |
| **Compte téléphone** (recommandé) | `HOME-XXXXXX` + numéro + PIN choisi | OTP SMS + PIN | ✅ autorisé |

L'invité est invité (bandeau non bloquant) à ajouter son téléphone pour sécuriser la récupération : `POST /api/guest/upgrade` conserve `owner_id`, donc **aucune donnée n'est perdue**.

### 6.2 🟢 Compte téléphone + PIN (identique à Census)

- `POST /api/auth/otp/request` — limite 3 demandes / 10 minutes par numéro ; code stocké **haché** (SHA-256) ; mode test `123456` si Twilio désactivé.
- `POST /api/auth/register` — nom + téléphone + PIN 4 chiffres + code OTP ; PIN haché **bcrypt** ; 409 si le numéro existe ; renvoie l'identifiant public `HOME-XXXXXX` (hachage stable du numéro) et un jeton JWT 90 jours.
- `POST /api/auth/login` — numéro **ou** identifiant + PIN ; **5 échecs → verrouillage 15 minutes** ; comparaison contre un hachage factice si le compte n'existe pas (anti-énumération).
- `GET /api/restore` — en-tête `Authorization: Bearer <jwt>` → renvoie tout le contenu du compte.
- La session locale **n'expire pas** (déconnexion manuelle uniquement) → un seul SMS par utilisateur, coût maîtrisé.

### 6.3 🟢 Identité invité liée à l'appareil (identique à Census, 10 cas d'usage)

**Empreinte d'appareil** (`src/services/device.ts`) : `SHA-256(identifiant d'installation Android/iOS ou signature navigateur + modèle + marque + OS)`. Elle est **volontairement indépendante d'AsyncStorage** pour survivre à un effacement du stockage. C'est un **indice**, jamais une preuve : le PIN reste obligatoire.

1. **Première utilisation** → écran « Première fois » / « J'ai déjà une identité ».
2. **Création** → prénom demandé → le serveur génère `HOME-G-XXXXXX` + un PIN 4 chiffres (les PIN triviaux `0000`, `1234`… sont exclus) → affichés **une seule fois**, copiables, avec rappel de les noter ; consultables ensuite dans Profil (PIN masqué, révélable).
3. **Retour, même appareil, session intacte** → reprise automatique, zéro friction.
4. **Retour, même appareil, stockage effacé** → carte « Cet appareil est déjà enregistré : Awa (HOME-G-••••C3) → Reprendre » puis PIN. Alternative « Ce n'est pas moi ».
5. **Nouvel appareil** → recherche par prénom (insensible à la casse **et aux accents** : « awa », « AWA », « Awá ») → liste de candidats avec **identifiants masqués**, date de dernière utilisation et nombre d'adresses → sélection → PIN → restauration.
6. **Aucun candidat** → bascule automatique vers la création.
7. **5 PIN erronés** → verrouillage 15 minutes (429).
8. **Plusieurs identités sur un appareil** → changement de compte, la dernière utilisée proposée en premier.
9. **Hors ligne** → identité provisoire locale (`prefs.pendingGuestName`) enregistrée automatiquement au retour du réseau, sans perdre le travail effectué entre-temps.
10. **Sécurité** : le prénom ne sert **qu'à retrouver** un compte, jamais à s'authentifier ; la liste de candidats ne renvoie que des identifiants masqués et une **référence opaque signée (JWT, 15 min)** ; l'authentification se fait toujours par PIN.

### 6.4 Gestion des permissions (contrat strict)

Pour **chaque** permission (localisation, caméra) : vérifier l'état existant → demander **uniquement après une intention claire** de l'utilisateur (appui sur « Mesurer la porte », « Prendre une photo », « Le plus proche ») → écran d'explication courte centrée sur le bénéfice **avant** la fenêtre système → gérer les 4 états (`granted`, `denied`, `undetermined`, bloqué définitivement) → respecter `canAskAgain` → si refus définitif, afficher un **bouton** « Ouvrir les réglages » (`Linking.openSettings()`), jamais un simple texte. Un refus **réduit** les capacités, il ne casse jamais l'application (ex. saisie manuelle de l'azimut si la boussole est refusée).

---

## 7. 🟢 Créer une adresse — assistant en 5 étapes (spécification exacte)

Écran : `app/new-address.tsx`. Barre de progression 1→5, bouton « Retour » à chaque étape conservant les saisies.

### Étape 1 — Mesurer la porte
- L'utilisateur se place **devant la porte d'entrée**, dehors.
- Suivi GPS continu : `Location.watchPositionAsync({ accuracy: BestForNavigation, timeInterval: 800, distanceInterval: 0 })` (web : `navigator.geolocation.watchPosition` avec `enableHighAccuracy`, `maximumAge: 0`, `timeout: 30000`).
- Affichage temps réel : précision en mètres, gros cercle coloré et pastille de qualité :
  - ≤ **1,0 m** → vert « ✓ Excellent » (le suivi s'arrête automatiquement sur le web)
  - ≤ **3,0 m** → jaune « Acceptable »
  - \> 3,0 m → rouge « Verrouillage… »
- **Le bouton « Confirmer » n'est actif qu'à partir d'une précision ≤ 3,0 m.**
- **Échappatoire terrain** : après **120 secondes** sans atteindre 3 m, un bouton « Enregistrer quand même » apparaît → l'adresse est enregistrée avec l'indicateur `low_accuracy: true` (et reste signalée comme telle dans les exports).
- Stocke `latitude`, `longitude`, `accuracy_meters` (2 décimales) et conserve la mesure brute dans `lat_raw` / `lng_raw`.

### Étape 2 — Détails
| Champ | Type | Obligatoire |
|---|---|---|
| Quartier | texte, détection automatique si Internet (géocodage inverse), sinon saisie | ✅ |
| Secteur | 1-2 lettres | ✅ |
| Rue (numéro) | nombre | ✅ |
| Maison (numéro) | nombre | ✅ |
| Nom du contact / du foyer | texte | optionnel |
| Téléphone | texte | optionnel |
| Notes / repères d'accès (ex. « 2e étage, porte bleue ») | texte | optionnel |

Le code d'adresse se construit en direct sous les champs (§8.2).

### Étape 3 — Direction & Photo
- **Azimut de l'entrée — OBLIGATOIRE, impossible de continuer sans.**
  - Consigne affichée : « Placez-vous **dehors**, face à l'entrée, téléphone **à plat à hauteur de poitrine**, le **haut du téléphone vers la porte**. »
  - Boussole : `Location.watchHeadingAsync` (fusion de capteurs, fonctionne téléphone à la verticale) avec repli sur le magnétomètre `expo-sensors` ; bouton « Verrouiller la direction ».
  - Mode « viser à la caméra » : on pointe la caméra vers l'entrée, le cap s'affiche en surimpression, la capture **verrouille l'azimut et enregistre la photo**.
  - **Repli manuel obligatoire** (boussole absente/refusée/web) : 8 pastilles N (0°), NE (45°), E (90°), SE (135°), S (180°), SO (225°), O (270°), NO (315°).
- **Photos (jusqu'à 5, optionnelles mais fortement encouragées)** : caméra en modale ; chaque photo enregistre automatiquement sa position GPS et le cap de la caméra ; suppression avec confirmation ; compression systématique (§5.4).

### Étape 4 — Correction satellite (optionnelle)
Carte plein écran, fond **Esri Hybrid** (imagerie + routes + libellés). Pin **bleu** = GPS mesuré (fixe, pour comparaison), pin **orange déplaçable** = position corrigée, trait pointillé entre les deux. Boutons : « Enregistrer et continuer » (apparaît après déplacement) ou « Continuer sans corriger ». Les deux jeux de coordonnées sont conservés (`lat_raw/lng_raw` **et** `lat_corrected/lng_corrected`).

### Étape 5 — Vérifier & enregistrer
Récapitulatif : code d'adresse, matricule attribué, coordonnées retenues, précision, contact, azimut, nombre de photos. Bouton « Enregistrer l'adresse » → écriture locale immédiate + mise en file → **écran QR** avec, en appel à l'action principal : « **Remplir le questionnaire maintenant** » (dans Census, 45 % des adresses n'avaient pas d'enquête faute de cette relance).

---

## 8. Identifiants : matricule, code lisible, QR

### 8.1 🔵 Matricule unique (nouveauté Home — corrige une dette de Census)

**Problème constaté dans Census :** le code d'adresse est calculé depuis quartier + secteur + rue + maison **saisis à la main**. Deux personnes travaillant le même quartier produisent le même code pour deux bâtiments différents. Mesure réelle sur la base de production : **2 148 adresses pour seulement 1 166 codes distincts ; 363 codes partagés par 2 à 8 bâtiments différents, distants de 49 m à 1 247 m ; 63 % des bâtiments concernés.**

**Décision pour Home :** chaque adresse reçoit, **à l'enregistrement côté serveur**, un `matricule` **globalement unique et immuable** :
- Format : `HM-XXXX-XXXX` (8 caractères en base32 de Crockford, sans `I`, `L`, `O`, `U` pour éviter toute confusion à l'oral et à la saisie).
- Unicité garantie par index **unique** MongoDB + tirage aléatoire cryptographique et nouvelle tentative en cas de collision.
- C'est **le** identifiant de recherche, d'échange et de partage. Il est affiché en grand sur la fiche, copiable, lisible au téléphone (« H-M tiret 7 F 3 K… »).
- Le matricule est aussi la clé acceptée par l'import CSV du partenaire cartographe (un matricule officiel externe peut être stocké en parallèle dans `matricule_official`).

### 8.2 🟢 Code d'adresse lisible (conservé, mais secondaire)

`districtCode(3 lettres) - secteur(1-2 lettres) + rue(3 chiffres) - X + maison(3 chiffres)` → ex. `BNA-L019-X007`.
Table de correspondance des quartiers connus, sinon les 3 premières lettres en majuscules ; les numéros sont complétés à 3 chiffres.
🔵 **Garde-fou anti-collision (nouveau) :** à l'enregistrement, si le code existe déjà **à plus de 40 m** de la nouvelle position, l'application avertit (« Ce code est déjà utilisé pour un autre bâtiment à 320 m ») et propose le **prochain numéro de maison libre**. Le code reste un libellé humain ; l'identité technique, c'est le matricule.

### 8.3 🟢 QR code et partage

- QR généré avec `react-native-qrcode-svg`, **payload JSON auto-portant** : `{v, mat, aid, d, s, st, h, lt, lg, n}` → un scan fonctionne **sans aucune connexion** (l'appareil qui scanne reconstruit la fiche localement).
- Deep link : `homeaddress://import?mat=HM-XXXX-XXXX` + lien web de secours `<BACKEND_URL>/import?mat=…`.
- Message de partage prêt à coller (WhatsApp/SMS), bilingue, contenant le nom, le matricule et le lien d'itinéraire.
- 🔵 « Carte d'adresse » exportable en image (PNG) : matricule, QR, nom, quartier, photo de la façade — à imprimer et coller sur le portail.

---

## 9. Questionnaires — texte intégral (🟢 repris mot pour mot de Census)

**Règles transverses (§9.3) applicables aux deux questionnaires.** L'écran de choix du type ne propose plus que **deux** cartes :
- 🏠 **Domicile (maison d'habitation)** — *données privées, visibles par vous seul, et par les personnes avec qui vous échangez votre adresse.*
- 🏪 **Commerce / entreprise** — *données publiques, visibles dans le Répertoire par toute la communauté.*

### 9.1 Questionnaire **DOMICILE** — 17 questions, une par écran

| # | Question | Type de réponse | Obligatoire | Règles |
|---|---|---|---|---|
| 1 | Nom de la famille / du foyer | Texte libre (ex. « Famille Kamdem ») | ✅ | |
| 2 | Combien de personnes vivent dans ce foyer ? | Nombre (− / +, minimum 1) | ✅ | Le nombre déclaré devra correspondre **exactement** au nombre de fiches personnes enregistrées à la fin (blocage sinon) |
| 3 | Quelle est la principale source de revenus du foyer ? | Texte libre (ex. Commerce, Agriculture) | ✅ | |
| 4 | Autres sources de revenus | Texte libre | — | |
| 5 | Niveau de revenus du foyer | Choix unique | ✅ | **Très faible** : revenus irréguliers, moins de 50 000 FCFA/mois, besoins de base difficiles à couvrir · **Faible** : 50 000 à 150 000 FCFA/mois, besoins couverts, peu ou pas d'épargne · **Moyen** : 150 000 à 500 000 FCFA/mois, vie confortable, épargne possible · **Élevé** : plus de 500 000 FCFA/mois, ménage aisé |
| 6 | Combien de téléphones dans le foyer ? | Nombre (− / +) | ✅ | |
| 7 | Avez-vous accès à internet à la maison ? | Oui / Non | ✅ | |
| 8 | Comment est l'électricité dans la maison ? | Choix unique : Stable · Instable · Aucun | ✅ | |
| 9 | Y a-t-il accès à l'eau courante à l'intérieur du logement ? | Choix unique : Stable · Instable · Aucun | ✅ | |
| 10 | Quel type de toilettes avez-vous ? | Choix unique : Chasse d'eau · Traditionnel · Autre | ✅ | Si « Autre » → sous-question **obligatoire** « Précisez le type de toilettes » |
| 11 | Où est située la cuisine ? | Choix unique : Dans une pièce séparée · Dans le salon · Bâtiment séparé | ✅ | Consigne affichée : une cuisine physiquement séparée du bâtiment principal est **un bâtiment à part** → créez-lui sa propre adresse |
| 12 | Combien de pièces compte le logement (hors cuisine et salle de bain) ? | Nombre (minimum 1) | ✅ | Consigne : inclure les chambres, le salon et toute pièce habitable |
| 13 | Combien d'étages a le bâtiment ? | Nombre (minimum 1) | ✅ | |
| 14 | Matériaux des murs | Choix unique : Parpaing · Adobe · Bois · Autre | ✅ | Si « Autre » → sous-question **obligatoire** « Précisez le matériau des murs » |
| 15 | Y a-t-il des fenêtres vitrées ? | Oui / Non | ✅ | |
| 16 | Matériaux de la toiture | Choix unique : Tôle · Bois · Plastique · Parpaing (béton) · Autre | ✅ | Si « Autre » → sous-question **obligatoire** « Précisez le matériau de la toiture » |
| 17 | Combien de véhicules possède le foyer ? | 4 compteurs (− / +) : Bicyclettes · Motos · Voitures · Camions | ✅ | |

**Écran de transition :** « Renseignez les informations de chaque personne du foyer. »

#### Fiche par personne — posée autant de fois qu'il y a de personnes déclarées
Bandeau compteur « **X enregistrée(s) sur Y** » avec ajustement − / + en ligne ; bouton « Terminer » **bloqué** tant que le compte n'est pas atteint (dans Census, 69 % des enquêtes présentaient une incohérence avant cette règle).

| # | Question | Type | Obligatoire |
|---|---|---|---|
| 1 | Nom complet | Texte | ✅ |
| 2 | Téléphone ou email | Texte | — |
| 3 | Âge | Nombre (0 à 120) | ✅ |
| 4 | Genre | Masculin · Féminin | ✅ |
| 5 | Niveau d'études | École primaire · Collège · Lycée · Université · Aucune scolarisation | ✅ |
| 6 | Profession | Texte | — |
| 7 | Cette personne ne se déplace pas (bébé, personne âgée, malade…) | Case à cocher | — → si cochée, les lieux fréquentés ne sont pas demandés |

#### Lieux fréquentés — pour chaque personne (sauf « ne se déplace pas »)
**Au moins 1 lieu obligatoire** (blocage sinon). Recommandation affichée : **3 à 4 lieux** — 1-2 boutiques, le travail ou l'école, 1-2 lieux de loisirs/communauté (église, bar, espace communautaire), 1-2 amis. Pour chaque lieu :

| # | Question | Type | Obligatoire |
|---|---|---|---|
| 1 | Type de lieu | Boutique · Travail · École · Loisir / communauté · Ami / famille | ✅ |
| 2 | Nom du lieu / de la personne | Texte | ✅ |
| 3 | Fréquence | Tous les jours · Chaque semaine · Chaque mois · Rarement | ✅ |
| 4 | Pourquoi ? | Texte libre | — |

**Fin :** écran « Résumé de l'enquête » (personnes, logement, services) → bouton « Enregistrer l'enquête ».

> 🔵 **Adaptation de ton pour Home** : les intitulés passent de la 3ᵉ personne (enquêteur) à la 1ʳᵉ personne (propriétaire). Exemple : « Combien de personnes vivent dans ce foyer ? » → conservé ; « Nom de la famille / du foyer » → conservé ; les consignes destinées à l'enquêteur (« l'enquêteur se place devant la porte ») deviennent « placez-vous devant votre porte ». **Aucune question n'est supprimée ni ajoutée.**

### 9.2 Questionnaire **COMMERCE / ENTREPRISE** — 8 questions

| # | Question | Type | Obligatoire |
|---|---|---|---|
| 1 | Nom du commerce | Texte | ✅ |
| 2 | Nom du propriétaire | Texte | — |
| 3 | Téléphone du commerce | Texte (clavier téléphone) | — |
| 4 | Produits / activités | **Choix multiples + ajout libre**, au moins 1 | ✅ |
| 5 | Nombre de travailleurs (patron inclus) | Nombre (− / +, minimum 1) | ✅ |
| 6 | Horaires lundi-vendredi | Ouvert (heure début + heure fin) **ou** Fermé | ✅ |
| 7 | Horaires samedi | Ouvert (heures) ou Fermé | — |
| 8 | Horaires dimanche | Ouvert (heures) ou Fermé | — |

**Liste des 21 produits prédéfinis (multi-sélection, FR/EN) :** Alimentation générale · Boissons · Pain & pâtisserie · Fruits & légumes · Viande & poisson · Restauration / plats cuisinés · Produits ménagers · Cosmétiques & beauté · Coiffure · Vêtements & chaussures · Tissus & couture · Téléphones & accessoires · Crédit téléphonique & Mobile Money · Électronique · Pièces détachées · Quincaillerie · Matériaux de construction · Gaz domestique · Médicaments / pharmacie · Papeterie & scolaire · Meubles — **+ champ « Autre produit ou activité… »** pour un ajout libre. Stockage : chaîne séparée par des virgules.

**Composant horaires (`HoursField`) :** bascule Ouvert/Fermé + sélecteur heure/minute en modale ; format stocké `"HH:MM-HH:MM"` ou `"closed"` ; une heure de fermeture antérieure à l'ouverture est **impossible** à saisir.

**Fin :** écran « Résumé » (fiche Commerce) → « Enregistrer l'enquête ».

### 9.3 🟢 Règles transverses de l'assistant d'enquête

1. **Une question par écran**, grand titre, aide contextuelle courte, validation **avant** de pouvoir avancer.
2. **Aucune valeur par défaut** sur les choix multiples : un champ non répondu vaut `''` / `null` (impossible d'enregistrer une réponse « par défaut » non vue par l'utilisateur).
3. **« Autre » impose toujours une précision** en texte libre obligatoire.
4. Bouton « **Retour** » en pied d'écran : revient à la question précédente **en conservant** toutes les réponses.
5. Bouton « **Continuer plus tard** » : enregistre un **brouillon** local ; à la reprise, bandeau « ↩️ Reprise de votre brouillon » et retour exact à la question quittée ; le brouillon est effacé à l'enregistrement final.
6. **Écran de résumé** avant enregistrement, éditable (retour direct à une question).
7. L'enquête est rattachée à l'adresse par `address_id` + `owner_id` ; l'adresse passe à `has_survey: true`.
8. Le questionnaire est **modifiable** après enregistrement (mise à jour locale + file de synchronisation).

---

## 10. 🔵 Registre, Carnet et Échange d'adresses — le cœur de Home

### 10.1 Vocabulaire

- **Répertoire** = le registre central, consultable, contenant les fiches enregistrées dans Home.
- **Mon carnet** = ce que *je* possède ou ce qui m'a été donné : mes adresses + les adresses reçues par échange + les commerces que j'ai ajoutés.
- **Échange d'adresses** = mise en relation **réciproque et consentie** entre deux domiciles.

### 10.2 Écran Répertoire (2 catégories)

Onglet « Répertoire » → deux cartes avec compteurs en temps réel :
- 🏠 **Domiciles** — « Trouvez une personne et demandez l'échange de vos adresses »
- 🏪 **Commerces** — « Trouvez une boutique et ajoutez-la à votre carnet »

Bandeau d'en-tête : « N fiches au total dans le registre central ».

### 10.3 Écran liste + recherche (🟢 moteur identique à Census)

- Barre de recherche unique, résultats **serveur** avec anti-rebond 350 ms.
- La recherche porte sur : **nom d'enregistrement** (nom de famille / nom du commerce), **matricule**, **code d'adresse**, **quartier**, **secteur**, **numéro de maison**. **Insensible à la casse et aux accents**, multi-mots (tous les mots doivent correspondre).
- Tris : **A → Z** · **Le plus proche de moi** (permission GPS contextuelle, distance affichée en m/km) · **Récents**.
- Pagination 40 éléments, chargement à l'approche du bas de liste.
- Chaque ligne : nom, matricule (police monospace), code, quartier • secteur • n°, pastille « position vérifiée » le cas échéant, distance si tri par proximité.
- États : chargement, vide (« Aucun résultat » + conseil), hors ligne (« Connexion requise pour consulter le registre central » + bouton Réessayer). Les fiches **déjà dans mon carnet** sont consultables hors ligne.
- **Confidentialité de la recherche des domiciles :** la liste des domiciles n'est **pas navigable à vide**. Tant qu'aucune recherche n'est saisie (minimum 3 caractères), l'écran affiche un message pédagogique (« Saisissez un nom ou un matricule pour trouver quelqu'un ») et **aucun résultat**. On ne peut donc pas « feuilleter » les domiciles du pays. Les commerces, eux, sont librement navigables.

### 10.4 Fiche publique d'une adresse (🟢 modèle Census, contenu adapté)

**Fiche DOMICILE — vue par un tiers qui n'a PAS échangé avec moi (résultat de recherche) :**
nom de famille · matricule · quartier · **rien d'autre**. Un bouton unique : « **Demander l'échange de nos adresses** ». Ni coordonnées GPS, ni photo, ni itinéraire, ni téléphone, ni numéro de maison.

**Fiche DOMICILE — vue par un tiers AVEC qui j'ai échangé :**
nom de famille · matricule · code d'adresse · quartier / secteur / rue / n° · **repères d'accès** · **orientation de l'entrée** (ex. « 135° Sud-Est ») · **photo de la façade** · mini-carte · **« Se rendre à cette adresse »** · téléphone **si** le propriétaire a coché « partager mon téléphone avec mes contacts ».
🔒 **Jamais** : nombre d'habitants, fiches personnes, revenus, matériaux, équipements, lieux fréquentés. Les réponses du questionnaire Domicile **ne sortent jamais** de l'appareil du propriétaire et de l'export opérateur.

**Fiche COMMERCE — vue par tous :**
nom · matricule · code · quartier/secteur/rue/n° · produits & services · horaires (avec pastille « **Ouvert maintenant** » calculée) · téléphone (bouton **Appeler**) · photo · mini-carte · **« Se rendre à cette adresse »** · bouton « **Ajouter à mon carnet** » / « Retirer de mon carnet ».

**Bouton « Se rendre à cette adresse »** (🟢 identique) : feuille modale avec **Itinéraire Google Maps** (`https://www.google.com/maps/dir/?api=1&destination=lat,lng&travelmode=driving`), **Itinéraire OpenStreetMap** (`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3Blat%2Clng`) et **Copier les coordonnées**. Le point utilisé suit une **priorité explicite, affichée à l'utilisateur** : `point de porte vérifié (import cartographie)` > `position corrigée par satellite` > `position GPS mesurée à la porte`.

### 10.5 Écran d'accueil = « Mon carnet »

Trois sections, dans cet ordre :
1. **Mes adresses** (mon domicile, mon/mes commerces) — carte par adresse avec code, matricule, pastille « Questionnaire à remplir » si `has_survey = false`, actions (voir, QR, modifier, supprimer).
2. **Adresses reçues** (échanges acceptés) — nom, quartier, bouton « Y aller », bouton « Retirer » (avec confirmation : « Vous serez retiré(e) du carnet de X également »).
3. **Commerces enregistrés** — logo/photo, nom, « Ouvert maintenant », « Y aller », « Retirer ».
Bandeau supérieur : recherche locale dans mon carnet · badge des demandes en attente (ouvre la Boîte de réception) · bandeau hors ligne le cas échéant. Bouton flottant « **+ Nouvelle adresse** ».

### 10.6 Échange d'adresses entre domiciles — machine à états

```
        (A recherche B, appuie sur « Demander l'échange »)
                              │
                              ▼
                        [ EN ATTENTE ] ──(A annule)──────────► [ ANNULÉE ]
                         │           │
              (B refuse) │           │ (B accepte)
                         ▼           ▼
                   [ REFUSÉE ]   [ ACCEPTÉE ] ──(A ou B retire)──► [ RETIRÉE ]
                         │
                  (B bloque A) ──► [ BLOQUÉE ] (A ne peut plus redemander)
```

**Règles fonctionnelles :**
1. Une demande porte sur **un couple de domiciles** : l'adresse de A et celle de B. A doit donc posséder au moins un domicile enregistré (sinon message : « Enregistrez d'abord votre domicile pour pouvoir échanger »).
2. La demande peut contenir un **message court optionnel** (140 caractères, ex. « Salut, c'est Awa du marché »), utile pour que B reconnaisse A.
3. **Tant que B n'a pas accepté, A ne voit rien de plus** que ce qu'il voyait dans la recherche. Aucune fuite d'information par la demande.
4. B reçoit la demande dans sa **Boîte de réception** (badge sur l'onglet) : nom de A, quartier de A, message, date. B peut **Accepter**, **Refuser**, **Bloquer**.
5. **À l'acceptation** : lien réciproque créé ; la fiche de A apparaît dans le carnet de B **et** celle de B dans le carnet de A ; notification in-app aux deux.
6. **Refus** : A est informé sobrement (« X n'a pas accepté votre demande ») ; A peut redemander **une seule fois** après 30 jours.
7. **Annulation** : A peut retirer sa demande tant qu'elle est en attente (cas explicite : « demande envoyée à la mauvaise personne »). La demande disparaît des deux côtés.
8. **Retrait après acceptation** : chacun peut retirer le lien à tout moment ; **le retrait est réciproque** (la fiche disparaît des deux carnets) et silencieux (pas de notification humiliante : simple disparition).
9. **Blocage** : B ne reçoit plus jamais de demande de A ; A ne retrouve plus la fiche de B dans ses recherches.
10. **Hors ligne** : les actions (demander, accepter, refuser, annuler, retirer) sont mises en **file d'attente** et rejouées au retour du réseau ; l'interface affiche l'état « en attente d'envoi ».
11. **Idempotence** : chaque action porte un uuid client ; un rejeu ne duplique jamais un lien.
12. **Cas limites gérés** : demande en double (message « demande déjà envoyée ») · demande à soi-même (interdite) · B supprime son domicile (les liens correspondants sont retirés proprement) · B possède 2 domiciles (il choisit lequel il partage à l'acceptation) · A et B s'envoient une demande croisée simultanément (auto-appariement : acceptation automatique et notification « Vous vous êtes échangé vos adresses ») · compte invité (autorisé, avec rappel d'ajouter un téléphone) · destinataire jamais reconnecté (la demande reste en attente, A peut annuler).

### 10.7 Commerces : ajout direct, sans consentement

Un commerce est **public par nature** (c'est son intérêt : être trouvé). Bouton « Ajouter à mon carnet » → ajout immédiat, aucune demande. Le commerçant voit, dans **ses statistiques**, le nombre de personnes qui ont enregistré sa boutique (compteur agrégé, **jamais** la liste nominative) et le nombre d'ouvertures d'itinéraire — une donnée de valeur pour lui.

### 10.8 Boîte de réception (`app/inbox.tsx`)

Deux onglets : **Reçues** (avec actions) et **Envoyées** (avec annulation). Chaque carte : avatar à initiales, nom, quartier, matricule masqué (`HM-7F3•-••K2`) jusqu'à acceptation, message, ancienneté (« il y a 2 h »), état (en attente / acceptée / refusée / annulée). Badge numérique sur l'onglet Répertoire tant qu'il reste des demandes reçues non traitées. Rafraîchissement au focus de l'écran + « pull-to-refresh ».

### 10.9 Anti-abus et sécurité (obligatoire)

- **Plafond** : 20 demandes envoyées par 24 h et par compte (429 au-delà, message explicite).
- **Recherche de domiciles** : minimum 3 caractères, maximum 20 résultats, matricules partiellement masqués, **aucune coordonnée** dans la réponse d'API tant qu'il n'y a pas d'échange accepté (le filtrage est fait **côté serveur**, jamais côté client).
- **Blocage et signalement** : `POST /api/blocks`, `POST /api/reports` (motif) ; un compte signalé 3 fois est marqué pour revue opérateur.
- **Journal de transparence** (🔵 proposition §17-P15) : « Qui a consulté mon adresse » — liste horodatée des consultations de ma fiche par mes contacts.
- Aucune réponse d'API ne révèle l'existence d'un compte non trouvé autrement que par un message neutre ; le PIN est toujours vérifié contre un hachage (factice si compte inexistant).

---

## 11. Matrice de visibilité Home (référence unique)

| Donnée | Propriétaire | Contact (échange accepté) | Tout utilisateur | Opérateur (console PIN) |
|---|---|---|---|---|
| Nom de famille / nom du commerce | ✅ | ✅ | ✅ (recherche) | ✅ |
| Matricule | ✅ | ✅ | ✅ (masqué avant échange pour un domicile) | ✅ |
| Quartier | ✅ | ✅ | ✅ | ✅ |
| Code d'adresse, rue, n° de maison | ✅ | ✅ | 🏪 commerce uniquement | ✅ |
| Coordonnées GPS, itinéraire, photo, azimut, repères | ✅ | ✅ | 🏪 commerce uniquement | ✅ |
| Téléphone | ✅ | ✅ si partage activé | 🏪 commerce uniquement | ✅ |
| Réponses du questionnaire Domicile (personnes, revenus, matériaux, lieux…) | ✅ | ❌ **jamais** | ❌ **jamais** | ✅ (export) |
| Produits, horaires du commerce | ✅ | ✅ | ✅ | ✅ |

---

## 12. Inventaire des écrans (route par route)

| Route | Écran | Contenu | 🟢/🔵 |
|---|---|---|---|
| `/` | Redirection | Onboarding vu ? → `/(tabs)` sinon `/onboarding` | 🟢 |
| `/onboarding` | 3 diapositives | « Votre adresse précise », « Partagez-la en toute confiance », « Fonctionne sans réseau » + choix de langue + « Passer » | 🟢 |
| `/login` | Identité | Modes : choix · inscription téléphone · OTP · succès · connexion · invité (choix / création / identifiants affichés / recherche par prénom / PIN) | 🟢 |
| `/(tabs)/index` | **Mon carnet** | Mes adresses · Adresses reçues · Commerces enregistrés · recherche locale · badge demandes · bouton + | 🔵 |
| `/(tabs)/directory` | Répertoire | 2 catégories + compteurs + total | 🔵 |
| `/directory/list/[category]` | Liste & recherche | Recherche, tris, pagination, états | 🟢 |
| `/directory/fiche/[id]` | Fiche publique | Selon la matrice §11 + itinéraire + demande d'échange / ajout au carnet | 🔵 |
| `/inbox` | Boîte de réception | Demandes reçues / envoyées | 🔵 |
| `/new-address` | Assistant 5 étapes | §7 | 🟢 |
| `/survey/[id]` | Questionnaire | Domicile ou Commerce, §9 | 🟢 |
| `/address/[id]` | Ma fiche | QR, matricule, carte, photos, azimut, actions, partage, « Remplir le questionnaire » | 🟢 |
| `/(tabs)/scan` | Scanner | Caméra QR + lampe + import ; permission contextuelle ; fiche importée en local | 🟢 |
| `/(tabs)/map` | Carte | Leaflet, fonds Plan/Satellite, mes adresses + commerces publics (bascule), bouton Cartes hors ligne, bandeau hors ligne | 🟢 |
| `/offline-maps` | Cartes hors ligne | Villes prédéfinies + « Ma position », rayon 2/5/10 km, zooms 12-17, estimation de taille, progression, annulation, reprise, suppression, total occupé | 🟢 |
| `/import` | Import d'une adresse | Ouverture d'un lien/QR partagé → aperçu → « Ajouter à mon carnet » | 🟢 |
| `/(tabs)/profile` | Profil | Identité (nom, identifiant, PIN invité révélable) · langue FR/EN · synchronisation (état, en attente, bouton) · confidentialité (partager mon téléphone, qui a consulté mon adresse) · export CSV/JSON · à propos · connexion/déconnexion · accès console opérateur | 🟢+🔵 |
| `/admin` | Console opérateur | PIN · statistiques produit · recherche d'une fiche · export CSV · import matricules | 🔵 allégé |

---

## 13. Modèle de données et API

### 13.1 Collections MongoDB

**`addresses`** (🟢 + 🔵 `matricule`, `kind`)
```
id (uuid client, unique)         matricule (HM-XXXX-XXXX, UNIQUE)     matricule_official (import)
address_id (code lisible)        kind: 'home' | 'business'            owner_id  owner_display_name
district  sector  street_id  house_number
latitude  longitude  accuracy_meters  low_accuracy
lat_raw  lng_raw  lat_corrected  lng_corrected  nav_lat  nav_lng  nav_note
azimuth_degrees                  photos: [{base64, lat, lng, bearing, taken_at}]  photos_count
contact_name  contact_phone  share_phone (bool)  notes
has_survey  verified  flag_count  created_at  updated_at
```
Index : `matricule` (unique), `owner_id`, `kind`, `address_id`, `district`, index texte sur le nom.

**`surveys`** — `{ id, address_id, owner_id, survey_type: 'home'|'business', … }`
- Champs `home` (🟢 identiques à Census) : `family_name, total_persons, main_income_source, other_income_sources, income_level (very_low|low|medium|high), num_phones, has_internet, electricity (stable|unstable|none), water (idem), toilets (flush|traditional|other) + toilets_other, kitchen_position (room|living_room|separate), num_living_rooms, num_floors, wall_materials (concrete|adobe|wood|other) + wall_materials_other, has_glass_windows, roof_materials (metal|wood|plastic|concrete|other) + roof_materials_other, vehicles_bicycles, vehicles_motorcycles, vehicles_cars, vehicles_trucks, persons[]`
- `persons[]` : `{ id, name, phone_or_email, age, gender (male|female), education (primary|middle|high_school|university|none), profession, no_places, places[] }`
- `places[]` : `{ category (shop|work|school|leisure|friend), name, frequency (daily|weekly|monthly|rarely), reason }`
- Champs `business` : `{ name, owner, phone, products (csv), workers, hours_weekdays, hours_saturday, hours_sunday }`
- **Convention obligatoire** : un choix non répondu vaut `''` (ou `null` pour les booléens). Jamais de valeur par défaut implicite.

**`users`** — `{ user_id, kind: 'phone'|'guest', public_id (HOME-XXXXXX | HOME-G-XXXXXX), name, name_norm, phone, pin_hash (bcrypt), failed_pin_attempts, locked_until, devices: [{hash, label, first_seen, last_seen}], created_at, last_login }`

**🔵 `contact_requests`** — `{ id, from_user_id, from_address_id, to_user_id, to_address_id, message, status: 'pending'|'accepted'|'declined'|'cancelled'|'revoked', created_at, responded_at }`
**🔵 `contacts`** — `{ id, user_id, address_id, linked_user_id, source: 'exchange'|'business'|'qr', created_at }` (deux documents symétriques pour un échange)
**🔵 `blocks`** — `{ user_id, blocked_user_id, created_at }` · **🔵 `reports`** — `{ reporter_id, target_user_id, reason, created_at }`
**🔵 `pairing_codes`** (si §17-P2 retenu) — `{ code (6 chiffres), user_id, address_id, expires_at }` TTL 10 min
**🔵 `guidance_links`** (si §17-P3 retenu) — `{ token, address_id, owner_id, expires_at, opened_count }`
`otp_codes`, `otp_attempts` (🟢 hachés, limitation de débit)

### 13.2 API — endpoints

**Adresses & enquêtes (🟢)**
```
POST   /api/addresses                 création (retourne le matricule attribué)
GET    /api/addresses?owner_id=&q=    mes adresses
GET    /api/addresses/{matricule}     fiche (filtrée selon le demandeur)
PUT    /api/addresses/{matricule}     modification (propriétaire uniquement)
DELETE /api/addresses/{matricule}     suppression (propriétaire uniquement)
POST   /api/sync                      envoi par lot (idempotent sur id)
POST   /api/surveys                   création / mise à jour d'une enquête
GET    /api/surveys/{address_id}?owner_id=
DELETE /api/surveys/{address_id}
GET    /api/addresses-nearby?lat=&lng=&radius_km=
POST   /api/verify                    vérification communautaire d'une position
```
**Identité (🟢)** — `POST /api/auth/otp/request` · `POST /api/auth/otp/verify` · `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/restore` · `POST /api/guest/register` · `POST /api/guest/device-check` · `POST /api/guest/lookup` · `POST /api/guest/login` · 🔵 `POST /api/guest/upgrade`

**Répertoire (🟢)** — `GET /api/directory/summary` · `GET /api/directory/entries?category=home|business&q=&sort=name|near|recent&limit=&offset=&lat=&lng=` · `GET /api/directory/entry/{key}`
*Règles serveur : la catégorie `home` exige `q` d'au moins 3 caractères et ne renvoie **jamais** de coordonnées si l'appelant n'a pas de lien accepté ; index en cache mémoire 10 s ; recherche normalisée (minuscules, accents supprimés).*

**🔵 Échange & carnet**
```
POST   /api/contacts/requests                 { to_matricule, from_address_id, message }
GET    /api/contacts/requests?direction=in|out
POST   /api/contacts/requests/{id}/accept     { my_address_id }
POST   /api/contacts/requests/{id}/decline
POST   /api/contacts/requests/{id}/cancel
GET    /api/contacts                          mon carnet (adresses reçues + commerces)
DELETE /api/contacts/{id}                     retrait réciproque
POST   /api/contacts/business/{matricule}     ajout d'un commerce
DELETE /api/contacts/business/{matricule}
POST   /api/blocks     { user_id }            POST /api/reports { user_id, reason }
GET    /api/stats/my-address/{matricule}      vues, ajouts, itinéraires ouverts (agrégés)
```
**Opérateur (🟢 allégé)** — `GET /api/admin/overview?pin=` · `GET /api/admin/address/{matricule}?pin=` · `GET /api/admin/export/csv?pin=` · `POST /api/admin/import/matricules?pin=` · `GET /api/export/csv` / `/json` (mes données)

### 13.3 Conventions d'API
`/api` obligatoire · JSON partout · erreurs métier explicites (`400` validation, `401` identifiants, `403` droits, `404` introuvable, `409` doublon, `429` débit/verrouillage) · aucune donnée sensible dans les messages d'erreur · jetons JWT HS256 en `Authorization: Bearer` · ObjectId Mongo jamais exposé (`_id` exclu des réponses).

---

## 14. Internationalisation

Un **unique** objet `src/i18n/index.ts` avec deux blocs miroirs `fr` et `en` (structure identique, contrôlée par TypeScript : `export type Strings = typeof STRINGS.fr`). **Aucune chaîne en dur dans un écran.** Bascule instantanée depuis Profil, persistée dans les préférences, langue proposée dès l'onboarding. Sections : `appName, onboarding, tabs, home, directory, guest, auth, newAddress, survey, person, place, commerce, address, scan, map, offlineMaps, inbox, exchange, profile, admin, common, values`. Prévoir la structure pour ajouter ultérieurement une langue locale sans refonte.

---

## 15. Exports et console opérateur

### 15.1 🟢 Export utilisateur (Profil)
« Exporter mes données » **CSV** et **JSON**, générés **localement depuis le carnet** (donc y compris les éléments non encore synchronisés) : téléchargement direct sur le web, partage système sur mobile (`expo-sharing`).

### 15.2 🔵 Console opérateur (PIN, sans supervision d'enquêteurs)
`app/admin.tsx` — accès par PIN (variable d'environnement `ADMIN_PIN`) :
- **Indicateurs produit** : adresses totales, domiciles, commerces, enquêtes complétées, nouvelles adresses aujourd'hui / 7 jours, échanges acceptés, taux de questionnaires remplis, % de précision ≤ 3 m, % d'azimut renseigné.
- **Recherche d'une fiche** (matricule ou code) → vue complète (adresse + enquête) pour le support.
- **Export CSV complet** : une ligne par adresse, colonnes = tous les champs d'adresse + tous les champs de l'enquête correspondante + `matricule`, `nav_lat`, `nav_lng`, `nav_note`, `photos_count`, et une colonne **`quality_issues`** (drapeaux calculés : `low_accuracy`, `missing_azimuth`, `no_survey`, `persons_count_mismatch`, `missing_persons_places`, `no_photo`, `shared_code`).
- **Import CSV matricules & points de porte** (🟢 identique à Census) : détection automatique du séparateur (`,` ou `;`) et des colonnes (alias acceptés : `matricule|matricula`, `address_id|code|code_adresse`, `latitude_exacte|nav_lat|door_lat`, `longitude_exacte|nav_lng|door_lng`, `acces|access|instructions`), **mode test à blanc** obligatoire avant écriture, rapport détaillé (lignes lues / fiches trouvées / matricules posés / points posés / codes inconnus / erreurs). **N'écrase jamais** une mesure de terrain.

---

## 16. Qualité des données : les 6 leçons de Census intégrées dès le départ

Ces six règles sont issues d'un **rapport qualité réel** produit après le déploiement terrain de Census. Les appliquer dès la v1 de Home évite de reproduire les mêmes dettes.

| # | Problème constaté dans Census | Règle imposée dans Home |
|---|---|---|
| 1 | **64,7 %** d'azimuts manquants | Azimut **bloquant** à l'étape 3 + repli manuel 8 directions |
| 2 | **69,2 %** d'incohérences entre personnes déclarées et enregistrées | Bouton « Terminer » **bloqué** jusqu'à l'égalité, compteur visible en permanence |
| 3 | **97,1 %** de lieux fréquentés manquants | Au moins 1 lieu **obligatoire** par personne, sauf case « ne se déplace pas » |
| 4 | **45 %** d'adresses sans questionnaire | Appel à l'action « Remplir le questionnaire maintenant » sur l'écran QR + pastille permanente « Questionnaire à remplir » dans le carnet |
| 5 | **Quota de stockage saturé** en pleine journée de terrain | Photos hors AsyncStorage + compression 640 px dès la v1 (PhotoStore) |
| 6 | **63 % des codes d'adresse non uniques** (363 codes pour 2 à 8 bâtiments) | **Matricule unique généré serveur** dès la v1 + garde-fou de collision sur le code lisible |

---

## 17. Force de proposition — 18 idées pour passer au niveau supérieur

Classement : **P0** = à faire dans la v1 (impact élevé, effort faible) · **P1** = v1.1 · **P2** = exploration. La colonne « Census » indique ce qui mérite d'être **rétro-porté** dans Census.

| # | Proposition | Pourquoi c'est fort | Priorité | Census |
|---|---|---|---|---|
| **P1** | **Matricule unique + « carte d'adresse » imprimable** (PNG/PDF : QR, matricule, nom, photo de façade) à coller sur le portail | Rend l'adresse **physique** ; les livreurs scannent au portail ; viralité hors ligne | **P0** | ✅ |
| **P2** | **Code d'échange en face-à-face** : 6 chiffres valables 10 min, généré par A, saisi par B → échange accepté **instantanément** des deux côtés | Le cas réel est « nous sommes l'un en face de l'autre » ; supprime toute recherche, toute erreur de destinataire, tout risque de demande à un inconnu | **P0** | ✅ |
| **P3** | **Lien de guidage temporaire** : URL publique expirant (24 h, révocable) affichant photo de façade + azimut + repères + itinéraire, **sans identité ni données de foyer** | Résout le problème n°1 du continent : faire venir un taxi, un livreur, une ambulance, un artisan — sans donner son adresse à vie | **P0** | ✅ |
| **P4** | **Repère vocal** : mémo audio de 20 s (« après la pharmacie, tourner à droite au manguier ») joint à l'adresse | C'est ainsi que les gens guident réellement ; franchit la barrière de l'écrit et des langues | **P1** | ✅ |
| **P5** | **Certificat d'adresse PDF** : attestation numérique (matricule, coordonnées, quartier, QR de vérification + page de contrôle publique) | Usage bancaire / administratif / scolaire ; transforme Home en pièce justificative et crée un usage payant crédible | **P1** | ✅ |
| **P6** | **Bouton Urgence** : envoi en un geste d'un SMS pré-rempli (coordonnées + repères + azimut + lien de guidage) aux secours ou à un contact | Valeur vitale, argument d'adoption familiale immédiat ; fonctionne même sans data (SMS) | **P1** | ✅ |
| **P7** | **Adresse multi-portes / multi-logements** : un bâtiment, plusieurs logements (`HM-XXXX-XXXX-A1`) partageant la même position mais avec des repères propres | Réalité urbaine (concessions, immeubles, chambres en location) ignorée par Census | **P1** | ✅ |
| **P8** | **Carnet familial partagé** : plusieurs membres d'un foyer rattachés à la même fiche (rôles propriétaire / membre) | Un seul relevé pour toute la famille ; la mère au village n'a rien à faire | **P1** | — |
| **P9** | **Vitrine commerce** : photos multiples, produits, horaires, bouton WhatsApp direct, « Ouvert maintenant », partage de la vitrine | Le commerce devient l'aimant d'acquisition : chaque commerçant amène ses clients | **P0** | ✅ |
| **P10** | **Statistiques du commerçant** : vues de la fiche, ajouts au carnet, itinéraires ouverts (agrégés, jamais nominatifs) | Preuve de valeur mesurable → rétention et monétisation (fiche sponsorisée) | **P1** | — |
| **P11** | **Vérification communautaire douce** : « Cette position est-elle correcte ? » par les contacts ; 3 confirmations → badge « Position confirmée » | Qualité des données sans équipe terrain ; badge de confiance visible | **P1** | ✅ |
| **P12** | **Complétion guidée** : anneau de progression (GPS, azimut, photo, questionnaire, matricule) + relances non intrusives | Attaque directement les 45 % de fiches incomplètes constatées dans Census | **P0** | ✅ |
| **P13** | **Recherche par proximité « autour de moi »** : liste des commerces ouverts à moins de 500 m | Usage quotidien qui fait revenir dans l'application | **P1** | — |
| **P14** | **Anti-abus par conception** : plafond de demandes, blocage, signalement, aucune navigation à vide du répertoire des domiciles, matricules masqués | Sans cela, un répertoire de domiciles devient un outil de harcèlement — risque existentiel du produit | **P0** | — |
| **P15** | **Journal de transparence** : « qui a consulté mon adresse », horodaté, avec retrait en un geste | La confiance est le produit ; la transparence est ce qui la crée | **P1** | — |
| **P16** | **Rappel de sauvegarde d'identité** : si aucune synchronisation depuis 48 h ou aucun téléphone rattaché, bandeau « Sécurisez votre adresse » | Répond au risque réel de perte (téléphone cassé, stockage effacé) | **P0** | ✅ |
| **P17** | **Mode « faible littératie »** : gros boutons, pictogrammes, lecture vocale des questions, saisie numérique assistée | Élargit massivement la population adressable | **P2** | ✅ |
| **P18** | **API partenaires** (lecture d'un matricule avec consentement, webhook de livraison) | Ouvre le modèle B2B : e-commerce, banques, services publics | **P2** | ✅ |

**Les 6 propositions P0 à intégrer dès la v1 : P1 (carte d'adresse), P2 (code d'échange), P3 (lien de guidage), P9 (vitrine commerce), P12 (complétion guidée), P14 (anti-abus), P16 (rappel de sauvegarde).**

---

## 18. Plan de développement — 7 phases, chacune testable

> Méthode : chaque phase se termine par des tests **automatisés backend** (pytest) et une **validation d'interface** ; on ne passe pas à la phase suivante avec une régression connue.

**Phase 0 — Fondations (½ journée)**
Thème bleu ciel · polices · i18n (squelette FR/EN) · `AppContext` + `storage` + file d'attente · empreinte d'appareil · 5 onglets vides · backend `server.py` + `shared.py` + connexion Mongo + `/api/health`.
*Tests :* l'application démarre sur les 5 onglets ; `/api/health` répond ; une écriture locale survit à un redémarrage.

**Phase 1 — Identité (1 journée)**
Onboarding · compte téléphone + PIN + OTP (mode test `123456`) · identité invité complète (10 cas d'usage §6.3) · restauration · Profil (nom, langue, identifiants, PIN révélable).
*Tests :* inscription, connexion, 5 PIN erronés → verrouillage 15 min, restauration sur un « nouvel appareil », reconnaissance d'appareil après effacement du stockage, création hors ligne finalisée au retour du réseau.

**Phase 2 — Créer une adresse (1,5 journée)**
Assistant 5 étapes complet (§7) · matricule unique serveur + garde-fou de collision · PhotoStore + compression · QR + partage + carte d'adresse imprimable (P1) · fiche « Ma adresse » · scan QR + import.
*Tests :* précision bloquante à 3 m, « Enregistrer quand même » après 120 s, azimut impossible à contourner, 5 photos sans saturation du stockage, matricule unique sur 1 000 créations simulées, QR scanné hors ligne.

**Phase 3 — Questionnaires (1,5 journée)**
Domicile (17 Q + fiches personnes + lieux) et Commerce (8 Q) conformes au §9, avec **toutes** les règles de blocage, le brouillon, le retour, le résumé.
*Tests :* impossible de terminer avec un écart personnes déclarées/enregistrées ; « Autre » exige une précision ; brouillon repris à la bonne question ; horaires invalides impossibles ; modification d'une enquête existante.

**Phase 4 — Répertoire, carnet et échange (2 journées) — cœur de Home**
Répertoire 2 catégories · recherche serveur · fiche publique filtrée · itinéraire · carnet · machine à états complète de l'échange (§10.6) · boîte de réception · code d'échange face-à-face (P2) · anti-abus (P14).
*Tests :* les 12 cas limites du §10.6 ; **test de confidentialité** : un tiers ne peut obtenir aucune coordonnée d'un domicile sans échange accepté (vérifié directement sur l'API, pas seulement dans l'interface) ; retrait réciproque ; actions hors ligne rejouées ; plafond de 20 demandes/24 h.

**Phase 5 — Carte & hors ligne (1 journée)**
Leaflet Plan/Satellite · pins (mes adresses, commerces, contacts) · cartes hors ligne (zones, rayons, reprise, suppression) · mini-cartes des fiches.
*Tests :* carte affichée sans réseau après téléchargement d'une zone ; bascule des fonds ; pin cliquable → fiche.

**Phase 6 — Valeur ajoutée & console (1 journée)**
Lien de guidage temporaire (P3) · vitrine commerce (P9) · complétion guidée (P12) · rappel de sauvegarde (P16) · console opérateur + exports + import matricules.
*Tests :* lien de guidage expiré → page « lien expiré » sans fuite de données ; export CSV complet avec `quality_issues` ; import à blanc sans écriture puis import réel.

**Phase 7 — Durcissement & livraison (1 journée)**
Revue de sécurité (permissions, PIN, filtrage serveur, débit) · audit d'accessibilité (contrastes, tailles, cibles 44 px) · performance (listes virtualisées, images) · documents (guide utilisateur FR/EN, PDF des questionnaires, PRD) · préparation des builds iOS/Android.

---

## 19. QA — scénarios obligatoires avant livraison

1. **Hors ligne intégral** : mode avion → créer 3 adresses + 2 questionnaires + 5 photos + 1 demande d'échange → fermer l'application → rétablir le réseau → tout est synchronisé, aucun doublon.
2. **Effacement du stockage** : vider le stockage → l'appareil est reconnu, reprise par PIN, carnet restauré.
3. **Nouveau téléphone** : connexion avec identifiant + PIN → adresses, questionnaires, photos, carnet et échanges restaurés.
4. **Confidentialité** (test d'API, pas d'interface) : avec le jeton du compte C, appeler la fiche d'un domicile avec lequel C n'a **aucun** lien → aucune coordonnée, aucune photo, aucun champ d'enquête dans la réponse.
5. **Échange complet** : A demande → B accepte → présence réciproque dans les carnets → B retire → disparition des deux côtés.
6. **Erreur de destinataire** : A demande à la mauvaise personne → annule → la demande disparaît chez B.
7. **Abus** : 21 demandes en 24 h → 429 ; blocage → plus aucune demande possible ; répertoire des domiciles non navigable à vide.
8. **Qualité** : impossible d'enregistrer une adresse sans azimut ; impossible de terminer un questionnaire Domicile avec 3 personnes déclarées et 2 enregistrées.
9. **Précision** : simulation d'une précision à 8 m → bouton bloqué, puis « Enregistrer quand même » après 120 s → `low_accuracy = true` visible dans l'export.
10. **Bilingue** : bascule FR/EN sur chaque écran → aucune chaîne non traduite, aucun débordement de mise en page.
11. **Permissions** : refus de la localisation, refus de la caméra, refus définitif → application utilisable, boutons « Ouvrir les réglages » présents.
12. **Charge** : 1 000 adresses dans le répertoire → recherche < 300 ms, liste fluide.

---

## 20. Pièges connus à éviter (retour d'expérience Census)

1. **Ne jamais** stocker de photo en base64 dans AsyncStorage/localStorage → saturation du quota, journée de terrain perdue.
2. **Ne jamais** considérer un code construit à la main comme un identifiant unique → le matricule serveur est la seule clé.
3. **Ne jamais** filtrer la confidentialité côté client : un tiers ne doit pas pouvoir obtenir une donnée privée en appelant l'API directement.
4. **Ne jamais** mettre de valeur par défaut sur un choix : une réponse non vue par l'utilisateur est une donnée fausse.
5. **Ne jamais** faire dépendre l'empreinte d'appareil du stockage local (sinon la reconnaissance après effacement ne fonctionne pas).
6. **Twilio en mode Trial** n'envoie de SMS qu'aux numéros vérifiés : prévoir le mode test `123456` activable par variable d'environnement et l'écrire dans la documentation.
7. **Boussole** : `watchHeadingAsync` fonctionne téléphone à la verticale ; le magnétomètre brut, non. Toujours un repli manuel à 8 directions.
8. **Paquets dépréciés** : `expo-av`, `expo-barcode-scanner`, `expo-background-fetch` → utiliser `expo-audio`/`expo-video`, `expo-camera`, `expo-background-task`.
9. **Les fonctions natives** (boussole, caméra, tuiles hors ligne volumineuses) ne se valident pas dans l'aperçu web : le dire explicitement et tester sur un build réel.
10. **Ne jamais** modifier `metro.config.js`, ni les variables d'environnement de l'empaqueteur, ni le port du backend.
11. **Synchronisation idempotente** : sans uuid client, un rejeu crée des doublons (observé dans Census).
12. **Ne pas** laisser un utilisateur sans identifiant récupérable : tout invité reçoit un identifiant + un PIN dès la première utilisation.

---

## 21. Glossaire

**Matricule** : identifiant unique et immuable d'une adresse (`HM-XXXX-XXXX`). **Code d'adresse** : libellé lisible dérivé du quartier/secteur/rue/maison (`BNA-L019-X007`). **Azimut** : orientation de la porte en degrés (0 = Nord). **Point de guidage** : coordonnées retenues pour l'itinéraire (porte vérifiée > corrigée satellite > GPS mesuré). **Carnet** : ensemble des adresses possédées ou reçues. **Échange** : lien réciproque et consenti entre deux domiciles. **Registre central** : base MongoDB du serveur. **Carnet local** : stockage de l'appareil. **File d'attente** : liste des écritures non encore synchronisées.

---

*Document rédigé à partir du code de production d'AddressBook Census v7.1 (application Expo, API FastAPI, base MongoDB) : questionnaires extraits du référentiel officiel, seuils GPS et règles de blocage relevés dans le code, dettes de données mesurées sur la base réelle de 2 148 adresses.*
