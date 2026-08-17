# EFYL AddressBook — Comment fonctionne le stockage des données (FR)

> Document généré pour le propriétaire du projet. Disponible via `GET /api/docs/list`.

## 1. Architecture en 2 étages : « Le carnet et le registre central »

Chaque téléphone possède son **carnet local** (stockage interne de l'appareil).
Le serveur EFYL possède le **registre central** (base de données MongoDB).

```
[Téléphone A] --carnet local--> file d'attente --> (Internet) --> [REGISTRE CENTRAL] <-- (Internet) <-- [Téléphone B]
```

- Toute adresse/enquête est **d'abord** écrite dans le carnet local (instantané, fonctionne sans réseau).
- Une **file d'attente de synchronisation** garde la liste de ce qui n'a pas encore été envoyé.
- Dès qu'Internet est détecté (ou à chaque ouverture de l'app, ou bouton « Synchroniser »), la file est envoyée au registre central.
- Si l'envoi échoue (réseau coupé au milieu), les éléments **restent dans la file** et seront renvoyés plus tard. Aucune perte.

## 2. Identité : qui a enregistré quoi ?

- Chaque téléphone reçoit un **identifiant d'appareil unique** (ex: `guest-dev-xxxx`), créé à la première ouverture.
- L'enquêteur saisit son **nom** au premier lancement (ou dans Profil). Ce nom + l'identifiant sont attachés à **chaque adresse** envoyée au serveur.
- Si l'utilisateur se connecte par SMS, son identifiant devient son numéro (ex: `user_237699...`).
- Le **tableau de bord admin** (Profil → Tableau de bord, code PIN) montre : qui est actif, combien d'adresses par personne, aujourd'hui/au total, et les dernières adresses reçues.

## 3. Visibilité : privé ou public ?

| Type | Visibilité |
|---|---|
| 🏠 Foyer (maison) | **Privé** — visible uniquement sur le téléphone qui l'a créé (+ registre central pour l'admin) |
| 🏪 Commerce | **Public** — visible par TOUS les utilisateurs après synchronisation |
| 🏛️ Service public (école, hôpital...) | **Public** |
| 🏞️ Lieu sacré / touristique | **Public** |

L'admin, lui, voit **tout** (y compris les foyers) via le tableau de bord et l'export CSV admin.

## 4. Tous les scénarios

### Scénarios simples
1. **A crée un foyer, en ligne** → carnet local A + registre central immédiatement. B ne le voit pas (privé). Admin le voit.
2. **A crée un foyer, hors ligne** → carnet local A + file d'attente. Dès qu'Internet revient → registre central automatiquement.
3. **A crée un commerce, en ligne** → registre central → B (et tous les autres) le voient sur la carte communautaire et dans « Commerces de la communauté ».
4. **A crée un commerce, hors ligne** → visible pour B uniquement APRÈS que A ait retrouvé Internet et synchronisé.
5. **A scanne le QR d'une adresse** → il voit les infos contenues dans le QR (aucune connexion nécessaire).

### Scénarios à deux appareils
6. **A et B créent chacun des adresses différentes** → chacune est stockée dans le carnet de SON téléphone + dans le registre central avec l'identifiant de son créateur. Elles ne se mélangent jamais.
7. **B clique sur un commerce créé par A** → la fiche est chargée depuis le serveur, en **lecture seule** (badge « Adresse communautaire »). B ne peut ni la modifier ni la supprimer.
8. **A supprime son adresse** → supprimée de son carnet immédiatement, et du registre central à la prochaine synchronisation.
9. **A modifie l'enquête (ex: ajoute une personne au foyer)** → mise à jour locale immédiate + file d'attente → registre central.

### Scénarios hors connexion avancés
10. **6 enquêteurs travaillent en zone sans réseau toute la journée** → chacun accumule ses adresses/enquêtes/photos dans SON téléphone. Le soir, au retour du réseau (ou en Wi-Fi), chaque téléphone envoie tout automatiquement, même si l'app a été fermée entre-temps (envoi dès la réouverture).
11. **L'enquêteur ferme le navigateur (version preview) et revient le lendemain** → les données restent dans le stockage du navigateur (localStorage) et se synchronisent à la reconnexion. ⚠️ S'il **efface les données de navigation** de son téléphone, les données NON synchronisées seraient perdues → règle terrain : synchroniser dès que possible.
12. **Coupure d'Internet au milieu d'une synchronisation** → les éléments non transmis restent dans la file et repartent à la tentative suivante.
13. **Enquête commencée mais non finie** → bouton « Continuer plus tard » = brouillon enregistré localement, repris exactement où on s'était arrêté.
14. **Cartes hors ligne** → si une zone a été téléchargée (mobile), la carte s'affiche sans réseau ; le GPS fonctionne toujours sans Internet.

### Scénarios de conflit / limites
15. **Deux enquêteurs créent la MÊME maison** → deux adresses distinctes existeront (identifiants différents). L'admin les repère sur le tableau de bord (coordonnées quasi identiques) et peut nettoyer.
16. **Même personne sur 2 téléphones** → 2 identifiants d'appareil différents ; mettre le même nom d'enquêteur permet de regrouper à l'analyse.
17. **Le téléphone est perdu/cassé avant synchronisation** → les données non synchronisées sont perdues (elles n'existaient que sur l'appareil). D'où l'importance de synchroniser souvent.

## 5. Où est physiquement le registre central ?

- Version preview : base MongoDB hébergée avec l'environnement Emergent du projet.
- Version finale déployée : la base de données de production associée au déploiement. Le fonctionnement (2 étages, file d'attente, tableau de bord) reste identique.

## 6. Récupération des données par l'admin (sans dépendre des testeurs)

1. **Tableau de bord dans l'app** : Profil → Tableau de bord (admin) → code PIN → stats temps réel + liste des enquêteurs + dernières adresses.
2. **Export CSV admin** : bouton « Exporter tout » dans le tableau de bord → un fichier CSV avec TOUTES les données de TOUS les enquêteurs (avec colonnes owner_id / owner_name).
3. **API directe** : `GET /api/admin/overview?pin=***` et `GET /api/admin/export/csv?pin=***`.
