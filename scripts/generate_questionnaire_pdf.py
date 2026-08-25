# -*- coding: utf-8 -*-
"""Génère le PDF de référence : TOUTES les questions des 4 enquêtes EFYL.
Source de vérité : /app/frontend/app/survey/[id].tsx + i18n fr (extraction manuelle vérifiée)."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, HRFlowable, PageBreak, Table, TableStyle,
)

F = "/app/frontend/node_modules/@expo-google-fonts/dm-sans"
pdfmetrics.registerFont(TTFont("DMSans", f"{F}/400Regular/DMSans_400Regular.ttf"))
pdfmetrics.registerFont(TTFont("DMSans-Bold", f"{F}/700Bold/DMSans_700Bold.ttf"))
pdfmetrics.registerFont(TTFont("DMSans-Italic", f"{F}/400Regular_Italic/DMSans_400Regular_Italic.ttf"))

GREEN = HexColor("#1B5E3B")
ORANGE = HexColor("#C2410C")
GREY = HexColor("#555555")
LIGHT = HexColor("#F0F7F2")

title_s = ParagraphStyle("title", fontName="DMSans-Bold", fontSize=22, leading=27, textColor=GREEN, alignment=TA_CENTER)
subtitle_s = ParagraphStyle("subtitle", fontName="DMSans", fontSize=11, leading=15, textColor=GREY, alignment=TA_CENTER)
h1 = ParagraphStyle("h1", fontName="DMSans-Bold", fontSize=16, leading=20, textColor=GREEN, spaceBefore=14, spaceAfter=4)
h2 = ParagraphStyle("h2", fontName="DMSans-Bold", fontSize=12.5, leading=16, textColor=HexColor("#0F3D26"), spaceBefore=10, spaceAfter=2)
q_s = ParagraphStyle("q", fontName="DMSans-Bold", fontSize=10.5, leading=14, spaceBefore=7)
meta_s = ParagraphStyle("meta", fontName="DMSans-Italic", fontSize=9, leading=12, textColor=GREY, leftIndent=14)
opt_s = ParagraphStyle("opt", fontName="DMSans", fontSize=9.5, leading=13, leftIndent=22)
note_s = ParagraphStyle("note", fontName="DMSans", fontSize=9.5, leading=13, textColor=ORANGE, leftIndent=14)
body_s = ParagraphStyle("body", fontName="DMSans", fontSize=10, leading=14)

story = []
n = {"v": 0}  # numéro de question global par section


def q(text, kind, mandatory=True, options=None, notes=None, indent=0):
    n["v"] += 1
    tag = "OBLIGATOIRE" if mandatory else "optionnel"
    color = "#B91C1C" if mandatory else "#6B7280"
    li = 14 + indent
    story.append(Paragraph(
        f'Q{n["v"]}. {text} &nbsp;<font size="8" color="{color}">[{tag}]</font>',
        ParagraphStyle("qq", parent=q_s, leftIndent=indent)))
    story.append(Paragraph(f"Type de réponse : {kind}", ParagraphStyle("m", parent=meta_s, leftIndent=li)))
    if options:
        story.append(Paragraph("Choix proposés : " + " &bull; ".join(options),
                               ParagraphStyle("o", parent=opt_s, leftIndent=li + 8)))
    if notes:
        for note in notes:
            story.append(Paragraph(note, ParagraphStyle("n", parent=note_s, leftIndent=li)))


def section(num, emoji_title, steps_desc):
    story.append(HRFlowable(width="100%", color=GREEN, thickness=1.2, spaceBefore=12, spaceAfter=2))
    story.append(Paragraph(f"ENQUÊTE {num} — {emoji_title}", h1))
    story.append(Paragraph(steps_desc, ParagraphStyle("sd", parent=body_s, textColor=GREY)))
    n["v"] = 0


# ============================== PAGE DE GARDE ==============================
story.append(Spacer(1, 30 * mm))
story.append(Paragraph("EFYL AddressBook", title_s))
story.append(Spacer(1, 4 * mm))
story.append(Paragraph("RÉFÉRENTIEL COMPLET DES QUESTIONNAIRES", title_s))
story.append(Spacer(1, 8 * mm))
story.append(Paragraph("Toutes les questions des 4 enquêtes, dans l'ordre exact de l'application,<br/>avec les choix de réponse, les questions par personne et par lieu fréquenté.", subtitle_s))
story.append(Spacer(1, 6 * mm))
story.append(Paragraph("Version : Août 2026 — conforme à l'application en production", subtitle_s))
story.append(Spacer(1, 14 * mm))
toc = [
    ["Question commune", "Choix du type de bâtiment"],
    ["Enquête 1", "FOYER (maison d'habitation) — 17 questions + fiche par personne (7) + fiche par lieu (4)"],
    ["Enquête 2", "COMMERCE (boutique, atelier, clinique) — 8 questions"],
    ["Enquête 3", "SERVICE PUBLIC (école, santé, administration) — 9 questions"],
    ["Enquête 4", "LIEU SACRÉ / TOURISTIQUE (patrimoine) — 14 questions"],
    ["Annexe", "Informations recueillies à la création de l'adresse (avant l'enquête)"],
]
tt = Table(toc, colWidths=[38 * mm, 132 * mm])
tt.setStyle(TableStyle([
    ("FONTNAME", (0, 0), (0, -1), "DMSans-Bold"),
    ("FONTNAME", (1, 0), (1, -1), "DMSans"),
    ("FONTSIZE", (0, 0), (-1, -1), 10),
    ("TEXTCOLOR", (0, 0), (0, -1), GREEN),
    ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ("LEFTPADDING", (0, 0), (-1, -1), 10),
]))
story.append(tt)
story.append(PageBreak())

# ============================== QUESTION COMMUNE ==============================
story.append(Paragraph("QUESTION COMMUNE — Début de toute enquête", h1))
story.append(Paragraph(
    "Écran affiché : « Quel type de bâtiment ? » — <i>Les commerces et services publics sont visibles par tous "
    "après synchronisation. Les foyers restent privés.</i>", body_s))
n["v"] = 0
q("Quel type de bâtiment ?", "Choix unique (4 cartes)", True, [
    "Foyer (maison d'habitation) — données privées, visibles par vous uniquement",
    "Commerce (boutique, atelier, clinique) — données publiques, partagées avec la communauté",
    "Service public (école, santé, administration) — données publiques, visibles par la communauté",
    "Lieu sacré / touristique — patrimoine, culture, tourisme, données publiques",
])
story.append(Paragraph(
    "À tout moment : bouton « Continuer plus tard » (sauvegarde le brouillon), bouton « Retour » "
    "(revient à la question précédente en conservant les réponses).", note_s))

# ============================== ENQUÊTE 1 : FOYER ==============================
section(1, "FOYER (maison d'habitation)",
        "Parcours : choix du type → introduction → 18 questions → fiche de CHAQUE personne du foyer "
        "(avec lieux fréquentés) → résumé → enregistrement.")
story.append(Paragraph("Écran d'introduction : « Que voulez-vous enregistrer pour cette adresse ? » + code de l'adresse, bouton « Commencer l'enquête ».", body_s))

q("Nom de la famille / du foyer", "Texte libre (ex : Famille Kamdem)")
q("Combien de personnes vivent dans ce foyer ?", "Nombre (boutons − / +, minimum 1)",
  notes=["Règle : le nombre déclaré ici devra correspondre EXACTEMENT au nombre de personnes enregistrées à la fin (blocage sinon)."])
q("Quelle est la principale source de revenus du foyer ?", "Texte libre (ex : Commerce, Agriculture...)")
q("Autres sources de revenus", "Texte libre", mandatory=False)
q("Niveau de revenus du foyer", "Choix unique", True, [
    "Très faible — revenus irréguliers, moins de 50 000 FCFA/mois, besoins de base difficiles à couvrir",
    "Faible — 50 000 à 150 000 FCFA/mois, besoins de base couverts, peu ou pas d'épargne",
    "Moyen — 150 000 à 500 000 FCFA/mois, vie confortable, épargne possible",
    "Élevé — plus de 500 000 FCFA/mois, ménage aisé (véhicule, investissements)",
])
q("Combien de téléphones dans le foyer ?", "Nombre (boutons − / +)")
q("Avez-vous accès à internet à la maison ?", "Oui / Non")
q("Comment est l'électricité dans la maison ?", "Choix unique", True, ["Stable", "Instable", "Aucun"])
q("Y a-t-il accès à l'eau courante à l'intérieur du logement ?", "Choix unique", True, ["Stable", "Instable", "Aucun"])
q("Quel type de toilettes avez-vous ?", "Choix unique", True, ["Chasse d'eau", "Traditionnel", "Autre"],
  notes=["Si « Autre » : question complémentaire OBLIGATOIRE « Précisez le type de toilettes » (texte libre)."])
q("Où est située la cuisine ?", "Choix unique", True, ["Dans une pièce séparée", "Dans le salon", "Bâtiment séparé"],
  notes=["Règle affichée à l'écran : une cuisine physiquement séparée du bâtiment principal est un bâtiment "
         "à part entière — créez pour elle sa propre adresse EFYL."])
q("Combien de pièces compte le logement (hors cuisine et salle de bain) ?", "Nombre (minimum 1)",
  notes=["Consigne affichée : inclure les chambres, le salon et toute autre pièce habitable."])
q("Combien d'étages a le bâtiment ?", "Nombre (minimum 1)")
q("Matériaux des murs", "Choix unique", True, ["Parpaing", "Adobe", "Bois", "Autre"],
  notes=["Si « Autre » : question complémentaire OBLIGATOIRE « Précisez le matériau des murs » (texte libre)."])
q("Y a-t-il des fenêtres vitrées ?", "Oui / Non")
q("Matériaux de la toiture", "Choix unique", True, ["Tôle", "Bois", "Plastique", "Parpaing (béton)", "Autre"],
  notes=["Si « Autre » : question complémentaire OBLIGATOIRE « Précisez le matériau de la toiture » (texte libre)."])
q("Combien de véhicules possède le foyer ?", "4 compteurs distincts (boutons − / +)", True,
  ["Bicyclettes", "Motos", "Voitures", "Camions"])
story.append(Paragraph("Écran de transition : « Renseignez les informations de chaque personne du foyer. »", body_s))

story.append(Paragraph("FICHE PAR PERSONNE — à remplir pour CHAQUE personne du foyer", h2))
story.append(Paragraph(
    "L'écran « Personnes du foyer » affiche un compteur « X enregistrée(s) sur Y » (ajustable avec − / +). "
    "Le bouton « Terminer » est BLOQUÉ tant que toutes les personnes déclarées ne sont pas enregistrées. "
    "Si 3 personnes sont déclarées, les questions ci-dessous sont posées 3 fois (une fiche par personne) :", body_s))
n["v"] = 0
q("Nom complet", "Texte libre", indent=10)
q("Téléphone ou email", "Texte libre", mandatory=False, indent=10)
q("Âge", "Nombre (entre 0 et 120)", indent=10)
q("Genre", "Choix unique", True, ["Masculin", "Féminin"], indent=10)
q("Niveau d'études", "Choix unique", True,
  ["École primaire", "Collège", "Lycée", "Université", "Aucune scolarisation"], indent=10)
q("Profession", "Texte libre", mandatory=False, indent=10)
q("Cette personne ne se déplace pas (bébé, personne âgée, malade...)", "Case à cocher",
  mandatory=False, indent=10,
  notes=["Si cochée : les lieux fréquentés ne sont pas demandés pour cette personne."])

story.append(Paragraph("LIEUX FRÉQUENTÉS — pour CHAQUE personne (sauf si « ne se déplace pas »)", h2))
story.append(Paragraph(
    "OBLIGATOIRE : au moins 1 lieu par personne (blocage sinon). Recommandation affichée : 3 à 4 lieux — "
    "1-2 boutiques, le travail ou l'école, 1-2 lieux de loisirs/communauté (église, bar, espace communautaire...), "
    "1-2 amis. Pour CHAQUE lieu ajouté, les 4 questions suivantes sont posées :", body_s))
n["v"] = 0
q("Type de lieu", "Choix unique", True,
  ["Boutique", "Travail", "École", "Loisir / communauté", "Ami / famille"], indent=10)
q("Nom du lieu / de la personne", "Texte libre", indent=10)
q("Fréquence", "Choix unique", True,
  ["Tous les jours", "Chaque semaine", "Chaque mois", "Rarement"], indent=10)
q("Pourquoi ? (texte libre)", "Texte libre", mandatory=False, indent=10)
story.append(Paragraph(
    "Fin de l'enquête Foyer : écran « Résumé de l'enquête » (personnes, logement, services) puis bouton "
    "« Enregistrer l'enquête ».", body_s))
story.append(PageBreak())

# ============================== ENQUÊTE 2 : COMMERCE ==============================
section(2, "COMMERCE (boutique, atelier, clinique)",
        "Parcours : choix du type → fiche Commerce (8 questions sur un seul écran) → résumé → enregistrement.")
q("Nom du commerce", "Texte libre")
q("Nom du propriétaire", "Texte libre", mandatory=False)
q("Téléphone du commerce", "Texte libre (clavier téléphone)", mandatory=False)
q("Produits / activités", "Choix multiples + ajout libre (au moins 1 OBLIGATOIRE)", True, [
    "Alimentation générale", "Boissons", "Pain & pâtisserie", "Fruits & légumes", "Viande & poisson",
    "Restauration / plats cuisinés", "Produits ménagers", "Cosmétiques & beauté", "Coiffure",
    "Vêtements & chaussures", "Tissus & couture", "Téléphones & accessoires",
    "Crédit téléphonique & Mobile Money", "Électronique", "Pièces détachées", "Quincaillerie",
    "Matériaux de construction", "Gaz domestique", "Médicaments / pharmacie", "Papeterie & scolaire", "Meubles",
], notes=["+ champ « Autre produit ou activité... » pour ajouter librement tout autre produit."])
q("Nombre de travailleurs (patron inclus)", "Nombre (boutons − / +, minimum 1)")
q("Horaires lundi-vendredi", "Ouvert (heure d'ouverture + heure de fermeture) ou Fermé")
q("Horaires samedi", "Ouvert (heures) ou Fermé", mandatory=False)
q("Horaires dimanche", "Ouvert (heures) ou Fermé", mandatory=False)
story.append(Paragraph("Fin : écran « Résumé » (fiche Commerce) puis « Enregistrer l'enquête ».", body_s))

# ============================== ENQUÊTE 3 : SERVICE PUBLIC ==============================
section(3, "SERVICE PUBLIC (école, santé, administration)",
        "Parcours : choix du type → fiche Service public (10 questions sur un seul écran) → résumé → enregistrement.")
q("Nom du lieu", "Texte libre (ex : École publique de Fotouni)")
q("Catégorie", "Choix unique", True, [
    "École / éducation", "Centre de santé / hôpital", "Administration publique", "Bâtiment communautaire",
    "Point d'eau / fontaine", "Antenne / infrastructure", "Lieu de culte", "Autre",
], notes=["Si « Autre » : question complémentaire OBLIGATOIRE « Précisez la catégorie » (texte libre)."])
q("Organisme gestionnaire", "Texte libre")
q("Téléphone", "Texte libre (clavier téléphone)", True,
  notes=["Bouton « Pas de téléphone » disponible si le bâtiment n'a pas de numéro (remplit « aucun »)."])
q("Nombre de travailleurs (enseignants, médecins, agents...)", "Nombre (saisie directe, ex : 12 — mettre 0 si aucun)")
q("Capacité maximale", "Texte libre", True,
  notes=["Exemples affichés selon la catégorie : école → « 400 élèves » ; santé → « 25 lits » ; autres → « 200 usagers »."])
q("Usage actuel", "Texte libre", True,
  notes=["Exemples affichés selon la catégorie : école → « 320 élèves inscrits » ; santé → « 40 patients/jour, 2 médecins » ; autres → « 80 usagers/jour »."])
q("Heures d'ouverture", "Ouvert (heure d'ouverture + heure de fermeture) ou Fermé")
q("Notes", "Texte libre multiligne", mandatory=False)
story.append(Paragraph("Fin : écran « Résumé » (fiche Service public) puis « Enregistrer l'enquête ».", body_s))
story.append(PageBreak())

# ============================== ENQUÊTE 4 : PATRIMOINE ==============================
section(4, "LIEU SACRÉ / TOURISTIQUE (patrimoine)",
        "Parcours : choix du type → fiche Lieu sacré / touristique (14 questions sur un seul écran) → résumé → enregistrement.")
q("Nom du site", "Texte libre (ex : Chefferie de Fotouni, Chutes de la Métché)")
q("Type de site", "Choix unique", True, ["Lieu sacré", "Lieu touristique", "Les deux"])
q("Catégorie", "Choix unique", True, [
    "Chefferie / palais royal", "Forêt sacrée", "Lieu de culte", "Tombeau / mausolée",
    "Chute d'eau / site naturel", "Grotte", "Musée", "Monument / statue", "Point de vue",
    "Marché artisanal", "Autre",
], notes=["Si « Autre » : question complémentaire OBLIGATOIRE « Précisez la catégorie » (texte libre)."])
q("Description / histoire brève", "Texte libre multiligne", mandatory=False)
q("Gestionnaire / autorité (chefferie, communauté, État...)", "Texte libre", mandatory=False)
q("Conditions d'accès", "Choix unique", True, ["Accès libre", "Accès payant", "Autorisation requise"],
  notes=["Si « Accès payant » : question complémentaire OBLIGATOIRE « Tarif d'entrée (ex : 1 000 FCFA) » (texte libre)."])
q("Horaires de visite", "Ouvert (heures) ou Fermé", mandatory=False,
  notes=["Si renseigné, l'heure de fermeture doit être après l'heure d'ouverture."])
q("Meilleure période de visite", "Texte libre", mandatory=False)
q("Les photos sont-elles autorisées sur le site ?", "Oui / Non")
q("Restrictions culturelles (tenue exigée, rituels, zones interdites...)", "Texte libre multiligne", mandatory=False)
q("Équipements disponibles sur place", "Choix multiples", False,
  ["Parking", "Toilettes", "Guide local", "Restauration", "Hébergement"])
q("État de la route d'accès", "Choix unique", True, ["Bonne", "Moyenne", "Difficile"])
q("Téléphone de contact", "Texte libre (clavier téléphone)", mandatory=False)
q("Notes", "Texte libre multiligne", mandatory=False)
story.append(Paragraph("Fin : écran « Résumé » (fiche Lieu sacré / touristique) puis « Enregistrer l'enquête ».", body_s))
story.append(PageBreak())

# ============================== ANNEXE ==============================
story.append(Paragraph("ANNEXE — Informations recueillies à la CRÉATION DE L'ADRESSE", h1))
story.append(Paragraph(
    "Avant toute enquête, la création de l'adresse numérique recueille les informations suivantes "
    "(assistant en 5 étapes) :", body_s))
n["v"] = 0
story.append(Paragraph("Étape 1 — Mesurer la Porte", h2))
q("Position GPS de la porte", "Mesure automatique (latitude, longitude, précision en mètres)", True,
  notes=["L'enquêteur se place devant la porte ; la précision s'affiche en temps réel."])
story.append(Paragraph("Étape 2 — Détails", h2))
q("Quartier", "Texte (détection automatique si Internet, sinon saisie manuelle)")
q("Secteur", "Texte (1-2 lettres)")
q("Rue (numéro)", "Nombre")
q("Maison (numéro)", "Nombre")
q("Nom du contact", "Texte libre", mandatory=False)
q("Téléphone", "Texte libre", mandatory=False)
q("Notes (ex : 2e étage, porte bleue)", "Texte libre", mandatory=False)
story.append(Paragraph("Étape 3 — Direction & Photo", h2))
q("Direction de l'entrée (azimut)", "Boussole (« Verrouiller la direction ») OU choix manuel parmi 8 directions", True,
  ["N (0°)", "NE (45°)", "E (90°)", "SE (135°)", "S (180°)", "SO (225°)", "O (270°)", "NO (315°)"],
  notes=["OBLIGATOIRE : impossible de continuer sans azimut.",
         "Consigne : se placer dehors, face à l'entrée, téléphone à plat à hauteur de poitrine, haut du téléphone vers la porte."])
q("Photos du bâtiment (jusqu'à 5)", "Photos via caméra", mandatory=False,
  notes=["Chaque photo enregistre automatiquement la position GPS et la direction de la caméra."])
story.append(Paragraph("Étape 4 — Correction satellite", h2))
q("Correction de la position sur image satellite", "Glisser le point orange sur la porte exacte", mandatory=False,
  notes=["Le point bleu (GPS mesuré) reste affiché pour comparaison. Boutons : « Enregistrer et continuer » ou « Continuer sans corriger »."])
story.append(Paragraph("Étape 5 — Vérifier", h2))
story.append(Paragraph("Récapitulatif de l'adresse (code EFYL, coordonnées, contact) puis enregistrement. "
                       "L'écran QR propose ensuite immédiatement : « Faire l'enquête maintenant ».", body_s))

story.append(Spacer(1, 8 * mm))
story.append(HRFlowable(width="100%", color=GREEN, thickness=1.2))
story.append(Paragraph("Document généré automatiquement depuis le code de l'application EFYL AddressBook — Août 2026.",
                       ParagraphStyle("f", parent=subtitle_s, fontSize=8)))

doc = SimpleDocTemplate(
    "/app/memory/EFYL_Questionnaires_Complets_FR.pdf",
    pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
    title="EFYL — Référentiel complet des questionnaires",
)
doc.build(story)
print("PDF généré : /app/memory/EFYL_Questionnaires_Complets_FR.pdf")
