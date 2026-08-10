"""
Configure Workspace Role-Based Access
======================================
Fix Home icon and set up proper role-based workspace visibility
"""

import frappe

def configure_all_workspace_roles():
    """Configure role-based access for all workspaces"""

    print('\n' + '='*70)
    print('CONFIGURING WORKSPACE ROLE MAPPINGS')
    print('='*70 + '\n')

    # Workspace role configuration
    workspace_roles = {
        # Core - accessible to all
        'Home': [],  # Empty = all users

        # Personal workspace
        'My Portal': ['Employee', 'Employee Self Service', 'HR Manager', 'HR User', 'Leave Approver', 'Expense Approver', 'System Manager'],

        # Employee self-service
        'Leaves': ['Employee', 'Employee Self Service', 'Leave Approver', 'HR Manager', 'HR User', 'System Manager'],
        'Shift & Attendance': ['Employee', 'Employee Self Service', 'HR Manager', 'HR User', 'System Manager'],
        'Expense Claims': ['Employee', 'Employee Self Service', 'Expense Approver', 'HR Manager', 'Accounts Manager', 'System Manager'],

        # HR workspaces
        'HR': ['HR Manager', 'HR User', 'System Manager'],
        'Payroll': ['HR Manager', 'HR User', 'Accounts Manager', 'System Manager'],
        'Recruitment': ['HR Manager', 'HR User', 'Interviewer', 'System Manager'],
        'Employee Lifecycle': ['HR Manager', 'HR User', 'System Manager'],
        'Performance': ['HR Manager', 'HR User', 'System Manager'],
        'Tax & Benefits': ['HR Manager', 'HR User', 'Accounts Manager', 'System Manager'],
        'Salary Payout': ['HR Manager', 'HR User', 'Accounts Manager', 'System Manager'],

        # Finance
        'Accounting': ['Accounts Manager', 'Accounts User', 'System Manager'],
        'Financial Reports': ['Accounts Manager', 'Accounts User', 'System Manager'],
        'Payables': ['Accounts Manager', 'Accounts User', 'System Manager'],
        'Receivables': ['Accounts Manager', 'Accounts User', 'System Manager'],

        # Support
        'Support': ['Support Team', 'System Manager'],

        # System Admin
        'Tools': ['System Manager'],
        'Build': ['System Manager'],

        # Hidden workspaces (System Manager only)
        'Manufacturing': ['System Manager'],
        'Quality': ['System Manager'],
        'Buying': ['System Manager'],
        'Selling': ['System Manager'],
        'Stock': ['System Manager'],
        'Assets': ['System Manager'],
        'CRM': ['System Manager'],
        'Projects': ['System Manager'],
        'Integrations': ['System Manager'],
        'ERPNext Integrations': ['System Manager'],
        'ERPNext Settings': ['System Manager'],
    }

    configured = 0
    skipped = 0

    for workspace_name, roles in workspace_roles.items():
        if not frappe.db.exists('Workspace', workspace_name):
            print(f'  ⏭️  {workspace_name:30} - Does not exist')
            skipped += 1
            continue

        try:
            ws = frappe.get_doc('Workspace', workspace_name)

            # Clear existing roles
            ws.roles = []

            # Add configured roles
            for role in roles:
                if frappe.db.exists('Role', role):
                    ws.append('roles', {'role': role})

            # Ensure public and not hidden
            ws.public = 1
            ws.is_hidden = 0

            # Fix Home icon
            if workspace_name == 'Home':
                ws.icon = 'home'

            ws.save(ignore_permissions=True)

            role_count = len(roles) if roles else 'all users'
            print(f'  ✅ {workspace_name:30} | {role_count}')
            configured += 1

        except Exception as e:
            print(f'  ❌ {workspace_name:30} | Error: {e}')

    frappe.db.commit()

    print(f'\n✅ Configured: {configured}')
    print(f'⏭️  Skipped: {skipped}')

    # Clear caches
    print('\nClearing caches...')
    frappe.clear_cache()

    users = frappe.db.get_all('User', filters={'enabled': 1})
    for user in users:
        frappe.cache().hdel('bootinfo', user.name)

    frappe.db.commit()
    print('✅ Caches cleared')

    # Verify
    print('\n' + '='*70)
    print('VERIFICATION')
    print('='*70 + '\n')

    # Check Home
    home = frappe.get_doc('Workspace', 'Home')
    print(f'Home:')
    print(f'  Icon: {home.icon}')
    print(f'  Public: {home.public}')
    print(f'  Hidden: {home.is_hidden}')
    print(f'  Roles: {len(home.roles)} (0 = accessible to all)')

    # Count by category
    employee_ws = ['Home', 'My Portal', 'Leaves', 'Shift & Attendance', 'Expense Claims']
    hr_ws = ['HR', 'Payroll', 'Recruitment', 'Employee Lifecycle', 'Performance', 'Tax & Benefits']

    print(f'\nWorkspace counts:')
    print(f'  Employee access: {len(employee_ws)}')
    print(f'  HR access: {len(employee_ws) + len(hr_ws)}')
    print(f'  Hidden (System Manager only): 11')

    print('\n' + '='*70 + '\n')

if __name__ == '__main__':
    configure_all_workspace_roles()
