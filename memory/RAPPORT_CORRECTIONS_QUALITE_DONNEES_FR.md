# 📋 RAPPORT DES CORRECTIONS — Qualité des données Fotouni

**Date : Août 2026** — En réponse au « Rapport sur la Qualité des Données de l'Enquête Fotouni » (805 bâtiments, 17-19 août).

---

## Réponse à votre question : « Comment récupérer TOUTES les informations d'un foyer ? »

Vous avez maintenant **3 moyens** :

### 1. 🔍 Recherche Admin (NOUVEAU — le plus simple)
Admin (PIN 237237) → section **« Rechercher un bâtiment »** → tapez le code (ex : FOT-A-001-001) → la **fiche complète** s'affiche : adresse, GPS, azimut, photos, enquêteur, TOUTES les réponses d'enquête, la liste des habitants avec leurs lieux fréquentés.

### 2. 📥 Export CSV Admin (bouton « Exporter tout (CSV admin) »)
⚠️ IMPORTANT : c'est CE bouton (dans l'écran Admin) qu'il faut utiliser pour le fichier du soir — PAS l'export du Profil (qui ne contient que les données locales de VOTRE téléphone, sans les enquêtes des testeurs).
Le CSV admin contient 88 colonnes : adresse + azimut + GPS brut/corrigé + TOUTES les réponses d'enquête (foyer, commerce, public, patrimoine) + habitants (`persons_summary`) + lieux fréquentés (`persons_places`) + la nouvelle colonne **`quality_issues`**.

### 3. 🔗 API directe : `GET /api/admin/address/{code}?pin=237237` (JSON complet).

---

## Corrections point par point du rapport qualité

### ① missing_azimuth (64,7 %) → AZIMUT OBLIGATOIRE
- L'étape 3 (boussole) **bloque** désormais si la direction n'est pas verrouillée. Message rouge explicite.
- **NOUVEAU : sélection manuelle** de la direction (8 boutons N/NE/E/SE/S/SO/O/NO) — pour les téléphones dont la boussole ne fonctionne pas (cause principale des 64,7 %).
- ✅ Comment vérifier : Nouvelle adresse → étape 3 → appuyez « Suivant » sans rien faire → blocage + message. Choisissez « NE » → passe.

### ② persons_count_mismatch (69,2 %) → CORRESPONDANCE OBLIGATOIRE
- Bandeau permanent dans la liste des personnes : « X enregistrée(s) sur Y » (orange si incomplet, vert ✓ si complet), avec boutons +/- pour corriger le nombre déclaré sur place.
- Le bouton « Terminer » **bloque** tant que toutes les personnes déclarées ne sont pas enregistrées : « 3 personnes manquantes ! ».
- ✅ Comment vérifier : enquête foyer, déclarez 3 résidents, enregistrez 1 personne → « Terminer » → blocage.

### ③ missing_persons_places (97,1 %) → LIEUX FRÉQUENTÉS OBLIGATOIRES
- Impossible d'enregistrer une personne **sans au moins un lieu fréquenté**.
- Exception légitime : case « Cette personne ne se déplace pas (bébé, personne âgée, malade...) ».
- ✅ Comment vérifier : ajoutez une personne sans lieu → blocage avec message. Cochez « ne se déplace pas » → passe.

### ④ Enquêtes commerciales → TRAVAILLEURS + PRODUITS + HORAIRES OBLIGATOIRES
- **NOUVEAU champ « Nombre de travailleurs (patron inclus) »** — obligatoire (≥ 1).
- Produits déjà obligatoires ; **horaires de semaine désormais obligatoires** (ou « Fermé »).
- ✅ Comment vérifier : enquête commerce, laissez travailleurs à 0 → blocage.

### ⑤ Bâtiments publics → 6 NOUVEAUX CHAMPS, TOUS OBLIGATOIRES
- Organisme gestionnaire (obligatoire — était vide dans 40 % des cas)
- Téléphone (obligatoire — était vide dans 75 % des cas) + bouton « Pas de téléphone » si le bâtiment n'en a pas
- **NOUVEAU : Nombre de travailleurs** (enseignants, médecins, agents...)
- **NOUVEAU : Capacité maximale** (exemples adaptés au type : « 400 élèves » pour une école, « 25 lits » pour un centre de santé)
- **NOUVEAU : Usage actuel** (« 320 élèves inscrits », « 40 patients/jour »)
- **NOUVEAU : Heures d'ouverture**
- ✅ Comment vérifier : enquête Service public → impossible de passer sans tout remplir.

### ⑥ Cuisine séparée = bâtiment à part
- Message d'instruction permanent à l'étape « cuisine » : « ⚠️ une cuisine physiquement séparée du bâtiment principal est un bâtiment à part entière — créez pour elle sa propre adresse EFYL ».

### ⑦ no_survey (45 %) → RAPPEL FORT APRÈS CHAQUE CRÉATION
- Après la création d'une adresse, l'écran QR affiche en premier un gros bouton orange **« 📋 Faire l'enquête maintenant »** + « chaque bâtiment doit avoir son enquête — faites-la pendant que vous êtes sur place ».

### ⑧ NOUVELLE colonne `quality_issues` dans le CSV admin
Chaque ligne du CSV du soir indique automatiquement ses problèmes : `no_survey | missing_azimuth | persons_count_mismatch | missing_persons_places | missing_commerce_workers | missing_commerce_hours | missing_public_phone | missing_public_managing_org | missing_public_workers | missing_public_capacity...`
→ Vos analystes filtrent cette colonne dans Excel pour voir instantanément ce qui manque, par bâtiment et par enquêteur (colonne `owner_name`).

---

## ⚠️ Note importante sur les données DÉJÀ collectées
Les nouvelles obligations s'appliquent aux **nouvelles enquêtes**. Les 805 bâtiments déjà enquêtés gardent leurs trous — la colonne `quality_issues` vous permet de lister les bâtiments à re-visiter (filtre Excel), et la recherche Admin permet de contrôler chaque code un par un.

## Nouvelles colonnes CSV (à annoncer aux analystes)
`commerce_workers`, `public_workers`, `public_capacity_max`, `public_usage_current`, `public_hours`, `quality_issues` (les colonnes existantes ne changent pas d'ordre relatif : mise à jour des modèles d'import éventuels nécessaire).
