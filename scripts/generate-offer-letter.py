#!/usr/bin/env python3
"""
Generate Offer Letter PDF with company logo
Requirements: pip install reportlab svglib pillow
"""

import os
import sys
from datetime import datetime
from pathlib import Path
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPDF

def convert_svg_to_rlg(svg_path):
    """Convert SVG to ReportLab graphics object"""
    try:
        drawing = svg2rlg(svg_path)
        return drawing
    except Exception as e:
        print(f"Warning: Could not load SVG logo: {e}")
        return None

def generate_offer_letter(
    candidate_name: str,
    position: str,
    joining_date: str,
    salary_ctc: str,
    email: str,
    output_path: str,
    logo_path: str = "public/logo-dark.svg"
):
    """
    Generate offer letter PDF

    Args:
        candidate_name: Full name of the candidate
        position: Job position/designation
        joining_date: Date of joining (format: DD-MM-YYYY or YYYY-MM-DD)
        salary_ctc: Annual CTC (e.g., "₹12,00,000" or "12 LPA")
        email: Candidate email
        output_path: Output PDF file path
        logo_path: Path to company logo SVG (relative to project root)
    """

    # Create PDF document
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.5*inch,
        bottomMargin=0.75*inch
    )

    # Container for the 'Flowable' objects
    elements = []

    # Styles
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        textColor=colors.HexColor('#1a1a1a'),
        spaceAfter=12,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )

    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#2c3e50'),
        spaceAfter=10,
        spaceBefore=15,
        fontName='Helvetica-Bold'
    )

    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['BodyText'],
        fontSize=11,
        textColor=colors.HexColor('#333333'),
        spaceAfter=8,
        alignment=TA_JUSTIFY,
        leading=16
    )

    date_style = ParagraphStyle(
        'DateStyle',
        parent=styles['BodyText'],
        fontSize=11,
        textColor=colors.HexColor('#666666'),
        spaceAfter=20,
        alignment=TA_LEFT
    )

    # Add company logo
    try:
        if os.path.exists(logo_path):
            logo = convert_svg_to_rlg(logo_path)
            if logo:
                # Scale logo to appropriate size
                logo.width = 180
                logo.height = logo.height * (180 / logo.width)
                logo.hAlign = 'CENTER'
                elements.append(logo)
                elements.append(Spacer(1, 0.3*inch))
    except Exception as e:
        print(f"Could not add logo: {e}")

    # Company header
    company_header = Paragraph(
        "<b>CIAGO TECHNOLOGIES</b><br/>"
        "<font size=10>Technology • Innovation • Excellence</font>",
        title_style
    )
    elements.append(company_header)
    elements.append(Spacer(1, 0.1*inch))

    # Horizontal line
    line_table = Table([['']], colWidths=[6.5*inch])
    line_table.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor('#3498db')),
    ]))
    elements.append(line_table)
    elements.append(Spacer(1, 0.3*inch))

    # Date
    today = datetime.now().strftime("%d %B, %Y")
    date_text = Paragraph(f"<b>Date:</b> {today}", date_style)
    elements.append(date_text)

    # Title
    title = Paragraph("<b>OFFER OF EMPLOYMENT</b>", title_style)
    elements.append(title)
    elements.append(Spacer(1, 0.2*inch))

    # Salutation
    salutation = Paragraph(f"Dear <b>{candidate_name}</b>,", body_style)
    elements.append(salutation)
    elements.append(Spacer(1, 0.15*inch))

    # Opening paragraph
    opening = Paragraph(
        f"We are pleased to offer you the position of <b>{position}</b> at Ciago Technologies. "
        f"We believe that your skills, experience, and enthusiasm will be a valuable addition to our team. "
        f"Your anticipated start date is <b>{joining_date}</b>.",
        body_style
    )
    elements.append(opening)
    elements.append(Spacer(1, 0.15*inch))

    # Position details section
    position_heading = Paragraph("<b>POSITION DETAILS</b>", heading_style)
    elements.append(position_heading)

    # Position details table
    position_data = [
        ['Position:', position],
        ['Department:', 'Technology'],
        ['Employment Type:', 'Full-time'],
        ['Location:', 'Bangalore, India / Remote'],
        ['Date of Joining:', joining_date],
        ['Annual CTC:', salary_ctc],
    ]

    position_table = Table(position_data, colWidths=[2*inch, 4*inch])
    position_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#333333')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f5f5f5')),
    ]))
    elements.append(position_table)
    elements.append(Spacer(1, 0.2*inch))

    # Benefits section
    benefits_heading = Paragraph("<b>BENEFITS & PERKS</b>", heading_style)
    elements.append(benefits_heading)

    benefits = Paragraph(
        "• Competitive salary with annual performance reviews<br/>"
        "• Health insurance for you and your family<br/>"
        "• Flexible work hours and remote work options<br/>"
        "• Professional development and training opportunities<br/>"
        "• Paid time off and holidays<br/>"
        "• Modern work environment with latest technology",
        body_style
    )
    elements.append(benefits)
    elements.append(Spacer(1, 0.2*inch))

    # Next steps
    next_steps_heading = Paragraph("<b>NEXT STEPS</b>", heading_style)
    elements.append(next_steps_heading)

    next_steps = Paragraph(
        "To accept this offer, please reply to this email with your confirmation by "
        f"<b>{(datetime.now()).strftime('%d %B, %Y')}</b>. "
        "You will receive a joining letter with further details about your onboarding process.",
        body_style
    )
    elements.append(next_steps)
    elements.append(Spacer(1, 0.2*inch))

    # Closing
    closing = Paragraph(
        "We are excited to have you join our team and look forward to working with you!",
        body_style
    )
    elements.append(closing)
    elements.append(Spacer(1, 0.3*inch))

    # Signature
    signature = Paragraph(
        "Sincerely,<br/><br/>"
        "<b>Ciago Technologies</b><br/>"
        "Human Resources Team<br/>"
        "hr@ciagotech.com",
        body_style
    )
    elements.append(signature)
    elements.append(Spacer(1, 0.3*inch))

    # Footer
    footer_line = Table([['']], colWidths=[6.5*inch])
    footer_line.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (-1, 0), 0.5, colors.HexColor('#cccccc')),
    ]))
    elements.append(footer_line)

    footer = Paragraph(
        "<font size=9 color='#666666'>"
        "Ciago Technologies | www.ciagotech.com | hr@ciagotech.com<br/>"
        "This is a confidential document. Please do not share without permission."
        "</font>",
        ParagraphStyle('Footer', parent=styles['BodyText'], alignment=TA_CENTER, fontSize=9)
    )
    elements.append(footer)

    # Build PDF
    doc.build(elements)
    print(f"[SUCCESS] Offer letter generated: {output_path}")
    return output_path


if __name__ == "__main__":
    # Example usage
    if len(sys.argv) < 6:
        print("Usage: python generate-offer-letter.py <name> <position> <joining_date> <salary> <email> [output_path]")
        print("Example: python generate-offer-letter.py 'John Doe' 'Senior Software Engineer' '01-03-2026' '₹18,00,000' 'john@example.com'")
        sys.exit(1)

    name = sys.argv[1]
    position = sys.argv[2]
    joining_date = sys.argv[3]
    salary = sys.argv[4]
    email = sys.argv[5]
    output = sys.argv[6] if len(sys.argv) > 6 else f"offer_letter_{name.replace(' ', '_')}.pdf"

    generate_offer_letter(name, position, joining_date, salary, email, output)
