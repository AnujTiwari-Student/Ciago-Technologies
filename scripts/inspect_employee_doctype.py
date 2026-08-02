#!/usr/bin/env python3
"""
Inspect Frappe Employee DocType metadata
Run via: bench --site ciago.localhost execute scripts/inspect_employee_doctype.py
"""

import frappe
import json

def inspect_employee_doctype():
    # Get Employee DocType metadata
    meta = frappe.get_meta("Employee")

    # Extract field information
    fields = []
    for field in meta.fields:
        field_info = {
            "fieldname": field.fieldname,
            "fieldtype": field.fieldtype,
            "label": field.label or "",
            "reqd": int(field.reqd or 0),
            "options": field.options or "",
            "read_only": int(field.read_only or 0),
            "hidden": int(field.hidden or 0),
        }
        fields.append(field_info)

    # Get DocType-level metadata
    doctype_info = {
        "name": meta.name,
        "naming_series": meta.autoname,
        "is_submittable": int(meta.is_submittable or 0),
        "track_changes": int(meta.track_changes or 0),
        "fields": fields
    }

    print(json.dumps(doctype_info, indent=2))

if __name__ == "__main__":
    inspect_employee_doctype()
