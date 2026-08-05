#!/usr/bin/env python3
"""
Generate Joining Letter PDF with company logo
Requirements: pip install reportlab svglib pillow
"""

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from svglib.svglib import svg2rlg

def convert_svg_to_rlg(svg_path):
    """Convert SVG to ReportLab graphics object"""
    try:
        drawing = svg2rlg(svg_path)
        return drawing
    except Exception as e:
        print(f"Warning: Could not load SVG logo: {e}")
        return None

def generate_joining_letter(
    candidate_name: str,
    position: str,
    joining_date: str,
    employee_id: str,
    department: str,
    reporting_to: str,
    email: str,
    output_path: str,
    frappe_url: str = "https://frappe.ciagotech.com",
    logo_path: str = "public/logo-dark.svg"
):
    """
    Generate joining letter PDF

    Args:
        candidate_name: Full name of the candidate
        position: Job position/designation
        joining_date: Date of joining (format: DD-MM-YYYY)
        employee_id: Employee ID assigned
        department: Department name
        reporting_to: Name of reporting manager
        email: Work email assigned
        output_path: Output PDF file path
        frappe_url: Frappe dashboard URL
        logo_path: Path to company logo SVG
    """

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=0.75*inch,
        leftMargin=0.75*inch,
        topMargin=0.5*inch,
        bottomMargin=0.75*inch
    )

    elements = []
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

    # Add company logo
    try:
        if os.path.exists(logo_path):
            logo = convert_svg_to_rlg(logo_path)
            if logo:
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
    date_text = Paragraph(f"<b>Date:</b> {today}", body_style)
    elements.append(date_text)
    elements.append(Spacer(1, 0.1*inch))

    # Title
    title = Paragraph("<b>JOINING LETTER & ONBOARDING GUIDE</b>", title_style)
    elements.append(title)
    elements.append(Spacer(1, 0.2*inch))

    # Salutation
    salutation = Paragraph(f"Dear <b>{candidate_name}</b>,", body_style)
    elements.append(salutation)
    elements.append(Spacer(1, 0.15*inch))

    # Welcome message
    welcome = Paragraph(
        f"Welcome to Ciago Technologies! We are thrilled to have you join our team as <b>{position}</b>. "
        f"This letter contains important information about your first day and onboarding process.",
        body_style
    )
    elements.append(welcome)
    elements.append(Spacer(1, 0.15*inch))

    # Employee details
    details_heading = Paragraph("<b>YOUR EMPLOYMENT DETAILS</b>", heading_style)
    elements.append(details_heading)

    details_data = [
        ['Full Name:', candidate_name],
        ['Employee ID:', employee_id],
        ['Designation:', position],
        ['Department:', department],
        ['Reporting To:', reporting_to],
        ['Date of Joining:', joining_date],
        ['Work Email:', email],
    ]

    details_table = Table(details_data, colWidths=[2.2*inch, 4*inch])
    details_table.setStyle(TableStyle([
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
    elements.append(details_table)
    elements.append(Spacer(1, 0.2*inch))

    # Frappe dashboard access
    dashboard_heading = Paragraph("<b>FRAPPE HR DASHBOARD ACCESS</b>", heading_style)
    elements.append(dashboard_heading)

    dashboard_box = Paragraph(
        f"<font color='#d35400'><b>📅 Dashboard Access:</b></font><br/><br/>"
        f"<b>URL:</b> <font color='#3498db'><u>{frappe_url}</u></font><br/>"
        f"<b>Access Date:</b> <font color='#27ae60'><b>{joining_date}</b></font><br/>"
        f"<b>Login Email:</b> {email}<br/><br/>"
        f"<font color='#e74c3c'><b>⚠️ IMPORTANT:</b></font> Your Frappe dashboard will be unlocked on <b>{joining_date}</b>. "
        f"You will receive a separate email with your login credentials and password setup link on your joining date. "
        f"Please keep this email safe for future reference.",
        ParagraphStyle(
            'DashboardBox',
            parent=body_style,
            leftIndent=15,
            rightIndent=15,
            spaceBefore=10,
            spaceAfter=10,
            borderColor=colors.HexColor('#3498db'),
            borderWidth=1,
            borderPadding=15,
            backColor=colors.HexColor('#ecf0f1')
        )
    )
    elements.append(dashboard_box)
    elements.append(Spacer(1, 0.2*inch))

    # First day instructions
    first_day_heading = Paragraph("<b>FIRST DAY INSTRUCTIONS</b>", heading_style)
    elements.append(first_day_heading)

    first_day = Paragraph(
        f"<b>Date & Time:</b> {joining_date} at 10:00 AM IST<br/><br/>"
        "<b>What to Bring:</b><br/>"
        "• Original & copies of all educational certificates<br/>"
        "• Original & copies of previous employment documents<br/>"
        "• PAN card, Aadhaar card, and passport size photographs<br/>"
        "• Bank account details (for salary processing)<br/>"
        "• Previous employer's experience letter and relieving letter (if applicable)<br/><br/>"
        "<b>Contact Person:</b><br/>"
        f"Your reporting manager <b>{reporting_to}</b> will greet you. "
        "You can also reach out to HR at <b>hr@ciagotech.com</b> for any questions.",
        body_style
    )
    elements.append(first_day)
    elements.append(Spacer(1, 0.2*inch))

    # Onboarding checklist
    checklist_heading = Paragraph("<b>ONBOARDING CHECKLIST</b>", heading_style)
    elements.append(checklist_heading)

    checklist = Paragraph(
        "□ Complete documentation and verification<br/>"
        "□ Receive IT equipment (laptop, access cards, etc.)<br/>"
        "□ Set up Frappe HR dashboard account<br/>"
        "□ Complete company orientation program<br/>"
        "□ Meet your team members<br/>"
        "□ Set up development environment (for technical roles)<br/>"
        "□ Review and sign employee handbook<br/>"
        "□ Enroll in benefits programs",
        body_style
    )
    elements.append(checklist)
    elements.append(Spacer(1, 0.2*inch))

    # Contact information
    contact_heading = Paragraph("<b>CONTACT INFORMATION</b>", heading_style)
    elements.append(contact_heading)

    contact = Paragraph(
        "<b>HR Department:</b> hr@ciagotech.com<br/>"
        "<b>IT Support:</b> it-support@ciagotech.com<br/>"
        "<b>Office Address:</b> Bangalore, India<br/>"
        "<b>Working Hours:</b> 10:00 AM - 7:00 PM IST (Flexible)",
        body_style
    )
    elements.append(contact)
    elements.append(Spacer(1, 0.3*inch))

    # Closing
    closing = Paragraph(
        "We look forward to seeing you on your first day! If you have any questions before your start date, "
        "please don't hesitate to reach out to us.",
        body_style
    )
    elements.append(closing)
    elements.append(Spacer(1, 0.3*inch))

    # Signature
    signature = Paragraph(
        "Best regards,<br/><br/>"
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
    print(f"✅ Joining letter generated: {output_path}")
    return output_path


if __name__ == "__main__":
    if len(sys.argv) < 8:
        print("Usage: python generate-joining-letter.py <name> <position> <joining_date> <employee_id> <department> <reporting_to> <email> [output_path]")
        print("Example: python generate-joining-letter.py 'John Doe' 'Senior Software Engineer' '01-03-2026' 'EMP001' 'Engineering' 'Jane Smith' 'john.doe@ciagotech.com'")
        sys.exit(1)

    name = sys.argv[1]
    position = sys.argv[2]
    joining_date = sys.argv[3]
    employee_id = sys.argv[4]
    department = sys.argv[5]
    reporting_to = sys.argv[6]
    email = sys.argv[7]
    output = sys.argv[8] if len(sys.argv) > 8 else f"joining_letter_{name.replace(' ', '_')}.pdf"

    generate_joining_letter(name, position, joining_date, employee_id, department, reporting_to, email, output)
