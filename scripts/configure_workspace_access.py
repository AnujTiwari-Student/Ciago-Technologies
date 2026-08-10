#!/usr/bin/env python3
"""
Configure workspace access for specific roles in Frappe

This script assigns workspaces to roles so users with those roles
can see the appropriate workspace content.

Run this in the Frappe container:
bench --site hrms.ciagotech.com console
"""

import frappe

def configure_workspace_roles():
    """
    Assign workspaces to appropriate roles
    """

    # Define workspace-to-role mappings
    workspace_role_mappings = [
        # HR-related workspaces
        ("HR", ["HR User", "HR Manager", "Employee"]),
        ("Payroll", ["HR Manager", "Payroll User"]),
        ("Recruitment", ["HR User", "HR Manager", "Interviewer"]),

        # Employee workspaces
        ("Team", ["Employee", "Employee Self Service"]),

        # Project workspaces
        ("Projects", ["Projects User", "Projects Manager"]),

        # System/Technical workspaces
        ("Settings", ["System Manager", "Site Reliability Engineer (SRE)", "DevOps / System Engineer"]),
        ("Integrations", ["System Manager", "Site Reliability Engineer (SRE)", "DevOps / System Engineer"]),

        # Support workspace
        ("Support", ["Support Team"]),
    ]

    print("\n🔧 Configuring Workspace Role Access\n")
    print("=" * 60)

    for workspace_name, roles in workspace_role_mappings:
        try:
            # Check if workspace exists
            if not frappe.db.exists("Workspace", workspace_name):
                print(f"⚠️  Workspace '{workspace_name}' not found - skipping")
                continue

            # Get workspace
            workspace = frappe.get_doc("Workspace", workspace_name)

            # Clear existing roles
            workspace.roles = []

            # Add new roles
            for role in roles:
                workspace.append("roles", {
                    "role": role
                })

            # Save workspace
            workspace.save(ignore_permissions=True)
            frappe.db.commit()

            print(f"✅ {workspace_name}")
            print(f"   Assigned to: {', '.join(roles)}")

        except Exception as e:
            print(f"❌ Error with workspace '{workspace_name}': {str(e)}")

    print("\n" + "=" * 60)
    print("✅ Workspace configuration complete!")
    print("\n📝 Users need to logout/login to see changes")

if __name__ == "__main__":
    configure_workspace_roles()
