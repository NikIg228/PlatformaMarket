"""Build the ten owner-requested local preview PDFs from the same fixture manifest."""
import json
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

root = Path(__file__).resolve().parents[1]
products = json.loads((root / "apps/buyer-web/app/data/product-page-preview.json").read_text(encoding="utf-8"))
output = root / "apps/buyer-web/app/data/product-preview-documents"
output.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont("Preview", "C:/Windows/Fonts/arial.ttf"))
pdfmetrics.registerFont(TTFont("PreviewBold", "C:/Windows/Fonts/arialbd.ttf"))
green = colors.HexColor("#007A59")
text = colors.HexColor("#172A26")
body = ParagraphStyle("body", fontName="Preview", fontSize=10, leading=15, textColor=text, spaceAfter=10)
heading = ParagraphStyle("heading", parent=body, fontName="PreviewBold", fontSize=23, leading=29, spaceAfter=16)
subheading = ParagraphStyle("subheading", parent=body, fontName="PreviewBold", fontSize=14, leading=20, spaceAfter=10)
caption = ParagraphStyle("caption", parent=body, fontSize=8, leading=12, textColor=colors.HexColor("#60716D"))

def para(value, style=body):
    return Paragraph(escape(str(value)).replace("\n", "<br/>"), style)

def footer(canvas, doc):
    canvas.setStrokeColor(green)
    canvas.line(44, 71, A4[0] - 44, 71)
    canvas.setFont("Preview", 8)
    canvas.setFillColor(colors.HexColor("#60716D"))
    canvas.drawString(44, 55, "Учебный экземпляр для проверки карточки товара.")
    canvas.drawString(44, 42, "Не является сертификатом или инструкцией производителя.")
    canvas.drawRightString(A4[0] - 44, 42, str(doc.page))

for product in products:
    for document in product["documents"]:
        target = output / f'{product["id"]}-{document["key"]}.pdf'
        doc = SimpleDocTemplate(str(target), pagesize=A4, rightMargin=44, leftMargin=44,
                                topMargin=42, bottomMargin=91, title=f'{document["name"]} — {product["title"]}', author="PlatformaMarket")
        story = [para("PLATFORMAMARKET / КАТАЛОГ", caption), Spacer(1, 12), para(document["name"], heading), para(product["title"], subheading)]
        if document["key"] == "specification":
            story += [para("Исполнения" , subheading), para(" · ".join(v["label"] for v in product["variants"])), Spacer(1, 8)]
            rows = [[para("Параметр", caption), para("Значение", caption)]]
            rows += [[para(k), para(v)] for k, v in product["variants"][0]["attributes"].items()]
            table = Table(rows, colWidths=[170, A4[0]-258], hAlign="LEFT")
            table.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "TOP"), ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#F0F4F2")), ("LINEBELOW", (0,0), (-1,-1), 0.5, colors.HexColor("#D7E2DE")), ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10), ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 4)]))
            story += [table, Spacer(1, 18), para("Фасовки", subheading)]
        else:
            story += [para("Комплект поставки", subheading), para(product["variants"][0]["attributes"]["Комплектация"]), Spacer(1, 12), para("Варианты упаковки", subheading)]
        for pack in product["packages"]:
            story.append(para(f'{pack["name"]} — {pack["quantity"]} базовых комплектов.'))
        if document["key"] == "contents":
            story += [Spacer(1, 18), para("При получении", subheading), para("Сопоставьте артикул и выбранное исполнение с заказом. Проверьте количество комплектов, целостность упаковки и наличие документов поставщика."), para("Параметры и состав поставки в этом файле предназначены для визуальной проверки интерфейса. Для закупки используйте подтверждённые сведения поставщика.")]
        doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(f"Created {len(products)*2} local preview PDFs in {output}")
