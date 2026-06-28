"""Generate ultra-detailed EFYL user guide PDF in French.

Output: /app/memory/EFYL_Guide_Utilisateur_Complet_FR.pdf
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    KeepTogether, ListFlowable, ListItem, HRFlowable, Image,
)
from reportlab.pdfgen import canvas
from datetime import date

OUTPUT = "/app/memory/EFYL_Guide_Utilisateur_Complet_FR.pdf"

# ============================================================
# Theme colors (EFYL palette)
# ============================================================
PRIMARY = colors.HexColor("#0D5C3A")   # vert forêt
ACCENT = colors.HexColor("#F97316")    # orange commerce
DARK = colors.HexColor("#1F2937")
GREY = colors.HexColor("#6B7280")
LIGHT_BG = colors.HexColor("#F3F4F6")
SUCCESS = colors.HexColor("#22C55E")
WARN = colors.HexColor("#F59E0B")
ERROR = colors.HexColor("#EF4444")
BLUE = colors.HexColor("#3B82F6")

# ============================================================
# Styles
# ============================================================
styles = getSampleStyleSheet()

cover_title = ParagraphStyle(
    "cover_title", parent=styles["Heading1"],
    fontSize=42, leading=50, alignment=TA_CENTER,
    textColor=PRIMARY, spaceAfter=20,
)
cover_subtitle = ParagraphStyle(
    "cover_subtitle", parent=styles["Heading2"],
    fontSize=18, leading=24, alignment=TA_CENTER,
    textColor=GREY, spaceAfter=10,
)
cover_meta = ParagraphStyle(
    "cover_meta", parent=styles["Normal"],
    fontSize=12, leading=18, alignment=TA_CENTER,
    textColor=DARK,
)
h1 = ParagraphStyle(
    "h1", parent=styles["Heading1"],
    fontSize=24, leading=30, textColor=PRIMARY,
    spaceBefore=12, spaceAfter=12, keepWithNext=1,
)
h2 = ParagraphStyle(
    "h2", parent=styles["Heading2"],
    fontSize=18, leading=24, textColor=PRIMARY,
    spaceBefore=14, spaceAfter=8, keepWithNext=1,
)
h3 = ParagraphStyle(
    "h3", parent=styles["Heading3"],
    fontSize=14, leading=18, textColor=DARK,
    spaceBefore=10, spaceAfter=6, keepWithNext=1,
)
body = ParagraphStyle(
    "body", parent=styles["Normal"],
    fontSize=11, leading=16, alignment=TA_JUSTIFY,
    textColor=DARK, spaceAfter=6,
)
body_left = ParagraphStyle(
    "body_left", parent=body, alignment=TA_LEFT,
)
callout_tip = ParagraphStyle(
    "callout_tip", parent=body,
    leftIndent=12, rightIndent=12,
    borderColor=SUCCESS, borderWidth=0,
    backColor=colors.HexColor("#DCFCE7"),
    textColor=colors.HexColor("#14532D"),
    spaceBefore=6, spaceAfter=6,
)
callout_warn = ParagraphStyle(
    "callout_warn", parent=body,
    leftIndent=12, rightIndent=12,
    borderColor=WARN, borderWidth=0,
    backColor=colors.HexColor("#FEF3C7"),
    textColor=colors.HexColor("#78350F"),
    spaceBefore=6, spaceAfter=6,
)
callout_info = ParagraphStyle(
    "callout_info", parent=body,
    leftIndent=12, rightIndent=12,
    backColor=colors.HexColor("#DBEAFE"),
    textColor=colors.HexColor("#1E3A8A"),
    spaceBefore=6, spaceAfter=6,
)
callout_error = ParagraphStyle(
    "callout_error", parent=body,
    leftIndent=12, rightIndent=12,
    backColor=colors.HexColor("#FEE2E2"),
    textColor=colors.HexColor("#7F1D1D"),
    spaceBefore=6, spaceAfter=6,
)
mono = ParagraphStyle(
    "mono", parent=body,
    fontName="Courier", fontSize=10, leading=13,
    backColor=LIGHT_BG, leftIndent=12, rightIndent=12,
    textColor=DARK, spaceBefore=4, spaceAfter=8,
)
small = ParagraphStyle(
    "small", parent=body, fontSize=9, leading=12, textColor=GREY,
)

# ============================================================
# Reusable builders
# ============================================================

def callout(text, kind="tip"):
    style = {"tip": callout_tip, "warn": callout_warn,
             "info": callout_info, "error": callout_error}[kind]
    return Paragraph(text, style)


def code_block(text):
    return Paragraph(text.replace("\n", "<br/>"), mono)


def bullet_list(items):
    return ListFlowable(
        [ListItem(Paragraph(t, body_left), leftIndent=10) for t in items],
        bulletType="bullet", bulletColor=PRIMARY, leftIndent=18, spaceAfter=8,
    )


def numbered_list(items):
    return ListFlowable(
        [ListItem(Paragraph(t, body_left), leftIndent=10) for t in items],
        bulletType="1", bulletColor=PRIMARY, leftIndent=22, spaceAfter=8,
    )


def hr():
    return HRFlowable(width="100%", thickness=0.6, color=GREY, spaceBefore=6, spaceAfter=6)


def table_2col(rows, col_widths=(5*cm, 11*cm), header_row=True):
    t = Table(rows, colWidths=col_widths, hAlign="LEFT")
    style = [
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5E7EB")),
        ("BACKGROUND", (0, 1), (0, -1), LIGHT_BG),
        ("FONTNAME", (0, 1), (0, -1), "Helvetica-Bold"),
    ]
    if header_row:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ]
    t.setStyle(TableStyle(style))
    return t


def table_3col(rows, col_widths=(4*cm, 7*cm, 5*cm)):
    t = Table(rows, colWidths=col_widths, hAlign="LEFT", repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5E7EB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFAFA")]),
    ]))
    return t

# ============================================================
# Page templates : footer + header
# ============================================================

def on_page(canv, doc):
    canv.saveState()
    # Footer
    canv.setFillColor(GREY)
    canv.setFont("Helvetica", 8)
    canv.drawString(2*cm, 1.2*cm, "EFYL Digital AddressBook — Guide d'Utilisateur Complet (FR)")
    canv.drawRightString(A4[0]-2*cm, 1.2*cm, f"Page {doc.page}")
    # Top thin colored line
    canv.setStrokeColor(PRIMARY)
    canv.setLineWidth(2)
    canv.line(2*cm, A4[1]-1.3*cm, A4[0]-2*cm, A4[1]-1.3*cm)
    canv.restoreState()


def on_cover(canv, doc):
    # Décor de couverture : grand rectangle vert primaire en haut
    canv.saveState()
    canv.setFillColor(PRIMARY)
    canv.rect(0, A4[1]-9*cm, A4[0], 9*cm, fill=1, stroke=0)
    canv.setFillColor(ACCENT)
    canv.rect(0, A4[1]-10*cm, A4[0], 1*cm, fill=1, stroke=0)
    canv.setFillColor(colors.white)
    canv.setFont("Helvetica-Bold", 56)
    canv.drawCentredString(A4[0]/2, A4[1]-5*cm, "EFYL")
    canv.setFont("Helvetica", 16)
    canv.drawCentredString(A4[0]/2, A4[1]-6.5*cm, "Digital AddressBook")
    canv.setFont("Helvetica-Oblique", 12)
    canv.drawCentredString(A4[0]/2, A4[1]-7.5*cm, "Votre adresse. Partout.")
    # Bas de page
    canv.setFillColor(GREY)
    canv.setFont("Helvetica", 8)
    canv.drawCentredString(A4[0]/2, 1*cm, f"Document généré le {date.today().strftime('%d %B %Y')}")
    canv.restoreState()

# ============================================================
# Document build
# ============================================================

doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=2*cm, rightMargin=2*cm,
    topMargin=2*cm, bottomMargin=2*cm,
    title="EFYL — Guide d'Utilisateur Complet",
    author="EFYL Team",
)

story = []

# -------------------------------------------------------
# COVER
# -------------------------------------------------------
story.append(Spacer(1, 11*cm))
story.append(Paragraph("Guide d'Utilisateur Complet", cover_title))
story.append(Spacer(1, 0.2*cm))
story.append(Paragraph("Version 2.1 — Sprint S4", cover_subtitle))
story.append(Spacer(1, 0.6*cm))
story.append(Paragraph(
    "Ce guide vous accompagne pas à pas pour utiliser <b>toutes</b> les fonctionnalités "
    "de l'application EFYL Digital AddressBook, y compris le mode hors-ligne, "
    "les enquêtes guidées Foyer & Commerce, la carte communautaire, le QR Code, "
    "l'export de données et la synchronisation automatique.",
    cover_meta,
))
story.append(Spacer(1, 1*cm))
story.append(Paragraph("📍 🏘️ 🏪 🗺️ 🔲 📤", cover_meta))

story.append(PageBreak())

# -------------------------------------------------------
# TABLE DES MATIÈRES
# -------------------------------------------------------
story.append(Paragraph("Table des matières", h1))
story.append(hr())

toc_rows = [
    ["§", "Section", "Page"],
    ["1", "Introduction au produit", "3"],
    ["2", "Première utilisation : onboarding & permissions", "5"],
    ["3", "Authentification : SMS et mode invité", "7"],
    ["4", "Créer une adresse numérique : le wizard en 5 étapes", "9"],
    ["5", "Enquêtes guidées : Foyer ou Commerce ?", "15"],
    ["6", "Carte interactive et carte communautaire", "19"],
    ["7", "QR Code & partage d'adresse", "22"],
    ["8", "Vérification communautaire", "24"],
    ["9", "Le mode HORS LIGNE expliqué en profondeur", "26"],
    ["10", "Synchronisation automatique et manuelle", "30"],
    ["11", "Export CSV / JSON de vos données", "32"],
    ["12", "Profil & paramètres : langue, données, déconnexion", "33"],
    ["13", "FAQ et dépannage", "35"],
    ["14", "Annexes : glossaire, couleurs, raccourcis", "38"],
]
toc_table = Table(toc_rows, colWidths=(1.5*cm, 12.5*cm, 2*cm))
toc_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), PRIMARY),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
    ("FONTSIZE", (0, 0), (-1, -1), 11),
    ("ALIGN", (0, 0), (0, -1), "CENTER"),
    ("ALIGN", (2, 0), (2, -1), "RIGHT"),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5E7EB")),
]))
story.append(toc_table)

story.append(PageBreak())

# -------------------------------------------------------
# 1. INTRODUCTION
# -------------------------------------------------------
story.append(Paragraph("1. Introduction au produit", h1))
story.append(hr())

story.append(Paragraph("1.1 Qu'est-ce qu'EFYL ?", h2))
story.append(Paragraph(
    "<b>EFYL Digital AddressBook</b> est une application mobile <b>hors-ligne d'abord</b> "
    "conçue pour créer, partager et vérifier des <b>adresses numériques précises</b> dans les "
    "zones de l'Afrique Sub-Saharienne — et au-delà — où la nomenclature de rues classique "
    "est inexistante, partielle ou obsolète.",
    body))

story.append(Paragraph("1.2 Pourquoi cette application ?", h2))
story.append(Paragraph(
    "Dans des centaines de quartiers, livrer un colis, faire venir une ambulance, ou simplement "
    "indiquer où l'on habite reste un casse-tête. EFYL résout ce problème en trois mouvements :",
    body))
story.append(numbered_list([
    "<b>Créer</b> une adresse unique en se tenant devant sa porte (ex : <font face='Courier'>BES-AKW-3-12</font>) en moins d'une minute.",
    "<b>Partager</b> cette adresse via WhatsApp, SMS, email ou un simple QR code imprimable.",
    "<b>Vérifier</b> et certifier collectivement la position pour qu'elle soit fiable pour tous (livreurs, secours, planification urbaine).",
]))

story.append(Paragraph("1.3 À qui s'adresse cette application ?", h2))
story.append(table_2col([
    ["Profil", "Bénéfice principal"],
    ["Particuliers / Foyers", "Enregistrer leur logement et le partager facilement par SMS ou QR code."],
    ["Commerçants", "Rendre leur boutique trouvable par tout le quartier sur la carte communautaire."],
    ["ONG & humanitaires", "Recenser des bénéficiaires sur le terrain, même sans réseau."],
    ["Mairies & services postaux", "Disposer d'un registre numérique de référence."],
    ["Livreurs & services d'urgence", "Atteindre la bonne porte du premier coup."],
    ["Chercheurs & statisticiens", "Exploiter des données géo-référencées pour études socio-économiques."],
]))

story.append(Paragraph("1.4 Les 6 grands principes du produit", h2))
story.append(table_2col([
    ["Principe", "Ce que ça signifie pour vous"],
    ["Hors-ligne d'abord", "Tout marche sans Internet. Le réseau est un bonus, pas une condition."],
    ["Confidentialité par défaut", "Vos enquêtes Foyer restent <b>strictement privées</b>. Vous seul les voyez."],
    ["Commerces publics", "Vos enquêtes Commerce sont <b>volontairement partagées</b> avec la communauté."],
    ["Précision GPS", "Mesure multi-échantillons jusqu'à 1 m de précision (parfois moins)."],
    ["Vérification communautaire", "Les autres utilisateurs peuvent confirmer ou signaler vos adresses."],
    ["Multilingue", "Français et Anglais. Bascule instantanée."],
]))

story.append(PageBreak())

# -------------------------------------------------------
# 2. PREMIÈRE UTILISATION
# -------------------------------------------------------
story.append(Paragraph("2. Première utilisation : onboarding & permissions", h1))
story.append(hr())

story.append(Paragraph("2.1 L'écran d'accueil — Onboarding", h2))
story.append(Paragraph(
    "Au premier lancement, l'application affiche un <b>carrousel de 3 écrans</b> qui présente :",
    body))
story.append(bullet_list([
    "<b>Slide 1</b> : <i>« Créez votre adresse en un instant »</i> — illustration GPS + porte.",
    "<b>Slide 2</b> : <i>« Partagez par QR Code, SMS, WhatsApp »</i> — démonstration partage.",
    "<b>Slide 3</b> : <i>« Vérifiez en communauté »</i> — illustration carte avec pins multiples.",
]))
story.append(Paragraph(
    "En haut à gauche, un bouton <b>« FR / EN »</b> permet de basculer la langue à tout moment. "
    "Votre choix est mémorisé.",
    body))
story.append(callout(
    "<b>💡 Astuce</b> — Appuyez sur <b>« Passer »</b> en haut à droite pour aller directement "
    "à l'écran suivant si vous connaissez déjà l'application.",
    "tip"))

story.append(Paragraph("2.2 Les permissions du téléphone", h2))
story.append(Paragraph(
    "EFYL a besoin de votre autorisation pour accéder à certaines fonctions du téléphone. "
    "Les demandes sont faites <b>au moment de l'utilisation</b>, pas toutes au démarrage :",
    body))

story.append(table_3col([
    ["Permission", "Quand est-elle demandée ?", "Obligatoire ?"],
    ["📍 Localisation GPS", "Lors de la 1ère mesure d'adresse (étape 1 du wizard).", "✅ Oui"],
    ["📷 Caméra", "Lors de la 1ère prise de photo OU 1er scan de QR.", "❌ Optionnel"],
    ["🧭 Capteur de boussole", "Lors de la verrouillage de la direction de l'entrée.", "❌ Optionnel"],
    ["💾 Stockage", "Pour télécharger les exports CSV/JSON.", "❌ Au besoin"],
]))

story.append(callout(
    "<b>⚠️ Important</b> — Si vous refusez la permission GPS, l'application affichera un message "
    "d'erreur et vous redirigera vers les <b>Paramètres système</b> via un bouton dédié. Une fois "
    "réautorisée, revenez dans EFYL et la mesure reprendra.",
    "warn"))

story.append(Paragraph("2.3 Activer le mode invité (sans login)", h2))
story.append(Paragraph(
    "À la fin de l'onboarding, vous avez le choix entre :",
    body))
story.append(bullet_list([
    "<b>Se connecter par SMS</b> — vous recevez un code à 6 chiffres et vous êtes identifié (utile pour "
    "synchroniser sur plusieurs téléphones).",
    "<b>Continuer en invité</b> — tout fonctionne sauf que vos données restent sous l'identifiant "
    "<font face='Courier'>guest</font>. Vous pouvez vous connecter plus tard sans perdre vos données.",
]))

story.append(PageBreak())

# -------------------------------------------------------
# 3. AUTHENTIFICATION
# -------------------------------------------------------
story.append(Paragraph("3. Authentification : SMS et mode invité", h1))
story.append(hr())

story.append(Paragraph("3.1 Connexion par SMS (OTP)", h2))
story.append(Paragraph(
    "L'authentification utilise le système <b>OTP</b> (One Time Password — code à usage unique).",
    body))
story.append(numbered_list([
    "Saisissez votre <b>numéro de téléphone au format international</b>. Exemple Cameroun : "
    "<font face='Courier'>+237 6XX XX XX XX</font>. L'app accepte aussi <font face='Courier'>+33 6 12 34 56 78</font>, etc.",
    "Appuyez sur <b>« Envoyer le code »</b>.",
    "Vous recevez un code à <b>6 chiffres</b> par SMS (ou affiché à l'écran en mode démo).",
    "Saisissez le code dans le champ OTP puis <b>« Vérifier »</b>.",
    "Une fois validé, vous êtes redirigé vers l'<b>Accueil</b>.",
]))

story.append(callout(
    "<b>🎟️ Mode démo actuel</b> — Tant que Twilio n'est pas activé, le code <b>123456</b> "
    "fonctionne pour <b>n'importe quel numéro</b>. Cette information est affichée sur l'écran "
    "de login pour que vous ne soyez jamais bloqué.",
    "info"))

story.append(Paragraph("3.2 Protection anti-spam (rate-limit)", h2))
story.append(Paragraph(
    "Pour éviter qu'un attaquant n'envoie 1000 SMS en boucle, l'app limite à <b>3 demandes "
    "de code OTP par numéro et par tranche de 10 minutes</b>. Au 4ème essai, vous recevez :",
    body))
story.append(code_block(
    "Erreur 429 — Trop de requêtes. Veuillez réessayer dans 10 minutes."
))

story.append(Paragraph("3.3 Code OTP erroné", h2))
story.append(Paragraph(
    "Si vous tapez un mauvais code, l'app affiche <b>« Code invalide »</b> et ne vous connecte "
    "pas. Vous pouvez retaper le code, ou demander un nouveau code si vous pensez l'avoir perdu.",
    body))

story.append(Paragraph("3.4 Continuer en mode invité", h2))
story.append(Paragraph(
    "Le mode invité est une porte d'entrée express pour explorer l'application sans engagement :",
    body))
story.append(bullet_list([
    "Toutes les fonctions de création / enquête / QR sont disponibles.",
    "Vos données sont sauvegardées <b>localement</b> sur ce téléphone, identifiées par "
    "<font face='Courier'>owner_id = guest</font>.",
    "Quand vous décidez de vous connecter plus tard, les données sont <b>migrées automatiquement</b> "
    "vers votre vrai compte (sur la prochaine synchronisation).",
]))

story.append(Paragraph("3.5 Se déconnecter", h2))
story.append(Paragraph(
    "Depuis l'onglet <b>Profil</b>, cliquez sur <b>« Se déconnecter »</b>. Vos données restent "
    "stockées localement et sur le serveur ; vous serez juste invité à vous reconnecter au "
    "prochain lancement.",
    body))

story.append(PageBreak())

# -------------------------------------------------------
# 4. CRÉER UNE ADRESSE
# -------------------------------------------------------
story.append(Paragraph("4. Créer une adresse numérique : le wizard en 5 étapes", h1))
story.append(hr())

story.append(Paragraph(
    "C'est <b>LE</b> cœur de l'application. Le wizard vous guide étape par étape, avec des "
    "indicateurs visuels clairs (couleur du pin GPS, satellites verrouillés, barre de progression).",
    body))

story.append(Paragraph("Avant de commencer", h2))
story.append(bullet_list([
    "Placez-vous <b>physiquement devant la porte d'entrée</b> du bâtiment à enregistrer.",
    "Ne couvrez pas le téléphone (sortez de sous un toit en tôle si possible — meilleur signal).",
    "Si possible, attendez 10 à 20 secondes que les satellites se verrouillent avant d'appuyer "
    "sur « Confirmer ».",
]))

# Étape 1
story.append(Paragraph("Étape 1 — Mesurer la position GPS de la porte 📍", h2))
story.append(Paragraph(
    "L'app commence à <b>échantillonner votre position</b> de manière continue. Chaque seconde, "
    "elle prend une nouvelle lecture et calcule une moyenne pondérée filtrée (Kalman simplifié) "
    "pour gommer les erreurs ponctuelles.",
    body))

story.append(Paragraph("Ce que vous voyez à l'écran :", h3))
story.append(bullet_list([
    "Un <b>cercle de précision</b> (vert / jaune / rouge) selon la qualité du signal.",
    "Le <b>nombre de satellites verrouillés</b> (typiquement 4 à 12 — plus c'est haut, mieux c'est).",
    "Les coordonnées <b>latitude / longitude</b> en degrés décimaux mises à jour en temps réel.",
    "La <b>précision en mètres</b> (souhaité ≤ 1 m, acceptable jusqu'à 5 m).",
]))

story.append(Paragraph("Code couleur du pin GPS :", h3))
story.append(table_3col([
    ["Couleur", "Précision", "Conseil"],
    ["🟢 Vert", "≤ 1 m", "Excellent ! Vous pouvez confirmer."],
    ["🟡 Jaune", "1 à 5 m", "Acceptable. Attendez encore un peu pour améliorer."],
    ["🔴 Rouge", "> 5 m", "Faible. Bougez de quelques mètres ou attendez."],
    ["⚪ Gris", "Inconnue", "Pas encore de signal — patientez 10 à 20 s."],
]))

story.append(Paragraph("Quand appuyer sur « Confirmer la Position GPS » ?", h3))
story.append(Paragraph(
    "Idéalement quand le pin est <b>vert</b> et stable depuis 5 à 10 secondes. Si la précision "
    "stagne en jaune (par exemple en intérieur, sous des arbres denses, ou dans une ruelle entre "
    "deux immeubles), un bouton <b>« Sauvegarder quand même »</b> apparaît après 30 secondes.",
    body))

story.append(callout(
    "<b>⚠️ Attention</b> — Si vous sauvegardez avec une précision > 5 m, l'adresse sera marquée "
    "comme <b>« Précision faible »</b> avec un badge rouge. Vous (ou un autre utilisateur) "
    "pourrez la corriger plus tard via la fonction <b>« Vérifier l'adresse »</b>.",
    "warn"))

# Étape 2
story.append(Paragraph("Étape 2 — Détails de l'adresse 📝", h2))
story.append(Paragraph(
    "Une fois la position confirmée, l'application interroge automatiquement le service "
    "<b>Nominatim (OpenStreetMap)</b> pour <b>auto-détecter le quartier</b>. Si vous êtes hors-ligne, "
    "ce champ reste vide — vous le saisirez à la main.",
    body))

story.append(Paragraph("Champs à remplir :", h3))
story.append(table_2col([
    ["Champ", "Description"],
    ["Quartier", "Préfixe du code (ex: BES pour Bessengue). Auto-détecté."],
    ["Secteur", "Code de zone interne (ex: AKW). Saisi par vous."],
    ["Numéro de rue", "Identifiant de la rue (chiffre)."],
    ["Numéro de maison", "Le numéro de votre porte sur la rue."],
    ["Nom du contact", "Votre nom ou celui du propriétaire (optionnel)."],
    ["Téléphone", "Numéro pour vous joindre (optionnel)."],
    ["Notes", "Tout détail utile : « porte rouge en face de la pharmacie »."],
]))
story.append(callout(
    "<b>💡 Construction de l'ID unique</b> — L'ID d'adresse final est généré "
    "automatiquement sous la forme <font face='Courier'>QUARTIER-SECTEUR-RUE-MAISON</font>, "
    "exemple : <font face='Courier'>BES-AKW-3-12</font>. C'est cet ID que vous partagerez.",
    "tip"))

# Étape 3
story.append(Paragraph("Étape 3 — Direction d'entrée & Photo 🧭📷", h2))
story.append(Paragraph(
    "Cette étape <b>optionnelle</b> mais très utile permet de capturer deux informations clés :",
    body))

story.append(Paragraph("3.A — Azimut (boussole)", h3))
story.append(numbered_list([
    "Tenez le téléphone à plat, écran vers le haut.",
    "<b>Pointez le haut du téléphone vers la porte d'entrée</b> du bâtiment.",
    "Une boussole animée s'affiche, avec un angle en degrés (0° = Nord, 90° = Est, 180° = Sud, 270° = Ouest).",
    "Appuyez sur <b>« Verrouiller la direction »</b>. L'angle est enregistré.",
]))
story.append(Paragraph(
    "Cet azimut sera affiché aux futurs visiteurs sous la forme : <i>« L'entrée pointe vers le Nord-Est (45°) »</i>.",
    body))

story.append(Paragraph("3.B — Photo du bâtiment", h3))
story.append(numbered_list([
    "Appuyez sur <b>« Prendre une photo »</b>.",
    "La caméra s'ouvre. Cadrez la façade du bâtiment ou la porte.",
    "Validez. La photo est encodée en <b>base64</b> et stockée localement dans la fiche d'adresse.",
    "Vous pouvez « Reprendre » si la photo n'est pas satisfaisante.",
]))

# Étape 4
story.append(Paragraph("Étape 4 — Correction satellite manuelle 🛰️", h2))
story.append(Paragraph(
    "Parfois, même avec une bonne précision GPS, le point peut être légèrement décalé "
    "(quelques mètres). Cette étape vous permet de <b>corriger manuellement</b> la position sur "
    "une <b>image satellite</b>.",
    body))
story.append(numbered_list([
    "La carte s'ouvre centrée sur la position GPS mesurée, avec un point orange déplaçable.",
    "Basculez en mode <b>« Satellite »</b> via le bouton en haut à droite si nécessaire.",
    "Zoomez (pincement) pour voir clairement votre toit ou votre cour.",
    "<b>Glissez le point orange</b> exactement sur l'endroit voulu.",
    "Appuyez sur <b>« Valider la correction »</b>.",
]))
story.append(callout(
    "<b>📊 Donnée préservée</b> — La position GPS brute (<font face='Courier'>lat_raw / lng_raw</font>) "
    "et la position corrigée (<font face='Courier'>lat_corrected / lng_corrected</font>) sont "
    "stockées séparément. Personne ne perd jamais la donnée brute originale.",
    "info"))

# Étape 5
story.append(Paragraph("Étape 5 — Vérification finale et enregistrement ✅", h2))
story.append(Paragraph(
    "L'écran récapitulatif affiche <b>toutes les informations</b> saisies :",
    body))
story.append(bullet_list([
    "Position GPS (brute et corrigée si applicable).",
    "Précision mesurée + badge.",
    "ID d'adresse généré.",
    "Quartier / secteur / rue / numéro.",
    "Direction (azimut).",
    "Photo (miniature).",
]))
story.append(Paragraph(
    "Vous pouvez <b>revenir en arrière</b> sur chaque étape via les onglets en haut. Quand tout "
    "est correct, appuyez sur <b>« Enregistrer »</b>.",
    body))
story.append(callout(
    "<b>✅ Que se passe-t-il après ?</b><br/>"
    "1. L'adresse est sauvegardée dans le stockage local <b>instantanément</b>.<br/>"
    "2. Elle apparaît dans l'écran <b>Accueil</b>.<br/>"
    "3. Une opération <b>« CREATE »</b> est ajoutée à la file de synchronisation.<br/>"
    "4. Si vous êtes en ligne, la sync se déclenche automatiquement.<br/>"
    "5. L'app vous propose immédiatement de <b>démarrer l'enquête</b> Foyer ou Commerce.",
    "tip"))

story.append(PageBreak())

# -------------------------------------------------------
# 5. ENQUÊTES
# -------------------------------------------------------
story.append(Paragraph("5. Enquêtes guidées : Foyer ou Commerce ?", h1))
story.append(hr())

story.append(Paragraph(
    "Juste après la création de l'adresse, l'application vous propose de remplir une <b>enquête</b>. "
    "Cette enquête enrichit votre fiche avec des informations socio-économiques (Foyer) ou "
    "commerciales (Commerce). Elle est <b>optionnelle</b> mais grandement recommandée — "
    "c'est ce qui rend votre adresse vraiment utile à la communauté ou aux statistiques.",
    body))

story.append(Paragraph("5.1 La 1ère question : Foyer ou Commerce ?", h2))
story.append(Paragraph(
    "Vous voyez <b>deux grandes cartes</b> côte-à-côte :",
    body))

story.append(table_2col([
    ["🏠 Foyer", "🏪 Commerce"],
    [
     "<b>Maison d'habitation</b>.<br/>Données <b>privées</b> — visibles "
     "<b>par vous uniquement</b>.<br/>19 étapes (personnes, équipements, matériaux...).",
     "<b>Boutique, atelier, clinique, restaurant...</b>.<br/>Données <b>publiques</b> — "
     "partagées avec <b>toute la communauté</b>.<br/>3 étapes seulement (info commerce + horaires)."],
]))

story.append(callout(
    "<b>🔒 Important pour la vie privée</b> — Cette distinction est cruciale. Si vous choisissez "
    "« Foyer », <b>JAMAIS</b> aucun autre utilisateur ne verra ces informations. Si vous choisissez "
    "« Commerce », votre boutique sera <b>visible par tous</b> sur la carte communautaire, "
    "exactement comme une boutique sur Google Maps.",
    "warn"))

story.append(Paragraph("5.2 Parcours Foyer — 19 étapes", h2))
story.append(Paragraph(
    "Si vous choisissez <b>Foyer</b>, le wizard vous fait passer par les étapes suivantes :",
    body))

household_steps = [
    ("Personnes totales", "Nombre d'habitants total du foyer (par exemple 5)."),
    ("Source principale de revenus", "Texte libre : « Commerce », « Agriculture », « Fonction publique »..."),
    ("Autres sources de revenus", "Texte libre, séparées par des virgules."),
    ("Niveau de revenu", "Choix : Très faible / Faible / Moyen / Élevé."),
    ("Téléphones", "Nombre de téléphones dans le foyer (smartphones + classiques)."),
    ("Internet", "Oui / Non — Avez-vous une connexion Internet à la maison ?"),
    ("Électricité", "Stable / Instable / Aucune."),
    ("Eau", "Stable / Instable / Aucune."),
    ("Toilettes", "Chasse d'eau / Traditionnelles / Autre (champ texte si Autre)."),
    ("Cuisine", "Position : Dans une chambre / Dans le salon / Séparée."),
    ("Pièces de vie", "Nombre total de salons / pièces à vivre."),
    ("Étages", "Nombre d'étages du bâtiment."),
    ("Murs", "Béton / Adobe / Bois / Autre."),
    ("Fenêtres vitrées", "Oui / Non."),
    ("Toiture", "Tôle / Bois / Plastique / Béton / Autre."),
    ("Véhicules", "Sous-questions : vélos, motos, voitures, camions."),
    ("Introduction personnes", "Écran d'intro avant la saisie de chaque personne."),
    ("Fiche personne (répétée)", "Nom, téléphone ou email, âge, genre, éducation, profession, lieu fréquenté."),
    ("Récapitulatif", "Résumé complet et bouton « Enregistrer »."),
]
story.append(table_2col([
    ["Étape", "Description"],
    *[[str(i+1) + ". " + s[0], s[1]] for i, s in enumerate(household_steps)],
]))

story.append(callout(
    "<b>💡 Astuce</b> — Pour les personnes, vous pouvez en ajouter autant que vous voulez. "
    "Appuyez sur <b>« + Ajouter une personne »</b> après chaque fiche. Quand vous avez fini, "
    "<b>« Terminer la saisie »</b> vous amène au récapitulatif.",
    "tip"))

story.append(Paragraph("5.3 Parcours Commerce — 3 étapes", h2))
story.append(Paragraph(
    "Si vous choisissez <b>Commerce</b>, le wizard est beaucoup plus court — il suffit de remplir "
    "les informations utiles aux futurs clients :",
    body))

story.append(table_2col([
    ["Étape", "Champs à remplir"],
    ["1. Choix Foyer/Commerce", "(Déjà fait — vous avez choisi Commerce)"],
    ["2. Informations commerce",
     "<b>Nom du commerce</b> (obligatoire), <b>Propriétaire</b>, <b>Téléphone</b>, "
     "<b>Produits/activité</b>, <b>Horaires Lun-Ven</b>, <b>Horaires Samedi</b>, <b>Horaires Dimanche</b>."],
    ["3. Récapitulatif", "Vérification + bouton « Enregistrer »."],
]))

story.append(Paragraph("5.4 Que devient l'enquête après enregistrement ?", h2))
story.append(numbered_list([
    "Elle est stockée <b>localement</b> dans AsyncStorage (clé <font face='Courier'>surveys</font>).",
    "Une opération <b>UPSERT</b> est ajoutée à la file de sync (clé <font face='Courier'>survey_queue</font>).",
    "L'adresse liée est marquée comme <font face='Courier'>has_survey=true</font>.",
    "Si vous avez choisi Commerce, l'adresse est aussi marquée <font face='Courier'>is_commerce=true</font> "
    "et devient <b>publique automatiquement</b> dès la prochaine synchronisation.",
    "Sur la fiche d'adresse, un <b>badge 🏪 Commerce</b> apparaît.",
]))

story.append(PageBreak())

# -------------------------------------------------------
# 6. CARTE
# -------------------------------------------------------
story.append(Paragraph("6. Carte interactive et carte communautaire", h1))
story.append(hr())

story.append(Paragraph("6.1 Ouvrir la carte", h2))
story.append(Paragraph(
    "Appuyez sur l'onglet <b>Carte</b> en bas de l'écran. La carte (basée sur Leaflet + "
    "OpenStreetMap) s'ouvre, centrée automatiquement sur l'ensemble de vos adresses.",
    body))

story.append(Paragraph("6.2 Comprendre les pins (épingles)", h2))
story.append(table_3col([
    ["Couleur du pin", "Signification", "Cliquable ?"],
    ["🟢 Vert", "Adresse <b>vérifiée</b> par la communauté.", "✅ Oui — ouvre la fiche."],
    ["🟡 Jaune", "Adresse créée mais <b>non encore vérifiée</b>.", "✅ Oui."],
    ["🔴 Rouge", "Adresse <b>signalée 3 fois ou plus</b> (suspecte).", "✅ Oui."],
    ["⚪ Gris", "Adresse avec <b>précision faible</b> (> 5 m).", "✅ Oui."],
    ["🟠 Orange", "Commerce de la <b>communauté</b> (partagé par tous).", "✅ Oui."],
]))

story.append(Paragraph("6.3 Toggle « Commerces communauté »", h2))
story.append(Paragraph(
    "Juste sous l'en-tête de la carte, un bouton avec l'icône 🏪 affiche / masque "
    "<b>les commerces partagés par tous les autres utilisateurs</b>. "
    "Par défaut, ce bouton est <b>activé</b> (vous voyez les commerces communautaires).",
    body))

story.append(callout(
    "<b>💡 Bon à savoir</b> — Quand le toggle est activé, vous voyez aussi bien <b>vos</b> "
    "adresses (foyers + commerces) <b>que</b> les commerces partagés par les autres. "
    "Quand il est désactivé, seules vos adresses apparaissent. Les foyers des autres utilisateurs "
    "ne sont <b>JAMAIS</b> visibles, peu importe le toggle.",
    "tip"))

story.append(Paragraph("6.4 Basculer Plan ⇄ Satellite", h2))
story.append(Paragraph(
    "En haut à droite de la carte, deux boutons :",
    body))
story.append(bullet_list([
    "<b>« Plan »</b> — affichage classique OpenStreetMap (rues, bâtiments dessinés).",
    "<b>« Satellite »</b> — image aérienne haute résolution (Esri World Imagery).",
]))
story.append(Paragraph(
    "Le mode Satellite est très utile pour vérifier visuellement le bâtiment et corriger "
    "la position si nécessaire.",
    body))

story.append(Paragraph("6.5 Zoomer, dézoomer, naviguer", h2))
story.append(numbered_list([
    "<b>Zoom</b> : pincez avec deux doigts (zoom in) ou écartez deux doigts (zoom out).",
    "<b>Déplacement</b> : glissez avec un doigt.",
    "<b>Recentrer sur ma position</b> : icône cible en bas à droite.",
    "<b>Cliquer un pin</b> : ouvre une bulle popup avec le nom et l'ID, et un bouton « Voir la fiche »."
]))

story.append(Paragraph("6.6 Comportement hors-ligne de la carte", h2))
story.append(callout(
    "<b>⚠️ Limitation actuelle</b> — La carte Leaflet télécharge les <b>tuiles</b> (petites "
    "images) depuis OpenStreetMap au moment de l'affichage. Hors-ligne, seules les tuiles déjà "
    "consultées récemment restent visibles. Les zones non encore consultées apparaissent en blanc. "
    "Les <b>pins (vos données)</b> restent quant à eux parfaitement affichés.",
    "warn"))

story.append(PageBreak())

# -------------------------------------------------------
# 7. QR CODE & PARTAGE
# -------------------------------------------------------
story.append(Paragraph("7. QR Code & partage d'adresse", h1))
story.append(hr())

story.append(Paragraph("7.1 Générer le QR Code d'une adresse", h2))
story.append(numbered_list([
    "Depuis l'écran <b>Accueil</b>, cliquez sur une adresse pour ouvrir sa fiche.",
    "Appuyez sur le bouton <b>« QR Code »</b> en haut à droite.",
    "Un grand QR Code apparaît à l'écran, accompagné de l'ID d'adresse en clair.",
]))
story.append(Paragraph(
    "Le QR contient une URL spéciale <font face='Courier'>efyl://address/BES-AKW-3-12</font> qui, "
    "scannée par n'importe quel téléphone ayant EFYL installé, ouvre directement la fiche de "
    "l'adresse correspondante.",
    body))

story.append(Paragraph("7.2 Partager via WhatsApp / SMS / Email", h2))
story.append(Paragraph(
    "Sous le QR Code, plusieurs boutons de partage :",
    body))
story.append(table_2col([
    ["Bouton", "Comportement"],
    ["📱 WhatsApp", "Ouvre WhatsApp avec un message pré-rempli contenant l'ID d'adresse et un lien."],
    ["💬 SMS", "Ouvre l'app SMS avec le message pré-rempli."],
    ["📧 Email", "Ouvre votre client email avec sujet et corps pré-remplis."],
    ["📤 Partage générique", "Affiche le menu de partage natif du système (Bluetooth, AirDrop, etc.)."],
]))

story.append(Paragraph("7.3 Scanner un QR Code d'un autre utilisateur", h2))
story.append(numbered_list([
    "Allez dans l'onglet <b>Scanner</b> (icône appareil photo).",
    "Autorisez l'accès à la caméra si demandé.",
    "Pointez la caméra sur le QR Code à scanner.",
    "L'app détecte automatiquement le QR et affiche les informations de l'adresse.",
    "Trois options apparaissent : <b>« Ajouter à mon carnet »</b>, <b>« Voir l'itinéraire »</b>, "
    "<b>« Ignorer »</b>.",
]))
story.append(callout(
    "<b>📍 Itinéraire</b> — Le bouton « Voir l'itinéraire » ouvre votre application de navigation "
    "préférée (Google Maps, Waze, Apple Plans...) avec la destination déjà saisie aux coordonnées GPS.",
    "tip"))

story.append(Paragraph("7.4 Imprimer un QR Code", h2))
story.append(Paragraph(
    "Vous pouvez aussi <b>imprimer</b> le QR Code sur un autocollant à coller à votre porte. "
    "Sur l'écran QR, le bouton <b>« Télécharger PNG »</b> sauvegarde l'image dans votre galerie, "
    "que vous pouvez ensuite imprimer depuis n'importe quel cybercafé ou imprimante familiale.",
    body))

story.append(PageBreak())

# -------------------------------------------------------
# 8. VÉRIFICATION COMMUNAUTAIRE
# -------------------------------------------------------
story.append(Paragraph("8. Vérification communautaire", h1))
story.append(hr())

story.append(Paragraph("8.1 Pourquoi vérifier ?", h2))
story.append(Paragraph(
    "Le système de vérification croisée est ce qui rend EFYL <b>fiable à long terme</b>. "
    "Si quelqu'un crée une adresse approximative ou fausse, d'autres utilisateurs peuvent la "
    "corriger, et l'adresse se voit <b>certifiée</b> ou <b>signalée</b>.",
    body))

story.append(Paragraph("8.2 Comment vérifier une adresse", h2))
story.append(numbered_list([
    "Rendez-vous <b>physiquement</b> à l'adresse à vérifier (ou très proche).",
    "Ouvrez la fiche de l'adresse (depuis votre carnet ou en scannant le QR de quelqu'un).",
    "Appuyez sur <b>« Vérifier cette adresse »</b>.",
    "L'app mesure votre position GPS actuelle.",
    "Elle calcule la <b>distance haversine</b> entre votre position et celle enregistrée.",
    "Appuyez sur <b>« Soumettre »</b>.",
]))

story.append(Paragraph("8.3 Que se passe-t-il après ?", h2))
story.append(table_2col([
    ["Distance mesurée", "Résultat"],
    ["≤ 10 mètres",
     "<b>Adresse VÉRIFIÉE ✓</b><br/>Le pin devient <b>vert</b>. L'app affiche : "
     "<i>« Position vérifiée — merci ! »</i>"],
    ["> 10 mètres",
     "<b>Adresse signalée</b><br/>Le compteur <font face='Courier'>flag_count</font> est "
     "incrémenté. L'app affiche : <i>« Position signalée — merci pour le retour ! »</i>"],
    ["Après 3 signalements",
     "<b>Adresse marquée SUSPECTE</b><br/>Le pin devient <b>rouge</b>. "
     "Le propriétaire peut alors la corriger via le wizard."],
]))

story.append(callout(
    "<b>🤝 Esprit du système</b> — La vérification est <b>volontaire et bienveillante</b>. "
    "Elle ne remplace pas le créateur de l'adresse, elle <b>complète</b> sa confiance. "
    "Chaque vérification renforce ou nuance la fiabilité globale de la base.",
    "info"))

story.append(PageBreak())

# -------------------------------------------------------
# 9. MODE HORS LIGNE — LE CŒUR DU GUIDE
# -------------------------------------------------------
story.append(Paragraph("9. Le mode HORS LIGNE expliqué en profondeur", h1))
story.append(hr())

story.append(callout(
    "<b>📌 Section essentielle</b> — Le mode hors-ligne est la <b>signature</b> d'EFYL. "
    "Cette section explique pas à pas comment ça marche techniquement, pour que vous "
    "compreniez ce qui se passe sous le capot.",
    "info"))

story.append(Paragraph("9.1 Le principe fondamental : Offline-First", h2))
story.append(Paragraph(
    "EFYL est conçue selon le paradigme <b>Offline-First</b> : la connexion réseau est un "
    "<b>bonus optionnel</b>, jamais une condition de fonctionnement. Toutes les opérations "
    "essentielles — créer, modifier, supprimer, photographier, partager — passent d'abord "
    "par le stockage local, puis sont synchronisées <b>en différé</b> avec le serveur dès que "
    "le réseau redevient disponible.",
    body))

story.append(Paragraph("9.2 Le GPS fonctionne SANS Internet", h2))
story.append(Paragraph(
    "C'est une idée fausse très répandue : <b>le GPS n'a pas besoin d'Internet</b>. Voici "
    "pourquoi :",
    body))
story.append(bullet_list([
    "Le GPS de votre téléphone reçoit directement les signaux des satellites en orbite "
    "(<b>GPS américain</b>, <b>GLONASS russe</b>, <b>Galileo européen</b>, <b>BeiDou chinois</b>).",
    "Ces satellites émettent <b>en continu</b>, et votre téléphone capte leurs signaux par antenne.",
    "Le téléphone calcule lui-même votre position par <b>triangulation</b> (distance × temps).",
    "<b>Résultat</b> : même au fond de la brousse au Cameroun ou dans le désert, sans aucune carte "
    "réseau, votre position est connue à 1-5 mètres près.",
]))
story.append(callout(
    "<b>🛰️ Détail technique</b> — Le GPS « assisté » (A-GPS) utilise le réseau cellulaire "
    "pour pré-charger plus rapidement les éphémérides satellites. Sans réseau, l'acquisition "
    "du premier point peut prendre 30-60 secondes au lieu de 5-10. Mais une fois acquis, "
    "tout fonctionne identiquement.",
    "info"))

story.append(Paragraph("9.3 Le stockage local : AsyncStorage", h2))
story.append(Paragraph(
    "Toutes vos données sont stockées dans <b>AsyncStorage</b>, le système de stockage clé/valeur "
    "persistant fourni par React Native (équivalent de localStorage pour le mobile). Voici la "
    "structure des clés utilisées :",
    body))
story.append(table_2col([
    ["Clé AsyncStorage", "Contenu"],
    ["addresses", "Liste JSON de toutes vos adresses créées."],
    ["surveys", "Liste JSON de toutes les enquêtes (Foyer + Commerce)."],
    ["sync_queue", "File d'attente des opérations CREATE / DELETE à synchroniser."],
    ["survey_queue", "File d'attente des opérations UPSERT survey à synchroniser."],
    ["last_sync", "Horodatage de la dernière synchronisation réussie."],
    ["prefs", "Préférences utilisateur (langue, thème, etc.)."],
    ["user", "Identifiant et téléphone de l'utilisateur connecté."],
]))
story.append(Paragraph(
    "<b>Persistance</b> : ces données survivent à la fermeture de l'app, au redémarrage du "
    "téléphone, et même à la mort batterie. Seule une désinstallation de l'app les efface.",
    body))

story.append(Paragraph("9.4 Le cycle de vie d'une adresse créée hors-ligne", h2))
story.append(code_block(
    "1.  Tu cliques 'Enregistrer'\n"
    "    ↓\n"
    "2.  L'app stocke l'adresse dans AsyncStorage (clé 'addresses')\n"
    "    ↓\n"
    "3.  L'app ajoute une opération dans 'sync_queue'\n"
    "    Format : [{action: 'CREATE', payload: {...}, ts: ...}]\n"
    "    ↓\n"
    "4.  Confirmation IMMÉDIATE à l'utilisateur ('Adresse créée !')\n"
    "    ↓\n"
    "5.  L'utilisateur peut continuer à créer d'autres adresses\n"
    "    pendant des jours sans réseau\n"
    "    ↓\n"
    "6.  Quand le réseau revient (détecté par NetInfo) :\n"
    "    a. processSyncQueue() est déclenché\n"
    "    b. Chaque opération est rejouée vers le backend\n"
    "    c. Le backend confirme ou retourne une erreur\n"
    "    d. Les opérations réussies sont retirées de la queue\n"
    "    e. Les opérations échouées restent pour le prochain essai"
))

story.append(Paragraph("9.5 La détection automatique du réseau (NetInfo)", h2))
story.append(Paragraph(
    "Nous utilisons la bibliothèque <font face='Courier'>@react-native-community/netinfo</font> "
    "qui écoute en permanence l'état du réseau. Voici le code simplifié :",
    body))
story.append(code_block(
    "NetInfo.addEventListener((state) => {\n"
    "  if (state.isConnected && !wasConnected) {\n"
    "    // Le réseau vient de revenir !\n"
    "    processSyncQueue();   // Vider la file\n"
    "    refreshAddresses();   // Rafraîchir depuis serveur\n"
    "    refreshPublicCommerces();\n"
    "  }\n"
    "  wasConnected = state.isConnected;\n"
    "});"
))
story.append(Paragraph(
    "Dès que votre téléphone capte du WiFi, de la 4G ou de la 3G, <b>dans la seconde qui suit</b>, "
    "la file d'attente se vide automatiquement sans aucune intervention de votre part.",
    body))

story.append(Paragraph("9.6 Le géocodage inverse : la seule exception", h2))
story.append(callout(
    "<b>⚠️ ATTENTION</b> — Le <b>géocodage inverse</b> (qui auto-détecte le quartier à partir des "
    "coordonnées GPS) est <b>la seule fonction</b> qui nécessite Internet, car elle appelle "
    "l'API Nominatim d'OpenStreetMap.<br/><br/>"
    "<b>Conséquence hors-ligne</b> : le champ « Quartier » reste vide. Vous le saisissez "
    "manuellement et l'adresse est créée tout à fait normalement.",
    "warn"))

story.append(Paragraph("9.7 Tableau récapitulatif Online vs Offline", h2))
story.append(table_3col([
    ["Fonctionnalité", "Hors-ligne ?", "Notes"],
    ["📍 Mesurer position GPS", "✅ OUI", "Satellites, pas d'Internet."],
    ["💾 Créer une adresse", "✅ OUI", "AsyncStorage immédiat."],
    ["📝 Enquête Foyer/Commerce", "✅ OUI", "AsyncStorage immédiat."],
    ["📷 Prendre photo bâtiment", "✅ OUI", "Caméra locale."],
    ["🧭 Boussole (azimut)", "✅ OUI", "Capteur local du téléphone."],
    ["🔲 Générer QR code", "✅ OUI", "Calcul 100% local."],
    ["📤 Partager par WhatsApp/SMS", "⚠️ Partiel", "Ouvre l'app — envoi quand réseau revient."],
    ["🏘️ Auto-détection quartier", "❌ NON", "Besoin de Nominatim."],
    ["🗺️ Nouvelles tuiles de carte", "❌ NON", "Besoin OSM."],
    ["☁️ Sync vers backend", "❌ NON", "Mais auto au retour réseau."],
    ["📞 Login SMS Twilio", "❌ NON", "Mais mode invité disponible."],
    ["🔍 Scan QR autre utilisateur", "✅ OUI", "Décodage 100% local."],
    ["🏪 Voir commerces communauté", "❌ NON", "Besoin de fetch backend."],
    ["✅ Vérifier une adresse", "❌ NON", "Besoin d'envoyer au backend."],
    ["📁 Export CSV/JSON", "❌ NON", "Endpoint backend."],
]))

story.append(Paragraph("9.8 Que faire en cas de blocage hors-ligne ?", h2))
story.append(bullet_list([
    "<b>Le quartier n'est pas auto-détecté</b> → saisissez-le à la main.",
    "<b>La carte est blanche</b> → la position est quand même mesurée, créez l'adresse, "
    "vous verrez la carte au retour du réseau.",
    "<b>Je ne peux pas voir les commerces communauté</b> → normal, attendez le retour réseau "
    "pour qu'ils se chargent.",
    "<b>Je ne peux pas vérifier une adresse</b> → également normal, faites-le quand le "
    "réseau revient.",
    "<b>Le compteur de la file de sync grandit</b> → c'est <b>normal</b>, ça veut juste dire que "
    "vous avez des opérations en attente. Tout sera envoyé automatiquement au retour réseau.",
]))

story.append(PageBreak())

# -------------------------------------------------------
# 10. SYNCHRONISATION
# -------------------------------------------------------
story.append(Paragraph("10. Synchronisation automatique et manuelle", h1))
story.append(hr())

story.append(Paragraph("10.1 Le voyant de connectivité", h2))
story.append(Paragraph(
    "En haut de l'écran d'accueil :",
    body))
story.append(bullet_list([
    "<b>Aucun voyant</b> → vous êtes en ligne, tout est synchronisé.",
    "<b>Bandeau jaune « Hors ligne »</b> → vous êtes hors-ligne, mais vos données sont sauvegardées localement.",
    "<b>Badge « X en attente »</b> → vous avez X opérations qui attendent la sync.",
]))

story.append(Paragraph("10.2 Sync automatique au retour du réseau", h2))
story.append(Paragraph(
    "Dès que NetInfo détecte le retour de la connexion (WiFi ou cellulaire), la sync se déclenche "
    "sans aucune intervention. Vous verrez :",
    body))
story.append(numbered_list([
    "Le bandeau jaune <b>« Hors ligne »</b> disparaît.",
    "Une notification discrète <b>« Synchronisation… »</b> en bas.",
    "Le compteur d'opérations en attente passe à 0.",
    "L'horodatage <b>« Dernière sync »</b> dans le Profil est mis à jour.",
]))

story.append(Paragraph("10.3 Sync manuelle", h2))
story.append(Paragraph(
    "Si vous voulez forcer la sync (par exemple, vous savez qu'un autre membre de votre équipe "
    "vient de créer des commerces et vous voulez les voir) :",
    body))
story.append(numbered_list([
    "Allez dans l'onglet <b>Profil</b>.",
    "Appuyez sur <b>« Synchroniser maintenant »</b>.",
    "Patientez quelques secondes — un indicateur de progression s'affiche.",
    "Notification de confirmation à la fin.",
]))

story.append(Paragraph("10.4 Que se synchronise exactement ?", h2))
story.append(table_2col([
    ["Direction", "Données concernées"],
    ["Téléphone → Serveur", "Adresses créées, modifiées, supprimées hors-ligne.<br/>Enquêtes Foyer/Commerce.<br/>Vérifications faites hors-ligne (si applicable)."],
    ["Serveur → Téléphone", "Commerces publics récents.<br/>Vérifications faites par d'autres utilisateurs.<br/>Mises à jour de status (vérifié / signalé)."],
]))

story.append(Paragraph("10.5 Conflits et gestion", h2))
story.append(Paragraph(
    "Si vous modifiez une adresse hors-ligne pendant qu'un autre utilisateur la modifie aussi en "
    "ligne, le système applique la règle <b>« Last Write Wins »</b> (la dernière modification "
    "horodatée gagne). Pour les adresses critiques (vérification), le backend privilégie toujours "
    "la <b>donnée la plus récente</b>.",
    body))

story.append(PageBreak())

# -------------------------------------------------------
# 11. EXPORT
# -------------------------------------------------------
story.append(Paragraph("11. Export CSV / JSON de vos données", h1))
story.append(hr())

story.append(Paragraph("11.1 Pourquoi exporter ?", h2))
story.append(bullet_list([
    "Faire une sauvegarde locale sur votre ordinateur.",
    "Analyser vos données dans Excel ou LibreOffice.",
    "Partager une liste d'adresses à un partenaire.",
    "Fournir des données à un service postal, ONG ou mairie.",
]))

story.append(Paragraph("11.2 Comment exporter", h2))
story.append(numbered_list([
    "Allez dans l'onglet <b>Profil</b>.",
    "Section « Mes données ».",
    "Cliquez sur <b>« Exporter en CSV »</b> ou <b>« Exporter en JSON »</b>.",
    "Le fichier est téléchargé dans le dossier <b>Téléchargements</b> de votre téléphone.",
    "Vous pouvez le partager (WhatsApp, email, AirDrop, Google Drive...) ou l'ouvrir directement.",
]))

story.append(Paragraph("11.3 Que contient le fichier CSV ?", h2))
story.append(Paragraph(
    "Le fichier CSV contient une ligne par adresse, avec les colonnes suivantes (et plus) :",
    body))
story.append(code_block(
    "address_id, latitude, longitude, accuracy_meters, lat_raw, lng_raw,\n"
    "lat_corrected, lng_corrected, azimuth_degrees, photo_base64,\n"
    "is_commerce, has_survey, owner_id, district, sector, street_id,\n"
    "house_number, contact_name, contact_phone, notes,\n"
    "verified, flag_count, low_accuracy, created_at,\n"
    "survey_total_persons, survey_main_income_source, survey_electricity,\n"
    "survey_water, survey_walls, survey_roof, ...\n"
    "commerce_name, commerce_owner, commerce_phone, commerce_products,\n"
    "commerce_hours_weekdays, ..."
))

story.append(Paragraph("11.4 Format JSON pour intégrations", h2))
story.append(Paragraph(
    "Le format JSON est plus structuré et permet d'imbriquer les enquêtes et la liste des "
    "personnes. Idéal pour développeurs ou intégrations avec d'autres systèmes (API, base de "
    "données externe...).",
    body))

story.append(PageBreak())

# -------------------------------------------------------
# 12. PROFIL & PARAMÈTRES
# -------------------------------------------------------
story.append(Paragraph("12. Profil & paramètres", h1))
story.append(hr())

story.append(Paragraph("12.1 Accéder au profil", h2))
story.append(Paragraph(
    "Onglet <b>Profil</b> en bas à droite. Vous y trouvez :",
    body))
story.append(bullet_list([
    "Votre <b>numéro de téléphone</b> (ou « Mode invité »).",
    "Vos <b>statistiques personnelles</b> : nombre d'adresses, enquêtes, commerces, vérifications faites.",
    "Le statut <b>de la dernière synchronisation</b>.",
    "Les <b>paramètres</b> : langue, thème, etc.",
    "Les <b>actions</b> : exporter, synchroniser, déconnecter, supprimer données.",
]))

story.append(Paragraph("12.2 Changer la langue", h2))
story.append(numbered_list([
    "Profil → <b>« Langue »</b>.",
    "Choisir <b>Français</b> ou <b>English</b>.",
    "Toute l'application bascule <b>instantanément</b> sans redémarrage.",
]))

story.append(Paragraph("12.3 Supprimer toutes mes données", h2))
story.append(callout(
    "<b>🚨 ACTION IRRÉVERSIBLE</b> — Cette fonction efface <b>toutes</b> vos adresses, enquêtes "
    "et préférences <b>sur ce téléphone</b>. Les données déjà synchronisées au serveur ne sont "
    "<b>pas</b> supprimées côté serveur — contactez l'admin pour ça.",
    "error"))
story.append(numbered_list([
    "Profil → <b>« Supprimer mes données »</b>.",
    "Une confirmation s'affiche : <b>« Êtes-vous sûr ? »</b>.",
    "Tapez « SUPPRIMER » dans le champ de confirmation.",
    "Validez. L'AsyncStorage est vidé. L'app revient à l'écran d'onboarding."
]))

story.append(Paragraph("12.4 Se déconnecter", h2))
story.append(Paragraph(
    "Profil → <b>« Se déconnecter »</b>. Vos données restent sur le téléphone et le serveur. "
    "Au prochain lancement, vous serez invité à vous reconnecter ou à continuer en invité.",
    body))

story.append(PageBreak())

# -------------------------------------------------------
# 13. FAQ
# -------------------------------------------------------
story.append(Paragraph("13. FAQ et dépannage", h1))
story.append(hr())

faqs = [
    ("Mon GPS reste en jaune même après 1 minute, que faire ?",
     "1) Sortez de l'intérieur du bâtiment (le GPS pénètre mal les toits en tôle ou béton).<br/>"
     "2) Éloignez-vous des grands arbres ou des immeubles très hauts.<br/>"
     "3) Si c'est toujours impossible, utilisez le bouton <b>« Sauvegarder quand même »</b>. "
     "L'adresse sera marquée « Précision faible » et vous pourrez la corriger plus tard."),
    ("Le quartier n'est pas auto-détecté quand je crée une adresse.",
     "C'est normal si vous êtes <b>hors-ligne</b>. Le géocodage inverse (Nominatim) nécessite "
     "Internet. Saisissez le quartier manuellement et continuez."),
    ("J'ai créé 30 adresses hors-ligne, est-ce qu'elles sont perdues ?",
     "<b>Non</b>, elles sont sauvegardées localement et seront automatiquement synchronisées "
     "dès que vous aurez du réseau. Vérifiez dans Profil → « Dernière sync »."),
    ("Quelqu'un peut-il voir mes données de foyer (revenus, personnes...) ?",
     "<b>Absolument pas</b>. Les enquêtes Foyer sont strictement privées. Le serveur filtre par "
     "votre <font face='Courier'>owner_id</font> et ne retourne jamais les données d'un autre "
     "utilisateur. Seuls les <b>Commerces</b> sont publics, par votre choix explicite."),
    ("Mon commerce n'apparaît pas sur la carte des autres utilisateurs.",
     "1) Vérifiez que vous avez bien choisi <b>« Commerce »</b> et non « Foyer » lors de la "
     "première étape de l'enquête.<br/>"
     "2) Assurez-vous que la synchronisation a eu lieu (Profil → Synchroniser maintenant).<br/>"
     "3) Demandez à l'autre utilisateur d'activer le toggle <b>« Commerces communauté »</b> sur "
     "la carte."),
    ("Je n'arrive pas à recevoir le code SMS lors du login.",
     "En mode démo actuel, aucun vrai SMS n'est envoyé. Le code <b>123456</b> fonctionne "
     "toujours. Pour recevoir des vrais SMS, l'administrateur doit activer Twilio."),
    ("J'ai supprimé l'app par erreur. Mes données sont-elles perdues ?",
     "Si vous étiez connecté (pas en mode invité) et que la synchronisation a eu lieu, vos "
     "données sont <b>sauvegardées sur le serveur</b>. Réinstallez l'app, connectez-vous, et "
     "elles seront re-téléchargées. Si vous étiez en mode invité, malheureusement les données "
     "sont perdues car elles n'étaient stockées que sur le téléphone."),
    ("La photo du bâtiment est très volumineuse. Comment l'optimiser ?",
     "L'app compresse automatiquement les photos en JPEG avec qualité 70%. Si vous voulez "
     "économiser encore plus de place, choisissez de <b>ne pas prendre de photo</b> à l'étape 3 "
     "(elle est optionnelle)."),
    ("Puis-je utiliser l'app à l'étranger (hors Cameroun) ?",
     "<b>Oui, totalement.</b> L'app fonctionne dans le monde entier. Le GPS marche partout, "
     "et le géocodage inverse (Nominatim) couvre tous les pays."),
    ("L'app ne marche plus, à qui m'adresser ?",
     "1) Forcez la fermeture de l'app et relancez.<br/>"
     "2) Vérifiez que vous avez la <b>dernière version</b> dans le Play Store.<br/>"
     "3) Si le problème persiste, contactez le support EFYL avec une capture d'écran de l'erreur."),
]
story.append(table_2col([["Question", "Réponse"], *faqs]))

story.append(PageBreak())

# -------------------------------------------------------
# 14. ANNEXES
# -------------------------------------------------------
story.append(Paragraph("14. Annexes", h1))
story.append(hr())

story.append(Paragraph("14.1 Glossaire", h2))
glossary = [
    ("AsyncStorage", "Système de stockage clé/valeur persistant sur le téléphone, utilisé pour conserver les adresses, enquêtes et préférences même hors-ligne."),
    ("Azimut", "Angle horizontal en degrés (0° = Nord) indiquant la direction de la porte d'entrée."),
    ("Foyer", "Type d'enquête représentant un logement / habitation. Données strictement privées."),
    ("Commerce", "Type d'enquête représentant un lieu commercial (boutique, atelier, restaurant...). Données publiques par défaut."),
    ("Géocodage inverse", "Conversion de coordonnées GPS en adresse textuelle (quartier, ville). Nécessite Internet."),
    ("Haversine", "Formule mathématique pour calculer la distance entre deux points GPS sur la Terre."),
    ("Leaflet", "Bibliothèque cartographique open-source utilisée pour afficher la carte interactive."),
    ("MOCK / Mode démo", "Mode actuel où les SMS ne sont pas envoyés ; le code 123456 fonctionne toujours."),
    ("NetInfo", "Bibliothèque qui surveille en permanence l'état du réseau pour déclencher la sync automatique."),
    ("Nominatim", "Service en ligne d'OpenStreetMap qui transforme des coordonnées en quartier / ville."),
    ("OTP", "One-Time Password — code à usage unique reçu par SMS pour se connecter."),
    ("OpenStreetMap (OSM)", "Carte mondiale collaborative et gratuite, équivalent libre de Google Maps."),
    ("QR Code", "Code-barres 2D contenant l'URL de votre adresse, scannable par n'importe quel téléphone."),
    ("Sync queue", "File d'attente locale des opérations à envoyer au serveur dès que le réseau revient."),
    ("Twilio", "Fournisseur de SMS internationaux, utilisé pour envoyer les vrais codes OTP en production."),
    ("Wizard", "Assistant pas-à-pas en plusieurs étapes (utilisé pour la création d'adresse et l'enquête)."),
]
story.append(table_2col([["Terme", "Définition"], *glossary]))

story.append(Paragraph("14.2 Code couleur récapitulatif", h2))
story.append(table_2col([
    ["Couleur", "Signification"],
    ["🟢 Vert primaire (#0D5C3A)", "Couleur de marque EFYL, boutons principaux, statuts vérifiés."],
    ["🟠 Orange accent (#F97316)", "Boutons d'action importants (Nouvelle adresse), pins Commerce."],
    ["🟡 Jaune", "Avertissements légers, statut « hors-ligne », précision moyenne."],
    ["🔴 Rouge", "Erreurs, précision faible, adresses signalées."],
    ["🔵 Bleu", "Informations neutres."],
    ["⚪ Gris", "Texte secondaire, états désactivés, pins de faible précision."],
]))

story.append(Paragraph("14.3 Raccourcis et gestes utiles", h2))
story.append(table_2col([
    ["Geste / Action", "Résultat"],
    ["Tirer vers le bas (pull-to-refresh)", "Rafraîchir la liste sur l'Accueil ou la Carte."],
    ["Appui long sur une adresse", "Menu contextuel (à venir) : partager, supprimer, dupliquer."],
    ["Pincer la carte", "Zoomer / dézoomer."],
    ["Glisser un pin orange (étape 4)", "Corriger manuellement la position GPS."],
    ["Bouton retour Android", "Revenir à l'étape précédente du wizard ; sur l'Accueil, demande confirmation pour quitter."],
]))

story.append(Paragraph("14.4 Identifiants de test (à supprimer en production)", h2))
story.append(table_2col([
    ["Identifiant", "Valeur"],
    ["Numéro de test", "+237 600 000 000 (ou n'importe quel format)"],
    ["Code OTP démo", "123456"],
    ["Mode invité", "Toujours disponible, aucun login nécessaire"],
]))

story.append(Spacer(1, 1*cm))
story.append(hr())
story.append(Paragraph(
    "<i>Ce guide a été généré automatiquement par l'équipe EFYL. Pour toute question, suggestion "
    "ou rapport de bug, n'hésitez pas à nous écrire. Bonne cartographie ! 📍🌍</i>",
    small,
))

# ============================================================
# Build
# ============================================================

# Use different onFirstPage handler for cover
doc.build(story, onFirstPage=on_cover, onLaterPages=on_page)
print(f"PDF généré : {OUTPUT}")

import os
size_kb = os.path.getsize(OUTPUT) / 1024
print(f"Taille : {size_kb:.1f} KB")
