#!/usr/bin/env bun
/**
 * Phase 1: Inspect Frappe Employee DocType
 *
 * Queries the live Frappe instance to extract Employee DocType metadata:
 * - Required fields
 * - Optional fields
 * - Field types
 * - Link fields
 * - Select options
 * - Child tables
 *
 * This provides the authoritative target schema for OrangeHRM → Frappe field mapping.
 */

import { $ } from "bun";

const SITE_NAME = "ciago.localhost";

console.log("🔍 Inspecting Frappe Employee DocType...\n");

try {
  // Use bench execute to run Python code in the Frappe context
  const pythonScript = `
import frappe
import json

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
`;

  // Execute via Docker
  const result = await $`docker exec frappe-backend bash -c "bench --site ${SITE_NAME} execute '${pythonScript}'"`.text();

  const data = JSON.parse(result);

  console.log(`📋 Employee DocType: ${data.fields.length} fields`);
  console.log(`   Naming: ${data.naming_series}`);
  console.log(`   Submittable: ${data.is_submittable ? "Yes" : "No"}`);
  console.log(`   Track Changes: ${data.track_changes ? "Yes" : "No"}`);

  // Analyze required fields
  const requiredFields = data.fields.filter((f: any) => f.reqd);
  console.log(`\n✅ Required fields (${requiredFields.length}):`);
  for (const field of requiredFields) {
    console.log(`   ${field.fieldname}: ${field.fieldtype} - "${field.label}"`);
  }

  // Analyze Link fields (these require existing records)
  const linkFields = data.fields.filter((f: any) => f.fieldtype === "Link");
  console.log(`\n🔗 Link fields (${linkFields.length}) - require existing records:`);
  for (const field of linkFields.slice(0, 20)) {
    const req = field.reqd ? " (REQUIRED)" : "";
    console.log(`   ${field.fieldname}: Link to ${field.options}${req}`);
  }

  // Analyze child tables
  const childTables = data.fields.filter((f: any) => f.fieldtype === "Table");
  console.log(`\n📊 Child tables (${childTables.length}):`);
  for (const field of childTables) {
    console.log(`   ${field.fieldname}: Table of ${field.options}`);
  }

  // Analyze Select fields (these have fixed options)
  const selectFields = data.fields.filter((f: any) => f.fieldtype === "Select" && field.options);
  console.log(`\n📝 Select fields with options (${selectFields.filter((f: any) => f.options).length}):`);
  for (const field of selectFields.slice(0, 10)) {
    if (field.options) {
      const options = field.options.split('\n').slice(0, 3).join(', ');
      console.log(`   ${field.fieldname}: ${options}${field.options.split('\n').length > 3 ? '...' : ''}`);
    }
  }

  // Save full metadata to file
  await Bun.write("docs/frappe-employee-doctype-raw.json", JSON.stringify(data, null, 2));
  console.log(`\n💾 Full metadata saved to: docs/frappe-employee-doctype-raw.json`);

} catch (error) {
  console.error("❌ Error inspecting DocType:", error);
  process.exit(1);
}
