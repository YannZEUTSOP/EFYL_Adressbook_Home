"""Generate ultra-detailed EFYL user guide PDF in English.

Output: /app/memory/EFYL_User_Guide_Complete_EN.pdf
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle,
    ListFlowable, ListItem, HRFlowable,
)
from datetime import date

OUTPUT = "/app/memory/EFYL_User_Guide_Complete_EN.pdf"

# ============================================================
# Theme colors (EFYL palette)
# ============================================================
PRIMARY = colors.HexColor("#0D5C3A")
ACCENT = colors.HexColor("#F97316")
DARK = colors.HexColor("#1F2937")
GREY = colors.HexColor("#6B7280")
LIGHT_BG = colors.HexColor("#F3F4F6")
SUCCESS = colors.HexColor("#22C55E")
WARN = colors.HexColor("#F59E0B")
ERROR = colors.HexColor("#EF4444")

# ============================================================
# Styles
# ============================================================
styles = getSampleStyleSheet()

cover_title = ParagraphStyle("cover_title", parent=styles["Heading1"],
    fontSize=42, leading=50, alignment=TA_CENTER, textColor=PRIMARY, spaceAfter=20)
cover_subtitle = ParagraphStyle("cover_subtitle", parent=styles["Heading2"],
    fontSize=18, leading=24, alignment=TA_CENTER, textColor=GREY, spaceAfter=10)
cover_meta = ParagraphStyle("cover_meta", parent=styles["Normal"],
    fontSize=12, leading=18, alignment=TA_CENTER, textColor=DARK)
h1 = ParagraphStyle("h1", parent=styles["Heading1"],
    fontSize=24, leading=30, textColor=PRIMARY, spaceBefore=12, spaceAfter=12, keepWithNext=1)
h2 = ParagraphStyle("h2", parent=styles["Heading2"],
    fontSize=18, leading=24, textColor=PRIMARY, spaceBefore=14, spaceAfter=8, keepWithNext=1)
h3 = ParagraphStyle("h3", parent=styles["Heading3"],
    fontSize=14, leading=18, textColor=DARK, spaceBefore=10, spaceAfter=6, keepWithNext=1)
body = ParagraphStyle("body", parent=styles["Normal"],
    fontSize=11, leading=16, alignment=TA_JUSTIFY, textColor=DARK, spaceAfter=6)
body_left = ParagraphStyle("body_left", parent=body, alignment=TA_LEFT)
callout_tip = ParagraphStyle("callout_tip", parent=body,
    leftIndent=12, rightIndent=12, backColor=colors.HexColor("#DCFCE7"),
    textColor=colors.HexColor("#14532D"), spaceBefore=6, spaceAfter=6)
callout_warn = ParagraphStyle("callout_warn", parent=body,
    leftIndent=12, rightIndent=12, backColor=colors.HexColor("#FEF3C7"),
    textColor=colors.HexColor("#78350F"), spaceBefore=6, spaceAfter=6)
callout_info = ParagraphStyle("callout_info", parent=body,
    leftIndent=12, rightIndent=12, backColor=colors.HexColor("#DBEAFE"),
    textColor=colors.HexColor("#1E3A8A"), spaceBefore=6, spaceAfter=6)
callout_error = ParagraphStyle("callout_error", parent=body,
    leftIndent=12, rightIndent=12, backColor=colors.HexColor("#FEE2E2"),
    textColor=colors.HexColor("#7F1D1D"), spaceBefore=6, spaceAfter=6)
mono = ParagraphStyle("mono", parent=body,
    fontName="Courier", fontSize=10, leading=13, backColor=LIGHT_BG,
    leftIndent=12, rightIndent=12, textColor=DARK, spaceBefore=4, spaceAfter=8)
small = ParagraphStyle("small", parent=body, fontSize=9, leading=12, textColor=GREY)


def callout(text, kind="tip"):
    style = {"tip": callout_tip, "warn": callout_warn,
             "info": callout_info, "error": callout_error}[kind]
    return Paragraph(text, style)


def code_block(text):
    return Paragraph(text.replace("\n", "<br/>"), mono)


def bullet_list(items):
    return ListFlowable(
        [ListItem(Paragraph(t, body_left), leftIndent=10) for t in items],
        bulletType="bullet", bulletColor=PRIMARY, leftIndent=18, spaceAfter=8)


def numbered_list(items):
    return ListFlowable(
        [ListItem(Paragraph(t, body_left), leftIndent=10) for t in items],
        bulletType="1", bulletColor=PRIMARY, leftIndent=22, spaceAfter=8)


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


def on_page(canv, doc):
    canv.saveState()
    canv.setFillColor(GREY)
    canv.setFont("Helvetica", 8)
    canv.drawString(2*cm, 1.2*cm, "EFYL Digital AddressBook — Complete User Guide (EN)")
    canv.drawRightString(A4[0]-2*cm, 1.2*cm, f"Page {doc.page}")
    canv.setStrokeColor(PRIMARY)
    canv.setLineWidth(2)
    canv.line(2*cm, A4[1]-1.3*cm, A4[0]-2*cm, A4[1]-1.3*cm)
    canv.restoreState()


def on_cover(canv, doc):
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
    canv.drawCentredString(A4[0]/2, A4[1]-7.5*cm, "Your address. Everywhere.")
    canv.setFillColor(GREY)
    canv.setFont("Helvetica", 8)
    canv.drawCentredString(A4[0]/2, 1*cm, f"Document generated on {date.today().strftime('%B %d, %Y')}")
    canv.restoreState()


doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm,
    title="EFYL — Complete User Guide",
    author="EFYL Team",
)

story = []

# -------------------------------------------------------
# COVER
# -------------------------------------------------------
story.append(Spacer(1, 11*cm))
story.append(Paragraph("Complete User Guide", cover_title))
story.append(Spacer(1, 0.2*cm))
story.append(Paragraph("Version 2.1 — Sprint S4", cover_subtitle))
story.append(Spacer(1, 0.6*cm))
story.append(Paragraph(
    "This guide walks you step by step through <b>all</b> features of the "
    "EFYL Digital AddressBook application, including offline mode, guided "
    "Household & Commerce surveys, the community map, QR code, data export "
    "and automatic synchronization.",
    cover_meta))
story.append(Spacer(1, 1*cm))
story.append(Paragraph("📍 🏘️ 🏪 🗺️ 🔲 📤", cover_meta))
story.append(PageBreak())

# -------------------------------------------------------
# TOC
# -------------------------------------------------------
story.append(Paragraph("Table of Contents", h1))
story.append(hr())

toc_rows = [
    ["§", "Section", "Page"],
    ["1", "Product introduction", "3"],
    ["2", "First launch: onboarding & permissions", "5"],
    ["3", "Authentication: SMS and guest mode", "7"],
    ["4", "Create a digital address: the 5-step wizard", "9"],
    ["5", "Guided surveys: Household or Commerce?", "15"],
    ["6", "Interactive map and community map", "19"],
    ["7", "QR Code & address sharing", "22"],
    ["8", "Community verification", "24"],
    ["9", "OFFLINE mode explained in depth", "26"],
    ["10", "Automatic and manual synchronization", "30"],
    ["11", "CSV / JSON export of your data", "32"],
    ["12", "Profile & settings: language, data, logout", "33"],
    ["13", "FAQ and troubleshooting", "35"],
    ["14", "Appendix: glossary, colors, shortcuts", "38"],
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
story.append(Paragraph("1. Product introduction", h1))
story.append(hr())

story.append(Paragraph("1.1 What is EFYL?", h2))
story.append(Paragraph(
    "<b>EFYL Digital AddressBook</b> is an <b>offline-first</b> mobile application designed "
    "to create, share and verify <b>accurate digital addresses</b> in Sub-Saharan Africa — and "
    "beyond — where classic street naming is missing, partial or outdated.",
    body))

story.append(Paragraph("1.2 Why this application?", h2))
story.append(Paragraph(
    "In hundreds of neighbourhoods, delivering a package, calling an ambulance, or simply "
    "indicating where one lives remains a headache. EFYL solves this problem in three motions:",
    body))
story.append(numbered_list([
    "<b>Create</b> a unique address by standing in front of one's door (e.g., "
    "<font face='Courier'>BES-AKW-3-12</font>) in less than a minute.",
    "<b>Share</b> this address via WhatsApp, SMS, email, or a simple printable QR code.",
    "<b>Verify</b> and collectively certify the position so it becomes reliable for "
    "everyone (couriers, emergency services, urban planning).",
]))

story.append(Paragraph("1.3 Who is this app for?", h2))
story.append(table_2col([
    ["Profile", "Main benefit"],
    ["Households", "Register their home and share easily via SMS or QR code."],
    ["Shop owners", "Make their store findable by the whole neighbourhood on the community map."],
    ["NGOs & humanitarians", "Census beneficiaries on the ground, even without a network."],
    ["City councils & postal services", "Operate a digital reference registry."],
    ["Couriers & emergency services", "Reach the right door on the first try."],
    ["Researchers & statisticians", "Use geo-referenced data for socio-economic studies."],
]))

story.append(Paragraph("1.4 The 6 core product principles", h2))
story.append(table_2col([
    ["Principle", "What it means for you"],
    ["Offline-first", "Everything works without Internet. Network is a bonus, never a requirement."],
    ["Private by default", "Your Household surveys remain <b>strictly private</b>. Only you see them."],
    ["Public commerces", "Your Commerce surveys are <b>voluntarily shared</b> with the community."],
    ["GPS accuracy", "Multi-sample measurement up to 1 m precision (sometimes less)."],
    ["Community verification", "Other users can confirm or flag your addresses."],
    ["Multilingual", "French and English. Instant toggle."],
]))
story.append(PageBreak())

# -------------------------------------------------------
# 2. ONBOARDING
# -------------------------------------------------------
story.append(Paragraph("2. First launch: onboarding & permissions", h1))
story.append(hr())

story.append(Paragraph("2.1 Welcome — Onboarding", h2))
story.append(Paragraph(
    "On first launch, the app displays a <b>3-screen carousel</b> presenting:",
    body))
story.append(bullet_list([
    "<b>Slide 1</b>: <i>“Create your address in an instant”</i> — GPS + door illustration.",
    "<b>Slide 2</b>: <i>“Share via QR Code, SMS, WhatsApp”</i> — sharing demo.",
    "<b>Slide 3</b>: <i>“Verify with the community”</i> — map with multiple pins.",
]))
story.append(Paragraph(
    "At top-left, an <b>“FR / EN”</b> button lets you switch the language at any time. Your "
    "choice is remembered.",
    body))
story.append(callout(
    "<b>💡 Tip</b> — Tap <b>“Skip”</b> at top-right to jump to the next screen if you "
    "already know the app.",
    "tip"))

story.append(Paragraph("2.2 Device permissions", h2))
story.append(Paragraph(
    "EFYL needs your permission to access some phone features. Requests are made "
    "<b>at the moment of use</b>, not all at once at startup:",
    body))
story.append(table_3col([
    ["Permission", "When is it requested?", "Required?"],
    ["📍 GPS Location", "During the 1st address measurement (wizard step 1).", "✅ Yes"],
    ["📷 Camera", "During 1st photo capture OR 1st QR scan.", "❌ Optional"],
    ["🧭 Compass sensor", "When locking entrance direction.", "❌ Optional"],
    ["💾 Storage", "To download CSV/JSON exports.", "❌ As needed"],
]))
story.append(callout(
    "<b>⚠️ Important</b> — If you deny GPS permission, the app will show an error and "
    "redirect you to the <b>system Settings</b> via a dedicated button. Once re-authorized, "
    "come back to EFYL and the measurement will resume.",
    "warn"))

story.append(Paragraph("2.3 Activate guest mode (no login)", h2))
story.append(Paragraph(
    "At the end of onboarding, you have two choices:",
    body))
story.append(bullet_list([
    "<b>Login by SMS</b> — receive a 6-digit code and get identified (useful for "
    "syncing on multiple phones).",
    "<b>Continue as guest</b> — everything works except your data is stored under the "
    "<font face='Courier'>guest</font> identifier. You can log in later without losing your data.",
]))
story.append(PageBreak())

# -------------------------------------------------------
# 3. AUTHENTICATION
# -------------------------------------------------------
story.append(Paragraph("3. Authentication: SMS and guest mode", h1))
story.append(hr())

story.append(Paragraph("3.1 Login by SMS (OTP)", h2))
story.append(Paragraph(
    "Authentication uses the <b>OTP</b> system (One Time Password — single-use code).",
    body))
story.append(numbered_list([
    "Enter your <b>phone number in international format</b>. Cameroon example: "
    "<font face='Courier'>+237 6XX XX XX XX</font>. The app also accepts "
    "<font face='Courier'>+33 6 12 34 56 78</font>, etc.",
    "Tap <b>“Send code”</b>.",
    "You receive a <b>6-digit code</b> by SMS (or shown on screen in demo mode).",
    "Enter the code in the OTP field then <b>“Verify”</b>.",
    "Once validated, you are redirected to the <b>Home</b> screen.",
]))
story.append(callout(
    "<b>🎟️ Current demo mode</b> — While Twilio is not enabled, the code <b>123456</b> "
    "works for <b>any phone number</b>. This info is shown on the login screen so you are "
    "never blocked.",
    "info"))

story.append(Paragraph("3.2 Anti-spam protection (rate-limit)", h2))
story.append(Paragraph(
    "To prevent an attacker from sending 1000 SMS in a loop, the app limits to <b>3 OTP code "
    "requests per phone per 10-minute window</b>. On the 4th attempt, you receive:",
    body))
story.append(code_block(
    "Error 429 — Too many requests. Please try again in 10 minutes."))

story.append(Paragraph("3.3 Wrong OTP code", h2))
story.append(Paragraph(
    "If you enter a wrong code, the app shows <b>“Invalid code”</b> and does not log you in. "
    "You can retry the code, or request a new code if you think you lost it.",
    body))

story.append(Paragraph("3.4 Continue in guest mode", h2))
story.append(Paragraph(
    "Guest mode is an express entry point to explore the app with no commitment:",
    body))
story.append(bullet_list([
    "All create / survey / QR functions are available.",
    "Your data is saved <b>locally</b> on this phone, identified by "
    "<font face='Courier'>owner_id = guest</font>.",
    "When you decide to log in later, the data is <b>automatically migrated</b> to your "
    "real account (on the next synchronization).",
]))

story.append(Paragraph("3.5 Log out", h2))
story.append(Paragraph(
    "From the <b>Profile</b> tab, tap <b>“Log out”</b>. Your data remains stored locally and "
    "on the server; you will simply be asked to log back in at the next launch.",
    body))
story.append(PageBreak())

# -------------------------------------------------------
# 4. CREATE ADDRESS
# -------------------------------------------------------
story.append(Paragraph("4. Create a digital address: the 5-step wizard", h1))
story.append(hr())

story.append(Paragraph(
    "This is <b>THE</b> core of the application. The wizard guides you step by step, with "
    "clear visual indicators (GPS pin color, locked satellites, progress bar).",
    body))

story.append(Paragraph("Before you start", h2))
story.append(bullet_list([
    "<b>Physically stand in front of the entrance door</b> of the building to register.",
    "Do not cover the phone (step out from under a metal roof if possible — better signal).",
    "If possible, wait 10–20 seconds for satellites to lock before tapping “Confirm”.",
]))

# Step 1
story.append(Paragraph("Step 1 — Measure the door's GPS position 📍", h2))
story.append(Paragraph(
    "The app starts <b>sampling your position continuously</b>. Every second, it takes a new "
    "reading and computes a filtered weighted average (simplified Kalman) to smooth out "
    "occasional errors.",
    body))

story.append(Paragraph("What you see on screen:", h3))
story.append(bullet_list([
    "A <b>precision circle</b> (green / yellow / red) based on signal quality.",
    "The <b>number of locked satellites</b> (typically 4 to 12 — the higher the better).",
    "<b>Latitude / longitude</b> coordinates in decimal degrees updated in real time.",
    "<b>Accuracy in meters</b> (desired ≤ 1 m, acceptable up to 5 m).",
]))

story.append(Paragraph("GPS pin color code:", h3))
story.append(table_3col([
    ["Color", "Accuracy", "Advice"],
    ["🟢 Green", "≤ 1 m", "Excellent! You can confirm."],
    ["🟡 Yellow", "1 to 5 m", "Acceptable. Wait a bit more to improve."],
    ["🔴 Red", "> 5 m", "Poor. Move a few meters or wait."],
    ["⚪ Grey", "Unknown", "No signal yet — wait 10 to 20 s."],
]))

story.append(Paragraph("When should I tap “Confirm GPS Position”?", h3))
story.append(Paragraph(
    "Ideally when the pin is <b>green</b> and stable for 5–10 seconds. If accuracy stalls at "
    "yellow (e.g., indoors, under dense trees, or in narrow alleys), a <b>“Save anyway”</b> "
    "button appears after 30 seconds.",
    body))

story.append(callout(
    "<b>⚠️ Warning</b> — If you save with accuracy > 5 m, the address will be marked "
    "<b>“Low accuracy”</b> with a red badge. You (or another user) can correct it later via "
    "the <b>“Verify address”</b> function.",
    "warn"))

# Step 2
story.append(Paragraph("Step 2 — Address details 📝", h2))
story.append(Paragraph(
    "Once the position is confirmed, the app automatically queries the <b>Nominatim "
    "(OpenStreetMap)</b> service to <b>auto-detect the district</b>. If you are offline, "
    "this field stays empty — you'll fill it in manually.",
    body))

story.append(Paragraph("Fields to fill in:", h3))
story.append(table_2col([
    ["Field", "Description"],
    ["District", "Code prefix (e.g., BES for Bessengue). Auto-detected."],
    ["Sector", "Internal zone code (e.g., AKW). You enter it."],
    ["Street number", "Street identifier (digit)."],
    ["House number", "Your door number on the street."],
    ["Contact name", "Your name or owner's name (optional)."],
    ["Phone", "Number to reach you (optional)."],
    ["Notes", "Any useful detail: “red door across from the pharmacy”."],
]))
story.append(callout(
    "<b>💡 Unique ID construction</b> — The final address ID is automatically generated "
    "as <font face='Courier'>DISTRICT-SECTOR-STREET-HOUSE</font>, example: "
    "<font face='Courier'>BES-AKW-3-12</font>. This is the ID you will share.",
    "tip"))

# Step 3
story.append(Paragraph("Step 3 — Entrance direction & photo 🧭📷", h2))
story.append(Paragraph(
    "This <b>optional</b> but very useful step captures two key pieces of information:",
    body))

story.append(Paragraph("3.A — Azimuth (compass)", h3))
story.append(numbered_list([
    "Hold the phone flat, screen facing up.",
    "<b>Point the top of the phone toward the entrance door</b> of the building.",
    "An animated compass appears, with an angle in degrees (0° = North, 90° = East, 180° = South, 270° = West).",
    "Tap <b>“Lock direction”</b>. The angle is saved.",
]))
story.append(Paragraph(
    "This azimuth will be shown to future visitors as: <i>“The entrance faces North-East (45°)”</i>.",
    body))

story.append(Paragraph("3.B — Building photo", h3))
story.append(numbered_list([
    "Tap <b>“Take a photo”</b>.",
    "Camera opens. Frame the building façade or door.",
    "Validate. The photo is encoded in <b>base64</b> and stored locally in the address record.",
    "You can “Retake” if the photo is not satisfactory.",
]))

# Step 4
story.append(Paragraph("Step 4 — Manual satellite correction 🛰️", h2))
story.append(Paragraph(
    "Sometimes, even with good GPS accuracy, the point can be slightly off (a few meters). "
    "This step lets you <b>manually correct</b> the position on a <b>satellite image</b>.",
    body))
story.append(numbered_list([
    "The map opens centered on the measured GPS position, with a draggable orange pin.",
    "Switch to <b>“Satellite”</b> mode via the top-right button if needed.",
    "Zoom (pinch) to clearly see your roof or yard.",
    "<b>Drag the orange pin</b> exactly to the desired spot.",
    "Tap <b>“Validate correction”</b>.",
]))
story.append(callout(
    "<b>📊 Data preserved</b> — The raw GPS position (<font face='Courier'>lat_raw / lng_raw</font>) "
    "and corrected position (<font face='Courier'>lat_corrected / lng_corrected</font>) are stored "
    "separately. Nobody ever loses the original raw data.",
    "info"))

# Step 5
story.append(Paragraph("Step 5 — Final review and save ✅", h2))
story.append(Paragraph(
    "The summary screen shows <b>all</b> the information entered:",
    body))
story.append(bullet_list([
    "GPS position (raw and corrected if applicable).",
    "Measured accuracy + badge.",
    "Generated address ID.",
    "District / sector / street / number.",
    "Direction (azimuth).",
    "Photo (thumbnail).",
]))
story.append(Paragraph(
    "You can <b>go back</b> on each step via the top tabs. When everything is correct, "
    "tap <b>“Save”</b>.",
    body))
story.append(callout(
    "<b>✅ What happens next?</b><br/>"
    "1. The address is saved to local storage <b>instantly</b>.<br/>"
    "2. It appears on the <b>Home</b> screen.<br/>"
    "3. A <b>“CREATE”</b> operation is added to the sync queue.<br/>"
    "4. If you are online, sync triggers automatically.<br/>"
    "5. The app immediately offers to <b>start the survey</b> (Household or Commerce).",
    "tip"))

story.append(PageBreak())

# -------------------------------------------------------
# 5. SURVEYS
# -------------------------------------------------------
story.append(Paragraph("5. Guided surveys: Household or Commerce?", h1))
story.append(hr())

story.append(Paragraph(
    "Right after the address is created, the app offers you to fill in a <b>survey</b>. "
    "This survey enriches your record with socio-economic (Household) or commercial "
    "(Commerce) information. It is <b>optional</b> but highly recommended — this is what "
    "makes your address truly useful for the community or statistics.",
    body))

story.append(Paragraph("5.1 The first question: Household or Commerce?", h2))
story.append(Paragraph(
    "You see <b>two big cards</b> side by side:",
    body))

story.append(table_2col([
    ["🏠 Household", "🏪 Commerce"],
    ["<b>Home / dwelling</b>.<br/>Data is <b>private</b> — visible "
     "<b>only by you</b>.<br/>19 steps (people, equipment, materials...).",
     "<b>Shop, workshop, clinic, restaurant...</b>.<br/>Data is <b>public</b> — "
     "shared with <b>the whole community</b>.<br/>3 steps only (commerce info + hours)."],
]))

story.append(callout(
    "<b>🔒 Privacy critical</b> — This distinction is crucial. If you choose “Household”, "
    "<b>NO ONE</b> else will ever see these details. If you choose “Commerce”, your "
    "shop will be <b>visible to everyone</b> on the community map, just like a "
    "shop on Google Maps.",
    "warn"))

story.append(Paragraph("5.2 Household path — 19 steps", h2))
story.append(Paragraph(
    "If you choose <b>Household</b>, the wizard takes you through the following steps:",
    body))

household_steps = [
    ("Total persons", "Total household member count (e.g., 5)."),
    ("Main income source", "Free text: “Commerce”, “Agriculture”, “Civil service”..."),
    ("Other income sources", "Free text, comma-separated."),
    ("Income level", "Choice: Very low / Low / Medium / High."),
    ("Phones", "Number of phones in the household (smartphones + classic)."),
    ("Internet", "Yes / No — Do you have Internet at home?"),
    ("Electricity", "Stable / Unstable / None."),
    ("Water", "Stable / Unstable / None."),
    ("Toilets", "Flush / Traditional / Other (text field if Other)."),
    ("Kitchen", "Position: In a room / In the living room / Separate."),
    ("Living rooms", "Total number of living rooms."),
    ("Floors", "Number of floors of the building."),
    ("Walls", "Concrete / Adobe / Wood / Other."),
    ("Glass windows", "Yes / No."),
    ("Roof", "Metal / Wood / Plastic / Concrete / Other."),
    ("Vehicles", "Sub-questions: bicycles, motorcycles, cars, trucks."),
    ("Persons intro", "Intro screen before each person entry."),
    ("Person record (repeated)", "Name, phone or email, age, gender, education, profession, frequented place."),
    ("Summary", "Full review and “Save” button."),
]
story.append(table_2col([
    ["Step", "Description"],
    *[[f"{i+1}. {s[0]}", s[1]] for i, s in enumerate(household_steps)],
]))

story.append(callout(
    "<b>💡 Tip</b> — You can add as many persons as you want. Tap <b>“+ Add a person”</b> "
    "after each record. When done, <b>“Finish entry”</b> takes you to the summary.",
    "tip"))

story.append(Paragraph("5.3 Commerce path — 3 steps", h2))
story.append(Paragraph(
    "If you choose <b>Commerce</b>, the wizard is much shorter — just fill in the info "
    "useful to future customers:",
    body))

story.append(table_2col([
    ["Step", "Fields to fill"],
    ["1. Household/Commerce choice", "(Already done — you chose Commerce)"],
    ["2. Commerce information",
     "<b>Business name</b> (required), <b>Owner</b>, <b>Phone</b>, <b>Products/activity</b>, "
     "<b>Mon-Fri hours</b>, <b>Saturday hours</b>, <b>Sunday hours</b>."],
    ["3. Summary", "Review + “Save” button."],
]))

story.append(Paragraph("5.4 What happens to the survey after saving?", h2))
story.append(numbered_list([
    "It is stored <b>locally</b> in AsyncStorage (<font face='Courier'>surveys</font> key).",
    "An <b>UPSERT</b> operation is added to the sync queue (<font face='Courier'>survey_queue</font> key).",
    "The linked address is marked <font face='Courier'>has_survey=true</font>.",
    "If you chose Commerce, the address is also marked <font face='Courier'>is_commerce=true</font> "
    "and becomes <b>public automatically</b> on the next sync.",
    "On the address card, a <b>🏪 Commerce badge</b> appears.",
]))
story.append(PageBreak())

# -------------------------------------------------------
# 6. MAP
# -------------------------------------------------------
story.append(Paragraph("6. Interactive map and community map", h1))
story.append(hr())

story.append(Paragraph("6.1 Open the map", h2))
story.append(Paragraph(
    "Tap the <b>Map</b> tab at the bottom of the screen. The map (based on Leaflet + "
    "OpenStreetMap) opens, automatically centered on all your addresses.",
    body))

story.append(Paragraph("6.2 Understanding pins", h2))
story.append(table_3col([
    ["Pin color", "Meaning", "Clickable?"],
    ["🟢 Green", "<b>Verified</b> address by community.", "✅ Yes — opens the record."],
    ["🟡 Yellow", "Address created but <b>not yet verified</b>.", "✅ Yes."],
    ["🔴 Red", "Address <b>flagged 3+ times</b> (suspicious).", "✅ Yes."],
    ["⚪ Grey", "Address with <b>low accuracy</b> (> 5 m).", "✅ Yes."],
    ["🟠 Orange", "<b>Community</b> commerce (shared by anyone).", "✅ Yes."],
]))

story.append(Paragraph("6.3 “Community commerces” toggle", h2))
story.append(Paragraph(
    "Just below the map header, a button with the 🏪 icon shows / hides <b>commerces "
    "shared by all other users</b>. By default, this toggle is <b>ON</b> (you see "
    "community commerces).",
    body))

story.append(callout(
    "<b>💡 Good to know</b> — When the toggle is ON, you see both <b>your</b> addresses "
    "(households + commerces) <b>and</b> commerces shared by others. When OFF, only "
    "your addresses appear. Other users' households are <b>NEVER</b> visible, regardless "
    "of the toggle.",
    "tip"))

story.append(Paragraph("6.4 Switch Street ⇄ Satellite", h2))
story.append(Paragraph(
    "At the top right of the map, two buttons:",
    body))
story.append(bullet_list([
    "<b>“Streets”</b> — classic OpenStreetMap display (drawn streets, buildings).",
    "<b>“Satellite”</b> — high-resolution aerial image (Esri World Imagery).",
]))
story.append(Paragraph(
    "Satellite mode is very useful to visually verify the building and correct the "
    "position if needed.",
    body))

story.append(Paragraph("6.5 Zoom, pan, navigate", h2))
story.append(numbered_list([
    "<b>Zoom</b>: pinch with two fingers (in) or spread two fingers (out).",
    "<b>Pan</b>: drag with one finger.",
    "<b>Recenter on my location</b>: target icon bottom right.",
    "<b>Tap a pin</b>: opens a popup with name and ID, and a “View record” button.",
]))

story.append(Paragraph("6.6 Offline behavior of the map", h2))
story.append(callout(
    "<b>⚠️ Current limitation</b> — The Leaflet map downloads <b>tiles</b> (small images) "
    "from OpenStreetMap at display time. Offline, only tiles already consulted recently "
    "remain visible. Uncached zones appear white. The <b>pins (your data)</b> remain "
    "perfectly displayed.",
    "warn"))
story.append(PageBreak())

# -------------------------------------------------------
# 7. QR & SHARING
# -------------------------------------------------------
story.append(Paragraph("7. QR Code & address sharing", h1))
story.append(hr())

story.append(Paragraph("7.1 Generate an address QR Code", h2))
story.append(numbered_list([
    "From the <b>Home</b> screen, tap an address to open its record.",
    "Tap the <b>“QR Code”</b> button at the top right.",
    "A large QR Code appears on screen, along with the address ID in plain text.",
]))
story.append(Paragraph(
    "The QR contains a special URL <font face='Courier'>efyl://address/BES-AKW-3-12</font> "
    "that, when scanned by any phone with EFYL installed, directly opens the corresponding "
    "address record.",
    body))

story.append(Paragraph("7.2 Share via WhatsApp / SMS / Email", h2))
story.append(Paragraph(
    "Below the QR Code, several share buttons:",
    body))
story.append(table_2col([
    ["Button", "Behavior"],
    ["📱 WhatsApp", "Opens WhatsApp with a prefilled message containing the address ID and link."],
    ["💬 SMS", "Opens the SMS app with the prefilled message."],
    ["📧 Email", "Opens your email client with prefilled subject and body."],
    ["📤 Generic share", "Shows the native system share menu (Bluetooth, AirDrop, etc.)."],
]))

story.append(Paragraph("7.3 Scan another user's QR Code", h2))
story.append(numbered_list([
    "Go to the <b>Scan</b> tab (camera icon).",
    "Grant camera access if asked.",
    "Point the camera at the QR Code to scan.",
    "The app automatically detects the QR and displays the address information.",
    "Three options appear: <b>“Add to my book”</b>, <b>“View directions”</b>, "
    "<b>“Ignore”</b>.",
]))
story.append(callout(
    "<b>📍 Directions</b> — The “View directions” button opens your favorite navigation "
    "app (Google Maps, Waze, Apple Maps...) with the destination already entered at the "
    "GPS coordinates.",
    "tip"))

story.append(Paragraph("7.4 Print a QR Code", h2))
story.append(Paragraph(
    "You can also <b>print</b> the QR Code on a sticker to put on your door. On the QR "
    "screen, the <b>“Download PNG”</b> button saves the image to your gallery, which you "
    "can then print from any internet café or family printer.",
    body))
story.append(PageBreak())

# -------------------------------------------------------
# 8. VERIFICATION
# -------------------------------------------------------
story.append(Paragraph("8. Community verification", h1))
story.append(hr())

story.append(Paragraph("8.1 Why verify?", h2))
story.append(Paragraph(
    "The cross-verification system is what makes EFYL <b>reliable in the long run</b>. If "
    "someone creates an approximate or false address, other users can correct it, and the "
    "address gets <b>certified</b> or <b>flagged</b>.",
    body))

story.append(Paragraph("8.2 How to verify an address", h2))
story.append(numbered_list([
    "<b>Physically</b> go to the address to verify (or very close to it).",
    "Open the address record (from your book or by scanning someone's QR).",
    "Tap <b>“Verify this address”</b>.",
    "The app measures your current GPS position.",
    "It computes the <b>haversine distance</b> between your position and the saved one.",
    "Tap <b>“Submit”</b>.",
]))

story.append(Paragraph("8.3 What happens next?", h2))
story.append(table_2col([
    ["Measured distance", "Result"],
    ["≤ 10 meters", "<b>Address VERIFIED ✓</b><br/>Pin turns <b>green</b>. App shows: "
     "<i>“Position verified — thank you!”</i>"],
    ["> 10 meters", "<b>Address flagged</b><br/>The <font face='Courier'>flag_count</font> "
     "counter is incremented. App shows: <i>“Inaccuracy reported — thanks for feedback!”</i>"],
    ["After 3 flags", "<b>Address marked SUSPICIOUS</b><br/>Pin turns <b>red</b>. The "
     "owner can then correct it via the wizard."],
]))

story.append(callout(
    "<b>🤝 System spirit</b> — Verification is <b>voluntary and benevolent</b>. It does "
    "not replace the address creator, it <b>complements</b> their trust. Each verification "
    "strengthens or nuances the overall reliability of the database.",
    "info"))
story.append(PageBreak())

# -------------------------------------------------------
# 9. OFFLINE MODE
# -------------------------------------------------------
story.append(Paragraph("9. The OFFLINE mode explained in depth", h1))
story.append(hr())

story.append(callout(
    "<b>📌 Essential section</b> — Offline mode is EFYL's <b>signature</b>. This section "
    "explains step by step how it works technically, so you understand what happens "
    "under the hood.",
    "info"))

story.append(Paragraph("9.1 The core principle: Offline-First", h2))
story.append(Paragraph(
    "EFYL is built on the <b>Offline-First</b> paradigm: network connectivity is an "
    "<b>optional bonus</b>, never a condition of operation. All essential operations — "
    "create, edit, delete, photograph, share — first go through local storage, then are "
    "<b>deferred-synced</b> with the server as soon as the network is available again.",
    body))

story.append(Paragraph("9.2 GPS works WITHOUT Internet", h2))
story.append(Paragraph(
    "This is a very common misconception: <b>GPS does NOT need Internet</b>. Here's why:",
    body))
story.append(bullet_list([
    "Your phone's GPS directly receives signals from satellites in orbit "
    "(<b>American GPS</b>, <b>Russian GLONASS</b>, <b>European Galileo</b>, <b>Chinese BeiDou</b>).",
    "These satellites broadcast <b>continuously</b>, and your phone captures their signals via antenna.",
    "The phone itself computes your position via <b>triangulation</b> (distance × time).",
    "<b>Result</b>: even deep in the Cameroonian bush or in a desert, without any cellular signal, "
    "your position is known to within 1–5 meters.",
]))
story.append(callout(
    "<b>🛰️ Tech detail</b> — “Assisted GPS” (A-GPS) uses the cellular network to "
    "pre-fetch satellite ephemerides faster. Without a network, the first fix can take "
    "30–60 seconds instead of 5–10. But once acquired, everything works identically.",
    "info"))

story.append(Paragraph("9.3 Local storage: AsyncStorage", h2))
story.append(Paragraph(
    "All your data is stored in <b>AsyncStorage</b>, the persistent key/value storage "
    "system provided by React Native (mobile equivalent of localStorage). Here's the "
    "structure of keys used:",
    body))
story.append(table_2col([
    ["AsyncStorage key", "Contents"],
    ["addresses", "JSON list of all your created addresses."],
    ["surveys", "JSON list of all surveys (Household + Commerce)."],
    ["sync_queue", "Queue of CREATE / DELETE operations to sync."],
    ["survey_queue", "Queue of UPSERT survey operations to sync."],
    ["last_sync", "Timestamp of the last successful synchronization."],
    ["prefs", "User preferences (language, theme, etc.)."],
    ["user", "ID and phone of the logged-in user."],
]))
story.append(Paragraph(
    "<b>Persistence</b>: this data survives app closure, phone reboot, and even battery "
    "death. Only an app uninstall erases it.",
    body))

story.append(Paragraph("9.4 The lifecycle of an offline-created address", h2))
story.append(code_block(
    "1.  You tap 'Save'\n"
    "    ↓\n"
    "2.  App stores the address in AsyncStorage ('addresses' key)\n"
    "    ↓\n"
    "3.  App adds an operation to 'sync_queue'\n"
    "    Format: [{action: 'CREATE', payload: {...}, ts: ...}]\n"
    "    ↓\n"
    "4.  IMMEDIATE confirmation to user ('Address created!')\n"
    "    ↓\n"
    "5.  User can keep creating more addresses\n"
    "    for days without network\n"
    "    ↓\n"
    "6.  When network returns (NetInfo detection):\n"
    "    a. processSyncQueue() is triggered\n"
    "    b. Each operation is replayed to the backend\n"
    "    c. Backend confirms or returns an error\n"
    "    d. Successful operations are removed from the queue\n"
    "    e. Failed operations stay for the next attempt"))

story.append(Paragraph("9.5 Automatic network detection (NetInfo)", h2))
story.append(Paragraph(
    "We use the <font face='Courier'>@react-native-community/netinfo</font> library that "
    "continuously listens for network state. Here's the simplified code:",
    body))
story.append(code_block(
    "NetInfo.addEventListener((state) => {\n"
    "  if (state.isConnected && !wasConnected) {\n"
    "    // Network just came back!\n"
    "    processSyncQueue();    // Drain the queue\n"
    "    refreshAddresses();    // Refresh from server\n"
    "    refreshPublicCommerces();\n"
    "  }\n"
    "  wasConnected = state.isConnected;\n"
    "});"))
story.append(Paragraph(
    "As soon as your phone picks up WiFi, 4G or 3G, <b>within the second that follows</b>, "
    "the queue automatically drains without any action on your part.",
    body))

story.append(Paragraph("9.6 Reverse geocoding: the only exception", h2))
story.append(callout(
    "<b>⚠️ ATTENTION</b> — <b>Reverse geocoding</b> (auto-detecting district from GPS "
    "coordinates) is <b>the only feature</b> that needs Internet, since it calls the "
    "OpenStreetMap Nominatim API.<br/><br/>"
    "<b>Offline consequence</b>: the “District” field remains empty. You fill it in "
    "manually and the address is created normally.",
    "warn"))

story.append(Paragraph("9.7 Online vs Offline recap table", h2))
story.append(table_3col([
    ["Feature", "Offline?", "Notes"],
    ["📍 Measure GPS position", "✅ YES", "Satellites, no Internet."],
    ["💾 Create an address", "✅ YES", "Instant AsyncStorage."],
    ["📝 Household/Commerce survey", "✅ YES", "Instant AsyncStorage."],
    ["📷 Take building photo", "✅ YES", "Local camera."],
    ["🧭 Compass (azimuth)", "✅ YES", "Phone's local sensor."],
    ["🔲 Generate QR code", "✅ YES", "100% local computation."],
    ["📤 Share via WhatsApp/SMS", "⚠️ Partial", "Opens the app — sends when network returns."],
    ["🏘️ District auto-detection", "❌ NO", "Needs Nominatim."],
    ["🗺️ New map tiles", "❌ NO", "Needs OSM."],
    ["☁️ Backend sync", "❌ NO", "But auto on network return."],
    ["📞 SMS login (Twilio)", "❌ NO", "But guest mode available."],
    ["🔍 Scan another user's QR", "✅ YES", "100% local decoding."],
    ["🏪 See community commerces", "❌ NO", "Needs backend fetch."],
    ["✅ Verify an address", "❌ NO", "Needs to send to backend."],
    ["📁 CSV/JSON export", "❌ NO", "Backend endpoint."],
]))

story.append(Paragraph("9.8 What to do if blocked offline?", h2))
story.append(bullet_list([
    "<b>District is not auto-detected</b> → fill it in manually.",
    "<b>Map is white</b> → position is still measured, create the address, you'll see "
    "the map when network returns.",
    "<b>I can't see community commerces</b> → normal, wait for network return.",
    "<b>I can't verify an address</b> → also normal, do it when network returns.",
    "<b>Sync queue counter grows</b> → this is <b>normal</b>, it just means you have "
    "pending operations. Everything will be sent automatically when network returns.",
]))
story.append(PageBreak())

# -------------------------------------------------------
# 10. SYNCHRONIZATION
# -------------------------------------------------------
story.append(Paragraph("10. Automatic and manual synchronization", h1))
story.append(hr())

story.append(Paragraph("10.1 The connectivity indicator", h2))
story.append(Paragraph(
    "At the top of the Home screen:",
    body))
story.append(bullet_list([
    "<b>No indicator</b> → you are online, everything is synced.",
    "<b>Yellow “Offline” banner</b> → you are offline, but data is saved locally.",
    "<b>“X pending” badge</b> → you have X operations waiting to sync.",
]))

story.append(Paragraph("10.2 Auto-sync on network return", h2))
story.append(Paragraph(
    "As soon as NetInfo detects connection return (WiFi or cellular), sync triggers without "
    "any action. You will see:",
    body))
story.append(numbered_list([
    "The yellow <b>“Offline”</b> banner disappears.",
    "A discreet <b>“Syncing…”</b> notification at the bottom.",
    "The pending operations counter drops to 0.",
    "The <b>“Last sync”</b> timestamp in Profile is updated.",
]))

story.append(Paragraph("10.3 Manual sync", h2))
story.append(Paragraph(
    "If you want to force sync (for example, you know a teammate just created commerces and "
    "you want to see them):",
    body))
story.append(numbered_list([
    "Go to the <b>Profile</b> tab.",
    "Tap <b>“Sync now”</b>.",
    "Wait a few seconds — a progress indicator shows.",
    "Confirmation notification at the end.",
]))

story.append(Paragraph("10.4 What exactly gets synced?", h2))
story.append(table_2col([
    ["Direction", "Data concerned"],
    ["Phone → Server", "Addresses created, edited, deleted offline.<br/>Household/Commerce surveys.<br/>Offline verifications (if applicable)."],
    ["Server → Phone", "Recent public commerces.<br/>Verifications done by other users.<br/>Status updates (verified / flagged)."],
]))

story.append(Paragraph("10.5 Conflicts and handling", h2))
story.append(Paragraph(
    "If you edit an address offline while another user edits it online, the system applies "
    "the <b>“Last Write Wins”</b> rule (the latest timestamped change wins). For critical "
    "addresses (verification), the backend always favors the <b>most recent</b> data.",
    body))
story.append(PageBreak())

# -------------------------------------------------------
# 11. EXPORT
# -------------------------------------------------------
story.append(Paragraph("11. CSV / JSON export of your data", h1))
story.append(hr())

story.append(Paragraph("11.1 Why export?", h2))
story.append(bullet_list([
    "Make a local backup on your computer.",
    "Analyze your data in Excel or LibreOffice.",
    "Share a list of addresses with a partner.",
    "Provide data to a postal service, NGO or city council.",
]))

story.append(Paragraph("11.2 How to export", h2))
story.append(numbered_list([
    "Go to the <b>Profile</b> tab.",
    "“My data” section.",
    "Tap <b>“Export as CSV”</b> or <b>“Export as JSON”</b>.",
    "The file is downloaded into your phone's <b>Downloads</b> folder.",
    "You can share it (WhatsApp, email, AirDrop, Google Drive...) or open it directly.",
]))

story.append(Paragraph("11.3 What's in the CSV file?", h2))
story.append(Paragraph(
    "The CSV file contains one row per address, with the following columns (and more):",
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
    "commerce_hours_weekdays, ..."))

story.append(Paragraph("11.4 JSON format for integrations", h2))
story.append(Paragraph(
    "The JSON format is more structured and allows nesting surveys and the persons list. "
    "Ideal for developers or integrations with other systems (API, external database...).",
    body))
story.append(PageBreak())

# -------------------------------------------------------
# 12. PROFILE
# -------------------------------------------------------
story.append(Paragraph("12. Profile & settings", h1))
story.append(hr())

story.append(Paragraph("12.1 Access the profile", h2))
story.append(Paragraph(
    "<b>Profile</b> tab at the bottom right. You will find:",
    body))
story.append(bullet_list([
    "Your <b>phone number</b> (or “Guest mode”).",
    "Your <b>personal statistics</b>: count of addresses, surveys, commerces, verifications done.",
    "Status of <b>last sync</b>.",
    "<b>Settings</b>: language, theme, etc.",
    "<b>Actions</b>: export, sync, log out, delete data.",
]))

story.append(Paragraph("12.2 Change language", h2))
story.append(numbered_list([
    "Profile → <b>“Language”</b>.",
    "Choose <b>Français</b> or <b>English</b>.",
    "The whole app switches <b>instantly</b> without restart.",
]))

story.append(Paragraph("12.3 Delete all my data", h2))
story.append(callout(
    "<b>🚨 IRREVERSIBLE ACTION</b> — This function erases <b>all</b> your addresses, "
    "surveys and preferences <b>on this phone</b>. Data already synced to the server is "
    "<b>not</b> deleted server-side — contact the admin for that.",
    "error"))
story.append(numbered_list([
    "Profile → <b>“Delete my data”</b>.",
    "A confirmation appears: <b>“Are you sure?”</b>.",
    "Type “DELETE” in the confirmation field.",
    "Validate. AsyncStorage is wiped. App returns to onboarding."]))

story.append(Paragraph("12.4 Log out", h2))
story.append(Paragraph(
    "Profile → <b>“Log out”</b>. Your data stays on the phone and on the server. At the "
    "next launch, you will be asked to log back in or to continue as guest.",
    body))
story.append(PageBreak())

# -------------------------------------------------------
# 13. FAQ
# -------------------------------------------------------
story.append(Paragraph("13. FAQ and troubleshooting", h1))
story.append(hr())

faqs = [
    ("My GPS stays yellow even after 1 minute, what to do?",
     "1) Step out of the building (GPS penetrates metal or concrete roofs poorly).<br/>"
     "2) Move away from large trees or very tall buildings.<br/>"
     "3) If still impossible, use the <b>“Save anyway”</b> button. The address will be "
     "marked “Low accuracy” and you can correct it later."),
    ("The district is not auto-detected when I create an address.",
     "Normal if you are <b>offline</b>. Reverse geocoding (Nominatim) needs Internet. "
     "Enter the district manually and continue."),
    ("I created 30 addresses offline, are they lost?",
     "<b>No</b>, they are saved locally and will be automatically synced as soon as you "
     "have network. Check Profile → “Last sync”."),
    ("Can anyone see my household data (income, persons...)?",
     "<b>Absolutely not</b>. Household surveys are strictly private. The server filters "
     "by your <font face='Courier'>owner_id</font> and never returns another user's data. "
     "Only <b>Commerces</b> are public, by your explicit choice."),
    ("My commerce doesn't show up on other users' maps.",
     "1) Verify you chose <b>“Commerce”</b> and not “Household” at the first survey step.<br/>"
     "2) Make sure sync has happened (Profile → Sync now).<br/>"
     "3) Ask the other user to enable the <b>“Community commerces”</b> toggle on the map."),
    ("I can't receive the SMS code at login.",
     "In current demo mode, no real SMS is sent. The code <b>123456</b> always works. "
     "To receive real SMS, the admin must enable Twilio."),
    ("I uninstalled the app by mistake. Is my data lost?",
     "If you were logged in (not guest) and sync happened, your data is <b>saved on the "
     "server</b>. Reinstall the app, log in, and it will be re-downloaded. If you were "
     "in guest mode, sadly the data is lost since it was only on the phone."),
    ("Building photo is very large. How to optimize?",
     "The app auto-compresses photos as JPEG quality 70%. To save more space, choose "
     "<b>not to take a photo</b> at step 3 (it's optional)."),
    ("Can I use the app abroad (outside Cameroon)?",
     "<b>Yes, totally.</b> The app works worldwide. GPS works everywhere, and reverse "
     "geocoding (Nominatim) covers all countries."),
    ("The app stopped working, who do I contact?",
     "1) Force-close the app and relaunch.<br/>"
     "2) Check you have the <b>latest version</b> on the Play Store.<br/>"
     "3) If the problem persists, contact EFYL support with a screenshot of the error."),
]
story.append(table_2col([["Question", "Answer"], *faqs]))
story.append(PageBreak())

# -------------------------------------------------------
# 14. APPENDIX
# -------------------------------------------------------
story.append(Paragraph("14. Appendix", h1))
story.append(hr())

story.append(Paragraph("14.1 Glossary", h2))
glossary = [
    ("AsyncStorage", "Persistent key/value storage system on the phone, used to keep addresses, surveys and preferences even offline."),
    ("Azimuth", "Horizontal angle in degrees (0° = North) indicating the entrance door direction."),
    ("Household", "Survey type representing a dwelling. Data strictly private."),
    ("Commerce", "Survey type representing a commercial place (shop, workshop, restaurant...). Data public by default."),
    ("Reverse geocoding", "Conversion of GPS coordinates to a textual address (district, city). Requires Internet."),
    ("Haversine", "Mathematical formula to compute the distance between two GPS points on Earth."),
    ("Leaflet", "Open-source mapping library used to display the interactive map."),
    ("MOCK / Demo mode", "Current mode where no SMS is sent; the code 123456 always works."),
    ("NetInfo", "Library that continuously monitors network state to trigger auto-sync."),
    ("Nominatim", "OpenStreetMap online service that transforms coordinates into district / city."),
    ("OTP", "One-Time Password — single-use code received via SMS to log in."),
    ("OpenStreetMap (OSM)", "Collaborative free worldwide map, free equivalent of Google Maps."),
    ("QR Code", "2D barcode containing your address URL, scannable by any phone."),
    ("Sync queue", "Local queue of operations to send to the server as soon as network returns."),
    ("Twilio", "International SMS provider, used to send real OTP codes in production."),
    ("Wizard", "Step-by-step assistant in several stages (used for address creation and survey)."),
]
story.append(table_2col([["Term", "Definition"], *glossary]))

story.append(Paragraph("14.2 Color code recap", h2))
story.append(table_2col([
    ["Color", "Meaning"],
    ["🟢 Primary green (#0D5C3A)", "EFYL brand color, main buttons, verified statuses."],
    ["🟠 Accent orange (#F97316)", "Important action buttons (New Address), Commerce pins."],
    ["🟡 Yellow", "Light warnings, “offline” status, medium accuracy."],
    ["🔴 Red", "Errors, low accuracy, flagged addresses."],
    ["🔵 Blue", "Neutral information."],
    ["⚪ Grey", "Secondary text, disabled states, low-accuracy pins."],
]))

story.append(Paragraph("14.3 Useful shortcuts and gestures", h2))
story.append(table_2col([
    ["Gesture / Action", "Result"],
    ["Pull down (pull-to-refresh)", "Refresh the list on Home or Map."],
    ["Long press on an address", "Context menu (coming): share, delete, duplicate."],
    ["Pinch the map", "Zoom in / out."],
    ["Drag the orange pin (step 4)", "Manually correct the GPS position."],
    ["Android Back button", "Go back one step in the wizard; on Home, ask confirmation to quit."],
]))

story.append(Paragraph("14.4 Test credentials (to remove in production)", h2))
story.append(table_2col([
    ["Identifier", "Value"],
    ["Test phone number", "+237 600 000 000 (or any format)"],
    ["Demo OTP code", "123456"],
    ["Guest mode", "Always available, no login required"],
]))

story.append(Spacer(1, 1*cm))
story.append(hr())
story.append(Paragraph(
    "<i>This guide was automatically generated by the EFYL team. For any question, "
    "suggestion or bug report, please reach out to us. Happy mapping! 📍🌍</i>",
    small))

doc.build(story, onFirstPage=on_cover, onLaterPages=on_page)
print(f"PDF generated: {OUTPUT}")

import os
size_kb = os.path.getsize(OUTPUT) / 1024
print(f"Size: {size_kb:.1f} KB")
