# -*- coding: utf-8 -*-
"""Rendu PDF simple et lisible d'un document Markdown (titres, listes, tableaux,
blocs de code, gras/italique/code en ligne). Utilisé pour les livrables Home."""
import re
import sys

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (HRFlowable, KeepTogether, ListFlowable, ListItem,
                                Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle)

F = "/app/frontend/node_modules/@expo-google-fonts/dm-sans"
pdfmetrics.registerFont(TTFont("DM", f"{F}/400Regular/DMSans_400Regular.ttf"))
pdfmetrics.registerFont(TTFont("DM-B", f"{F}/700Bold/DMSans_700Bold.ttf"))
pdfmetrics.registerFont(TTFont("DM-I", f"{F}/400Regular_Italic/DMSans_400Regular_Italic.ttf"))
M = "/app/frontend/node_modules/@expo-google-fonts/jetbrains-mono"
pdfmetrics.registerFont(TTFont("JB", f"{M}/400Regular/JetBrainsMono_400Regular.ttf"))
pdfmetrics.registerFontFamily("DM", normal="DM", bold="DM-B", italic="DM-I")

BLUE = colors.HexColor("#0E7FC1")
DEEP = colors.HexColor("#0A5A8A")
INK = colors.HexColor("#0F1E2A")
GREY = colors.HexColor("#4A5C6B")
SOFT = colors.HexColor("#E6F4FD")

S = {
    "h1": ParagraphStyle("h1", fontName="DM-B", fontSize=17, leading=21, textColor=BLUE,
                         spaceBefore=16, spaceAfter=6),
    "h2": ParagraphStyle("h2", fontName="DM-B", fontSize=13.5, leading=17, textColor=DEEP,
                         spaceBefore=12, spaceAfter=4),
    "h3": ParagraphStyle("h3", fontName="DM-B", fontSize=11.5, leading=15, textColor=INK,
                         spaceBefore=9, spaceAfter=3),
    "h4": ParagraphStyle("h4", fontName="DM-B", fontSize=10.5, leading=14, textColor=GREY,
                         spaceBefore=7, spaceAfter=2),
    "p": ParagraphStyle("p", fontName="DM", fontSize=9.6, leading=13.6, textColor=INK,
                        spaceAfter=4),
    "li": ParagraphStyle("li", fontName="DM", fontSize=9.4, leading=13, textColor=INK),
    "quote": ParagraphStyle("quote", fontName="DM-I", fontSize=9.4, leading=13.4,
                            textColor=DEEP, leftIndent=10, borderPadding=4,
                            backColor=SOFT, spaceAfter=5),
    "code": ParagraphStyle("code", fontName="JB", fontSize=7.6, leading=10.4, textColor=INK,
                           backColor=colors.HexColor("#F2F6FA"), borderPadding=5, spaceAfter=5),
    "th": ParagraphStyle("th", fontName="DM-B", fontSize=8.2, leading=11, textColor=colors.white),
    "td": ParagraphStyle("td", fontName="DM", fontSize=8.2, leading=11, textColor=INK),
    "title": ParagraphStyle("title", fontName="DM-B", fontSize=26, leading=31, textColor=BLUE,
                            alignment=TA_CENTER),
    "sub": ParagraphStyle("sub", fontName="DM", fontSize=11, leading=15, textColor=GREY,
                          alignment=TA_CENTER),
}


def esc(t: str) -> str:
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def inline(t: str) -> str:
    t = esc(t)
    t = re.sub(r"`([^`]+)`", r'<font name="JB" size="8.4">\1</font>', t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"(?<![\w*])\*([^*]+)\*(?![\w*])", r"<i>\1</i>", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<link href="\2" color="#0E7FC1">\1</link>', t)
    return t


def split_row(line: str):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def build(md_path: str, pdf_path: str, title: str, subtitle: str):
    lines = open(md_path, encoding="utf-8").read().split("\n")
    story = [Spacer(1, 40 * mm), Paragraph(title, S["title"]), Spacer(1, 6 * mm),
             Paragraph(subtitle, S["sub"]), Spacer(1, 10 * mm),
             HRFlowable(width="60%", color=BLUE, thickness=1.2, hAlign="CENTER"),
             Spacer(1, 6 * mm)]
    i = 0
    bullets = []

    def flush_bullets():
        nonlocal bullets
        if bullets:
            story.append(ListFlowable(
                [ListItem(Paragraph(b, S["li"]), leftIndent=14) for b in bullets],
                bulletType="bullet", bulletColor=BLUE, bulletFontSize=6,
                start="circle", leftIndent=12, spaceAfter=5))
            bullets = []

    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()
        if line.startswith("```"):
            flush_bullets()
            i += 1
            buf = []
            while i < len(lines) and not lines[i].startswith("```"):
                buf.append(esc(lines[i]).replace(" ", "&nbsp;"))
                i += 1
            story.append(Paragraph("<br/>".join(buf), S["code"]))
            i += 1
            continue
        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s:\-|]+\|?$", lines[i + 1].strip()):
            flush_bullets()
            header = split_row(line)
            i += 2
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(split_row(lines[i]))
                i += 1
            ncol = len(header)
            width = 174 * mm
            data = [[Paragraph(inline(c), S["th"]) for c in header]]
            for r in rows:
                r = (r + [""] * ncol)[:ncol]
                data.append([Paragraph(inline(c), S["td"]) for c in r])
            first = 26 * mm if ncol > 3 else 40 * mm
            rest = (width - first) / (ncol - 1) if ncol > 1 else width
            tbl = Table(data, colWidths=[first] + [rest] * (ncol - 1), repeatRows=1)
            tbl.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), BLUE),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F6FAFD")]),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#DCE7F0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ]))
            story.append(tbl)
            story.append(Spacer(1, 5))
            continue
        if not line.strip():
            flush_bullets()
            i += 1
            continue
        if re.match(r"^---+$", line.strip()):
            flush_bullets()
            story.append(HRFlowable(width="100%", color=colors.HexColor("#DCE7F0"),
                                    thickness=0.8, spaceBefore=6, spaceAfter=6))
            i += 1
            continue
        m = re.match(r"^(#{1,4})\s+(.*)$", line)
        if m:
            flush_bullets()
            lvl = len(m.group(1))
            story.append(Paragraph(inline(m.group(2)), S[f"h{lvl}"]))
            i += 1
            continue
        if line.startswith(">"):
            flush_bullets()
            story.append(Paragraph(inline(line.lstrip("> ").strip()), S["quote"]))
            i += 1
            continue
        m = re.match(r"^\s*(?:[-*]|\d+\.)\s+(.*)$", line)
        if m:
            bullets.append(inline(m.group(1)))
            i += 1
            continue
        flush_bullets()
        story.append(Paragraph(inline(line.strip()), S["p"]))
        i += 1
    flush_bullets()

    doc = SimpleDocTemplate(pdf_path, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm, title=title)

    def deco(canvas, docu):
        canvas.saveState()
        canvas.setFont("DM", 7.5)
        canvas.setFillColor(GREY)
        canvas.drawString(18 * mm, 10 * mm, title)
        canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"page {docu.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=deco, onLaterPages=deco)
    print("PDF généré :", pdf_path)


if __name__ == "__main__":
    build(*sys.argv[1:5])
