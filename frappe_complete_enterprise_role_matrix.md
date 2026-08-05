# Frappe / ERPNext Complete Enterprise Role & Workspace Mapping Matrix

This document provides a comprehensive mapping of **all 54 standard Frappe/ERPNext roles** present in your setup along with **top MNC technical and executive roles**. Each role is explicitly mapped to the **20 Workspace options** available in the Frappe Desk sidebar layout.

---

## Workspace Options Legend (20 Total)

1. `Home`
2. `Accounting`
3. `Buying`
4. `Selling`
5. `Stock`
6. `Assets`
7. `HR`
8. `Manufacturing`
9. `Quality`
10. `Projects`
11. `Support`
12. `Users`
13. `Website`
14. `Payroll`
15. `CRM`
16. `Tools`
17. `ERPNext Settings`
18. `Integrations`
19. `ERPNext Integrations`
20. `Build`

---

## Environment Enforcement Rules

- **Development Environment:** The `Build` workspace is enabled for Developers/System Managers to configure DocTypes, Client Scripts, and Workflows.
- **Production Environment:** `developer_mode` MUST be set to `0` in `site_config.json`. The `Build` workspace MUST be hidden across ALL roles in production. Changes are deployed strictly through Git and CI/CD pipelines.
- **Desk Access Rule:** Roles with `Desk Access = False` (e.g., `Customer`, `Supplier`, `Guest`) interact only via the Web Portal (`/me`). They are denied access to the backend Desk UI entirely.

---

## 1. Core System & Technical Administration (Standard + MNC)

| Role Name                           | Desk Access | Visible Workspaces (Show)                                                                       | Hidden Workspaces (Hide)                                                                                                                        |
| :---------------------------------- | :---------: | :---------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Administrator**                   |     Yes     | ALL 20 Workspaces                                                                               | None                                                                                                                                            |
| **System Manager**                  |     Yes     | `Home`, `Users`, `Website`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations` | `Accounting`, `Buying`, `Selling`, `Stock`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Payroll`, `CRM`, `Build` (Prod) |
| **Script Manager**                  |     Yes     | `Home`, `Tools`, `Build` (Dev only)                                                             | All operational and transaction modules                                                                                                         |
| **Report Manager**                  |     Yes     | `Home`, `Tools`                                                                                 | All configuration, HR, and transaction modules                                                                                                  |
| **Workspace Manager**               |     Yes     | `Home`, `Tools`                                                                                 | All transaction, HR, and settings modules                                                                                                       |
| **Dashboard Manager**               |     Yes     | `Home`, `Tools`                                                                                 | All transaction, HR, and settings modules                                                                                                       |
| **Desk User**                       |     Yes     | `Home`                                                                                          | Base role; visibility depends on additional assigned roles                                                                                      |
| **Software Engineer (SWE/SDE)**     |     Yes     | `Home`, `Projects`, `Support`                                                                   | All administrative, financial, HR, and configuration modules                                                                                    |
| **DevOps / System Engineer**        |     Yes     | `Home`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`                     | All transactional, HR, financial, and schema modification modules                                                                               |
| **Site Reliability Engineer (SRE)** |     Yes     | `Home`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`                     | All business, HR, financial, and operational modules                                                                                            |
| **Cloud / Systems Architect**       |     Yes     | `Home`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`                     | All business, HR, financial, and operational modules                                                                                            |
| **Security Engineer (IAM/CISO)**    |     Yes     | `Home`, `Users`, `Tools`, `ERPNext Settings`                                                    | All business transactional write workspaces                                                                                                     |

---

## 2. Base System & External Access (Standard Frappe)

| Role Name    | Desk Access | Visible Workspaces (Show)        | Hidden Workspaces (Hide)                 |
| :----------- | :---------: | :------------------------------- | :--------------------------------------- |
| **All**      |     N/A     | Base role assigned to every user | Inherits permissions from explicit roles |
| **Guest**    |   **No**    | None (Web Portal Only)           | All Desk Workspaces                      |
| **Customer** |   **No**    | None (Portal Only at `/me`)      | All Desk Workspaces                      |
| **Supplier** |   **No**    | None (Portal Only at `/me`)      | All Desk Workspaces                      |

---

## 3. Human Resources & People Operations (Standard + MNC)

| Role Name                                | Desk Access | Visible Workspaces (Show)                        | Hidden Workspaces (Hide)                                                                                                                                                                                           |
| :--------------------------------------- | :---------: | :----------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Employee**                             |     Yes     | `Home`, `Projects`, `Support`                    | `Accounting`, `Buying`, `Selling`, `Stock`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Users`, `Website`, `Payroll`, `CRM`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`         |
| **Employee Self Service**                |     Yes     | `Home`                                           | All other modules (Interacts via ESS portal or Home shortcuts)                                                                                                                                                     |
| **HR User**                              |     Yes     | `Home`, `HR`, `Tools`                            | `Accounting`, `Buying`, `Selling`, `Stock`, `Assets`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build` |
| **HR Manager**                           |     Yes     | `Home`, `HR`, `Users`, `Tools`                   | `Accounting`, `Buying`, `Selling`, `Stock`, `Assets`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Website`, `Payroll`, `CRM`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`          |
| **Leave Approver**                       |     Yes     | `Home`, `HR` (Filtered)                          | All other modules                                                                                                                                                                                                  |
| **Expense Approver**                     |     Yes     | `Home`, `HR` (Filtered), `Accounting` (Filtered) | All other modules                                                                                                                                                                                                  |
| **Interviewer**                          |     Yes     | `Home`, `HR` (Recruitment only)                  | All other modules                                                                                                                                                                                                  |
| **Chief Human Resources Officer (CHRO)** |     Yes     | `Home`, `HR`, `Payroll`, `Users`, `Tools`        | `Accounting`, `Buying`, `Selling`, `Stock`, `Assets`, `Manufacturing`, `Quality`, `Integrations`, `Build`                                                                                                          |

---

## 4. Finance & Accounting Track (Standard + MNC)

| Role Name                               | Desk Access | Visible Workspaces (Show)                                             | Hidden Workspaces (Hide)                                                                                                                                                                                   |
| :-------------------------------------- | :---------: | :-------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Accounts User**                       |     Yes     | `Home`, `Accounting`, `Tools`                                         | `Buying`, `Selling`, `Stock`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build` |
| **Accounts Manager**                    |     Yes     | `Home`, `Accounting`, `Assets`, `Tools`                               | `Buying`, `Selling`, `Stock`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`           |
| **Auditor**                             |     Yes     | `Home`, `Accounting`, `Buying`, `Selling`, `Stock`, `Assets`, `Tools` | `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`                                                |
| **FP&A Manager / Financial Controller** |     Yes     | `Home`, `Accounting`, `Assets`, `Buying`, `Tools`                     | `Selling`, `Stock`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`                     |
| **Chief Financial Officer (CFO)**       |     Yes     | `Home`, `Accounting`, `Assets`, `Buying`, `Selling`, `Tools`          | `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`                                                |

---

## 5. Sales, CRM & Content Management (Standard + MNC)

| Role Name                      | Desk Access | Visible Workspaces (Show)         | Hidden Workspaces (Hide)                                                                                                                                                                                        |
| :----------------------------- | :---------: | :-------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sales User**                 |     Yes     | `Home`, `Selling`, `CRM`          | `Accounting`, `Buying`, `Stock`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build` |
| **Sales Manager**              |     Yes     | `Home`, `Selling`, `CRM`, `Tools` | `Accounting`, `Buying`, `Stock`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`          |
| **Sales Master Manager**       |     Yes     | `Home`, `Selling`, `CRM`, `Tools` | `Accounting`, `Buying`, `Stock`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`          |
| **Website Manager**            |     Yes     | `Home`, `Website`, `Tools`        | `Accounting`, `Buying`, `Selling`, `Stock`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Payroll`, `CRM`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`   |
| **Blogger**                    |     Yes     | `Home`, `Website`                 | All transactional and configuration modules                                                                                                                                                                     |
| **Newsletter Manager**         |     Yes     | `Home`, `Website`, `CRM`          | All transactional and configuration modules                                                                                                                                                                     |
| **Knowledge Base Contributor** |     Yes     | `Home`, `Website`                 | All transactional and configuration modules                                                                                                                                                                     |
| **Knowledge Base Editor**      |     Yes     | `Home`, `Website`, `Tools`        | All transactional and configuration modules                                                                                                                                                                     |
| **Translator**                 |     Yes     | `Home`, `Tools`                   | All transactional and configuration modules                                                                                                                                                                     |
| **Inbox User**                 |     Yes     | `Home`, `Tools`                   | All transactional and configuration modules                                                                                                                                                                     |

---

## 6. Procurement, Inventory & Logistics (Standard + MNC)

| Role Name                           | Desk Access | Visible Workspaces (Show)                    | Hidden Workspaces (Hide)                                                                                                                                                                                                 |
| :---------------------------------- | :---------: | :------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purchase User**                   |     Yes     | `Home`, `Buying`, `Stock`                    | `Accounting`, `Selling`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`           |
| **Purchase Manager**                |     Yes     | `Home`, `Buying`, `Stock`, `Assets`, `Tools` | `Accounting`, `Selling`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`                              |
| **Purchase Master Manager**         |     Yes     | `Home`, `Buying`, `Stock`, `Assets`, `Tools` | `Accounting`, `Selling`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`                              |
| **Stock User**                      |     Yes     | `Home`, `Stock`                              | `Accounting`, `Buying`, `Selling`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build` |
| **Stock Manager**                   |     Yes     | `Home`, `Stock`, `Assets`, `Tools`           | `Accounting`, `Buying`, `Selling`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`                    |
| **Item Manager**                    |     Yes     | `Home`, `Stock`, `Buying`, `Manufacturing`   | `Accounting`, `Selling`, `Assets`, `HR`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`                            |
| **Fulfillment User**                |     Yes     | `Home`, `Stock`                              | `Accounting`, `Buying`, `Selling`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build` |
| **Delivery User**                   |     Yes     | `Home`, `Stock`                              | `Accounting`, `Buying`, `Selling`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build` |
| **Delivery Manager**                |     Yes     | `Home`, `Stock`, `Tools`                     | `Accounting`, `Buying`, `Selling`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`          |
| **Fleet Manager**                   |     Yes     | `Home`, `Stock`, `Tools`                     | `Accounting`, `Buying`, `Selling`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`          |
| **Procurement / Sourcing Director** |     Yes     | `Home`, `Buying`, `Stock`, `Assets`, `Tools` | `Accounting`, `Selling`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`                              |

---

## 7. Operations, Manufacturing, Quality & Maintenance (Standard + MNC)

| Role Name                           | Desk Access | Visible Workspaces (Show)                            | Hidden Workspaces (Hide)                                                                                                                                                                                                |
| :---------------------------------- | :---------: | :--------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manufacturing User**              |     Yes     | `Home`, `Manufacturing`, `Stock`                     | `Accounting`, `Buying`, `Selling`, `Assets`, `HR`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`                 |
| **Manufacturing Manager**           |     Yes     | `Home`, `Manufacturing`, `Stock`, `Quality`, `Tools` | `Accounting`, `Buying`, `Selling`, `Assets`, `HR`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`                                     |
| **Quality Manager**                 |     Yes     | `Home`, `Quality`, `Manufacturing`, `Stock`          | `Accounting`, `Buying`, `Selling`, `Assets`, `HR`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`                            |
| **Maintenance User**                |     Yes     | `Home`, `Assets`                                     | `Accounting`, `Buying`, `Selling`, `Stock`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build` |
| **Maintenance Manager**             |     Yes     | `Home`, `Assets`, `Stock`, `Tools`                   | `Accounting`, `Buying`, `Selling`, `HR`, `Manufacturing`, `Quality`, `Projects`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`                   |
| **Projects User**                   |     Yes     | `Home`, `Projects`                                   | `Accounting`, `Buying`, `Selling`, `Stock`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Support`, `Users`, `Website`, `Payroll`, `CRM`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`   |
| **Projects Manager**                |     Yes     | `Home`, `Projects`, `Support`, `Tools`               | `Accounting`, `Buying`, `Selling`, `Stock`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Users`, `Website`, `Payroll`, `CRM`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`                       |
| **Support Team**                    |     Yes     | `Home`, `Support`, `Projects`                        | `Accounting`, `Buying`, `Selling`, `Stock`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Users`, `Website`, `Payroll`, `CRM`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`              |
| **Technical Program Manager (TPM)** |     Yes     | `Home`, `Projects`, `Support`, `Tools`               | `Accounting`, `Buying`, `Selling`, `Stock`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Users`, `Website`, `Payroll`, `CRM`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`                       |
| **Product Manager (PM)**            |     Yes     | `Home`, `Projects`, `Support`, `CRM`                 | `Accounting`, `Buying`, `Selling`, `Stock`, `Assets`, `HR`, `Manufacturing`, `Quality`, `Users`, `Website`, `Payroll`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`                     |

---

## 8. Domain Specific & Industry Modules (Standard Frappe)

| Role Name                | Desk Access | Visible Workspaces (Show) | Hidden Workspaces (Hide)                                                           |
| :----------------------- | :---------: | :------------------------ | :--------------------------------------------------------------------------------- |
| **Agriculture User**     |     Yes     | `Home`                    | Standard business workspaces hidden unless custom Agriculture workspace is enabled |
| **Agriculture Manager**  |     Yes     | `Home`, `Stock`, `Tools`  | Standard business workspaces hidden unless custom Agriculture workspace is enabled |
| **Academics User**       |     Yes     | `Home`                    | Standard business workspaces hidden unless custom Education workspace is enabled   |
| **Analytics**            |     Yes     | `Home`, `Tools`           | All transactional modules                                                          |
| **Prepared Report User** |     Yes     | `Home`, `Tools`           | All transactional modules                                                          |

---

## 9. Executive & Corporate Governance (MNC Track)

| Role Name                          | Desk Access | Visible Workspaces (Show)                                                            | Hidden Workspaces (Hide)                                                 |
| :--------------------------------- | :---------: | :----------------------------------------------------------------------------------- | :----------------------------------------------------------------------- |
| **Chief Executive Officer (CEO)**  |     Yes     | `Home`, `Accounting`, `Selling`, `Buying`, `Projects`, `CRM`, `Support`              | `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Build`      |
| **Chief Technology Officer (CTO)** |     Yes     | `Home`, `Tools`, `ERPNext Settings`, `Integrations`, `ERPNext Integrations`, `Users` | Day-to-day accounting, sales, and manufacturing transactional workspaces |
| **Legal & Compliance Counsel**     |     Yes     | `Home`, `Tools`                                                                      | Operates via direct DocType links for contracts and compliance           |
