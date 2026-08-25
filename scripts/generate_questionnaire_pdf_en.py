# -*- coding: utf-8 -*-
"""Generates the ENGLISH reference PDF: ALL questions of the 4 EFYL surveys.
Source of truth: /app/frontend/app/survey/[id].tsx + i18n en (manually verified extraction)."""
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
n = {"v": 0}


def q(text, kind, mandatory=True, options=None, notes=None, indent=0):
    n["v"] += 1
    tag = "REQUIRED" if mandatory else "optional"
    color = "#B91C1C" if mandatory else "#6B7280"
    li = 14 + indent
    story.append(Paragraph(
        f'Q{n["v"]}. {text} &nbsp;<font size="8" color="{color}">[{tag}]</font>',
        ParagraphStyle("qq", parent=q_s, leftIndent=indent)))
    story.append(Paragraph(f"Answer type: {kind}", ParagraphStyle("m", parent=meta_s, leftIndent=li)))
    if options:
        story.append(Paragraph("Available choices: " + " &bull; ".join(options),
                               ParagraphStyle("o", parent=opt_s, leftIndent=li + 8)))
    if notes:
        for note in notes:
            story.append(Paragraph(note, ParagraphStyle("n", parent=note_s, leftIndent=li)))


def section(num, title, steps_desc):
    story.append(HRFlowable(width="100%", color=GREEN, thickness=1.2, spaceBefore=12, spaceAfter=2))
    story.append(Paragraph(f"SURVEY {num} — {title}", h1))
    story.append(Paragraph(steps_desc, ParagraphStyle("sd", parent=body_s, textColor=GREY)))
    n["v"] = 0


# ============================== COVER ==============================
story.append(Spacer(1, 30 * mm))
story.append(Paragraph("EFYL AddressBook", title_s))
story.append(Spacer(1, 4 * mm))
story.append(Paragraph("COMPLETE QUESTIONNAIRE REFERENCE", title_s))
story.append(Spacer(1, 8 * mm))
story.append(Paragraph("All questions of the 4 surveys, in the exact order of the application,<br/>with answer choices, per-person and per-frequented-place questions.", subtitle_s))
story.append(Spacer(1, 6 * mm))
story.append(Paragraph("Version: August 2026 — matches the production application", subtitle_s))
story.append(Spacer(1, 14 * mm))
toc = [
    ["Common question", "Building type choice"],
    ["Survey 1", "HOUSEHOLD (home) — 17 questions + per-person sheet (7) + per-place sheet (4)"],
    ["Survey 2", "COMMERCE (shop, workshop, clinic) — 8 questions"],
    ["Survey 3", "PUBLIC SERVICE (school, health, government) — 9 questions"],
    ["Survey 4", "SACRED / TOURIST SITE (heritage) — 14 questions"],
    ["Appendix", "Information collected at address creation (before any survey)"],
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

# ============================== COMMON QUESTION ==============================
story.append(Paragraph("COMMON QUESTION — Start of every survey", h1))
story.append(Paragraph(
    "Screen shown: \u201cWhat type of building?\u201d — <i>Commerces and public services are visible to all users "
    "after sync. Households remain private.</i>", body_s))
n["v"] = 0
q("What type of building?", "Single choice (4 cards)", True, [
    "Household (home) — private data, visible to you only",
    "Commerce (shop, workshop, clinic) — public data shared with the community",
    "Public service (school, health, government) — public data, visible to the community",
    "Sacred / tourist site — heritage, culture, tourism, public data",
])
story.append(Paragraph(
    "At any time: \u201cContinue later\u201d button (saves a draft), \u201cBack\u201d button "
    "(returns to the previous question keeping all answers).", note_s))

# ============================== SURVEY 1: HOUSEHOLD ==============================
section(1, "HOUSEHOLD (home)",
        "Flow: type choice → introduction → 17 questions → sheet for EACH household member "
        "(with frequented places) → summary → save.")
story.append(Paragraph("Introduction screen: \u201cWhat type of building do you want to survey?\u201d + address code, \u201cStart survey\u201d button.", body_s))

q("Family / household name", "Free text (e.g. Kamdem family)")
q("How many people live in this household?", "Number (− / + buttons, minimum 1)",
  notes=["Rule: the number declared here must EXACTLY match the number of persons recorded at the end (blocked otherwise)."])
q("What is the main source of income?", "Free text (e.g. Commerce, Agriculture...)")
q("Other sources of income", "Free text", mandatory=False)
q("Household income level", "Single choice", True, [
    "Very low — irregular income, under 50,000 FCFA/month, basic needs hard to cover",
    "Low — 50,000 to 150,000 FCFA/month, basic needs covered, little or no savings",
    "Medium — 150,000 to 500,000 FCFA/month, comfortable life, savings possible",
    "High — over 500,000 FCFA/month, well-off household (vehicle, investments)",
])
q("How many phones in the household?", "Number (− / + buttons)")
q("Do you have internet access at home?", "Yes / No")
q("How is electricity in the house?", "Single choice", True, ["Stable", "Unstable", "None"])
q("Is there access to running water inside the home?", "Single choice", True, ["Stable", "Unstable", "None"])
q("What type of toilets do you have?", "Single choice", True, ["Flush", "Traditional", "Other"],
  notes=["If \u201cOther\u201d: REQUIRED follow-up question \u201cSpecify toilet type\u201d (free text)."])
q("Where is the kitchen?", "Single choice", True, ["In a separate room", "In the living room", "Separate building"],
  notes=["Rule shown on screen: a kitchen physically separated from the main building is a separate building "
         "— create its own EFYL address."])
q("How many rooms does the dwelling have (excluding kitchens and bathrooms)?", "Number (minimum 1)",
  notes=["Instruction shown: include bedrooms, living rooms and any other habitable rooms."])
q("How many floors in the building?", "Number (minimum 1)")
q("Wall materials", "Single choice", True, ["Concrete", "Adobe", "Wood", "Other"],
  notes=["If \u201cOther\u201d: REQUIRED follow-up question \u201cSpecify wall material\u201d (free text)."])
q("Glass windows?", "Yes / No")
q("Roof materials", "Single choice", True, ["Metal sheet", "Wood", "Plastic", "Concrete", "Other"],
  notes=["If \u201cOther\u201d: REQUIRED follow-up question \u201cSpecify roof material\u201d (free text)."])
q("How many vehicles does the household own?", "4 separate counters (− / + buttons)", True,
  ["Bicycles", "Motorcycles", "Cars", "Trucks"])
story.append(Paragraph("Transition screen: \u201cFill in information for each household member.\u201d", body_s))

story.append(Paragraph("PER-PERSON SHEET — filled for EACH household member", h2))
story.append(Paragraph(
    "The \u201cHousehold members\u201d screen shows a counter \u201cX recorded out of Y\u201d (adjustable with − / +). "
    "The \u201cFinish list\u201d button is BLOCKED until every declared person is recorded. "
    "If 3 people are declared, the questions below are asked 3 times (one sheet per person):", body_s))
n["v"] = 0
q("Full name", "Free text", indent=10)
q("Phone or email", "Free text", mandatory=False, indent=10)
q("Age", "Number (between 0 and 120)", indent=10)
q("Gender", "Single choice", True, ["Male", "Female"], indent=10)
q("Education level", "Single choice", True,
  ["Primary school", "Middle school", "High school", "University", "No schooling"], indent=10)
q("Profession", "Free text", mandatory=False, indent=10)
q("This person does not travel (baby, elderly, sick...)", "Checkbox",
  mandatory=False, indent=10,
  notes=["If ticked: frequented places are not asked for this person."])

story.append(Paragraph("FREQUENTED PLACES — for EACH person (unless \u201cdoes not travel\u201d)", h2))
story.append(Paragraph(
    "REQUIRED: at least 1 place per person (blocked otherwise). Recommendation shown: 3 to 4 places — "
    "1-2 shops, workplace or school, 1-2 leisure/community places (church, bar, community space...), "
    "1-2 friends. For EACH place added, the following 4 questions are asked:", body_s))
n["v"] = 0
q("Place type", "Single choice", True,
  ["Shop", "Work", "School", "Leisure / community", "Friend / family"], indent=10)
q("Name of the place / person", "Free text", indent=10)
q("Frequency", "Single choice", True,
  ["Every day", "Every week", "Every month", "Rarely"], indent=10)
q("Why? (free text)", "Free text", mandatory=False, indent=10)
story.append(Paragraph(
    "End of the Household survey: \u201cSurvey summary\u201d screen (persons, house, utilities) then "
    "\u201cSave survey\u201d button.", body_s))
story.append(PageBreak())

# ============================== SURVEY 2: COMMERCE ==============================
section(2, "COMMERCE (shop, workshop, clinic)",
        "Flow: type choice → Commerce details (8 questions on one screen) → summary → save.")
q("Business name", "Free text")
q("Owner name", "Free text", mandatory=False)
q("Business phone", "Free text (phone keyboard)", mandatory=False)
q("Products / activities", "Multiple choice + free additions (at least 1 REQUIRED)", True, [
    "General groceries", "Drinks", "Bread & pastry", "Fruits & vegetables", "Meat & fish",
    "Food / cooked meals", "Household products", "Cosmetics & beauty", "Hairdressing",
    "Clothing & shoes", "Fabrics & tailoring", "Phones & accessories",
    "Airtime & Mobile Money", "Electronics", "Spare parts", "Hardware",
    "Building materials", "Cooking gas", "Medicines / pharmacy", "Stationery & school", "Furniture",
], notes=["+ field \u201cOther product or activity...\u201d to freely add anything else."])
q("Number of workers (owner included)", "Number (− / + buttons, minimum 1)")
q("Weekday hours", "Open (opening time + closing time) or Closed")
q("Saturday hours", "Open (times) or Closed", mandatory=False)
q("Sunday hours", "Open (times) or Closed", mandatory=False)
story.append(Paragraph("End: \u201cSummary\u201d screen (Commerce details) then \u201cSave survey\u201d.", body_s))

# ============================== SURVEY 3: PUBLIC SERVICE ==============================
section(3, "PUBLIC SERVICE (school, health, government)",
        "Flow: type choice → Public service details (9 questions on one screen) → summary → save.")
q("Place name", "Free text (e.g. Fotouni public school)")
q("Category", "Single choice", True, [
    "School / education", "Health centre / hospital", "Government office", "Community building",
    "Water point / fountain", "Antenna / infrastructure", "Place of worship", "Other",
], notes=["If \u201cOther\u201d: REQUIRED follow-up question \u201cSpecify the category\u201d (free text)."])
q("Managing organisation", "Free text")
q("Phone", "Free text (phone keyboard)", True,
  notes=["\u201cNo phone\u201d button available if the building has no number (fills \u201cnone\u201d)."])
q("Number of workers (teachers, doctors, agents...)", "Number (direct input, e.g. 12 — enter 0 if none)")
q("Maximum capacity", "Free text", True,
  notes=["Examples shown by category: school → \u201c400 students\u201d; health → \u201c25 beds\u201d; others → \u201c200 users\u201d."])
q("Current usage", "Free text", True,
  notes=["Examples shown by category: school → \u201c320 enrolled students\u201d; health → \u201c40 patients/day, 2 doctors\u201d; others → \u201c80 users/day\u201d."])
q("Opening hours", "Open (opening time + closing time) or Closed")
q("Notes", "Free multiline text", mandatory=False)
story.append(Paragraph("End: \u201cSummary\u201d screen (Public service details) then \u201cSave survey\u201d.", body_s))
story.append(PageBreak())

# ============================== SURVEY 4: HERITAGE ==============================
section(4, "SACRED / TOURIST SITE (heritage)",
        "Flow: type choice → Sacred / tourist site details (14 questions on one screen) → summary → save.")
q("Site name", "Free text (e.g. Fotouni Chiefdom, Metche Falls)")
q("Site type", "Single choice", True, ["Sacred site", "Tourist site", "Both"])
q("Category", "Single choice", True, [
    "Chiefdom / royal palace", "Sacred forest", "Place of worship", "Tomb / mausoleum",
    "Waterfall / natural site", "Cave", "Museum", "Monument / statue", "Viewpoint",
    "Craft market", "Other",
], notes=["If \u201cOther\u201d: REQUIRED follow-up question \u201cSpecify the category\u201d (free text)."])
q("Description / brief history", "Free multiline text", mandatory=False)
q("Manager / authority (chiefdom, community, State...)", "Free text", mandatory=False)
q("Access conditions", "Single choice", True, ["Free access", "Paid access", "Permission required"],
  notes=["If \u201cPaid access\u201d: REQUIRED follow-up question \u201cEntry fee (e.g. 1,000 FCFA)\u201d (free text)."])
q("Visiting hours", "Open (times) or Closed", mandatory=False,
  notes=["If filled, closing time must be after opening time."])
q("Best period to visit", "Free text", mandatory=False)
q("Are photos allowed on site?", "Yes / No")
q("Cultural restrictions (dress code, rituals, forbidden areas...)", "Free multiline text", mandatory=False)
q("Facilities available on site", "Multiple choice", False,
  ["Parking", "Toilets", "Local guide", "Food", "Lodging"])
q("Access road condition", "Single choice", True, ["Good", "Average", "Difficult"])
q("Contact phone", "Free text (phone keyboard)", mandatory=False)
q("Notes", "Free multiline text", mandatory=False)
story.append(Paragraph("End: \u201cSummary\u201d screen (Sacred / tourist site details) then \u201cSave survey\u201d.", body_s))
story.append(PageBreak())

# ============================== APPENDIX ==============================
story.append(Paragraph("APPENDIX — Information collected at ADDRESS CREATION", h1))
story.append(Paragraph(
    "Before any survey, the digital address creation collects the following information "
    "(5-step wizard):", body_s))
n["v"] = 0
story.append(Paragraph("Step 1 — Measure Doorstep", h2))
q("GPS position of the door", "Automatic measurement (latitude, longitude, accuracy in metres)", True,
  notes=["The surveyor stands at the door; accuracy is displayed in real time."])
story.append(Paragraph("Step 2 — Details", h2))
q("District", "Text (auto-detected if online, otherwise manual input)")
q("Sector", "Text (1-2 letters)")
q("Street (number)", "Number")
q("House (number)", "Number")
q("Contact name", "Free text", mandatory=False)
q("Phone", "Free text", mandatory=False)
q("Notes (e.g., 2nd floor, blue door)", "Free text", mandatory=False)
story.append(Paragraph("Step 3 — Direction & Photo", h2))
q("Door direction (azimuth)", "Compass (\u201cLock direction\u201d) OR manual choice among 8 directions", True,
  ["N (0°)", "NE (45°)", "E (90°)", "SE (135°)", "S (180°)", "SW (225°)", "W (270°)", "NW (315°)"],
  notes=["REQUIRED: impossible to continue without an azimuth.",
         "Instruction: stand outside, facing the entrance, phone flat at chest height, top of the phone towards the door."])
q("Building photos (up to 5)", "Camera photos", mandatory=False,
  notes=["Each photo automatically records the GPS position and the camera direction."])
story.append(Paragraph("Step 4 — Satellite correction", h2))
q("Position correction on satellite image", "Drag the orange dot onto the exact door", mandatory=False,
  notes=["The blue dot (measured GPS) stays visible for comparison. Buttons: \u201cSave and continue\u201d or \u201cContinue without correcting\u201d."])
story.append(Paragraph("Step 5 — Review", h2))
story.append(Paragraph("Address recap (EFYL code, coordinates, contact) then save. "
                       "The QR screen then immediately offers: \u201cDo the survey now\u201d.", body_s))

story.append(Spacer(1, 8 * mm))
story.append(HRFlowable(width="100%", color=GREEN, thickness=1.2))
story.append(Paragraph("Document automatically generated from the EFYL AddressBook application code — August 2026.",
                       ParagraphStyle("f", parent=subtitle_s, fontSize=8)))

doc = SimpleDocTemplate(
    "/app/memory/EFYL_Questionnaires_Complets_EN.pdf",
    pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
    title="EFYL — Complete questionnaire reference",
)
doc.build(story)
print("PDF generated: /app/memory/EFYL_Questionnaires_Complets_EN.pdf")
