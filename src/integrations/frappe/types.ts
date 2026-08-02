/**
 * TypeScript types for Frappe HR / ERPNext v15 API
 * Based on live API verification against ciago.localhost site
 *
 * Docs: Phase 1 findings (docs/phase1-findings.md)
 * Field reference: docs/frappe-hr-employee-fields.md
 */

/**
 * Frappe Employee record structure
 * Based on /api/resource/Employee response
 */
export type FrappeEmployee = {
  name: string; // Employee ID (e.g. "HR-EMP-00001")
  employee: string; // Same as name
  employee_name: string; // Derived: first_name + last_name
  first_name: string;
  middle_name?: string;
  last_name?: string;
  gender: "Male" | "Female" | "Other";
  date_of_birth: string; // YYYY-MM-DD
  date_of_joining: string; // YYYY-MM-DD
  status: "Active" | "Inactive" | "Suspended" | "Left";
  company: string; // Link to Company

  // Optional contact fields
  personal_email?: string;
  company_email?: string;
  cell_number?: string;
  prefered_contact_email?: string;

  // Optional company details (Link fields)
  department?: string; // Link to Department
  designation?: string; // Link to Designation
  employment_type?: string; // Link to Employment Type
  branch?: string; // Link to Branch
  reports_to?: string; // Link to Employee

  // Optional address fields
  current_address?: string;
  permanent_address?: string;

  // Optional emergency contact
  emergency_contact_name?: string;
  emergency_phone?: string;
  relation?: string;

  // System fields
  creation?: string;
  modified?: string;
  owner?: string;
  modified_by?: string;
  docstatus?: number;
};

/**
 * Minimal payload for creating an employee
 * Based on verified required fields from Phase 1
 */
export type CreateEmployeePayload = {
  first_name: string;
  gender: "Male" | "Female" | "Other";
  date_of_birth: string; // YYYY-MM-DD
  date_of_joining: string; // YYYY-MM-DD
  company: string;

  // Optional fields
  last_name?: string;
  middle_name?: string;
  personal_email?: string;
  company_email?: string;
  cell_number?: string;
  current_address?: string;
  permanent_address?: string;
  emergency_contact_name?: string;
  emergency_phone?: string;
  relation?: string;
};

/**
 * Payload for updating employee fields
 * All fields optional (partial update supported)
 */
export type UpdateEmployeePayload = {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  personal_email?: string;
  company_email?: string;
  cell_number?: string;
  date_of_joining?: string;
  current_address?: string;
  permanent_address?: string;
  emergency_contact_name?: string;
  emergency_phone?: string;
  relation?: string;

  // Link fields (require existing records)
  designation?: string;
  department?: string;
  employment_type?: string;
  branch?: string;

  // Status change
  status?: "Active" | "Inactive" | "Suspended" | "Left";
  relieving_date?: string; // When status = "Left"
};

/**
 * Frappe API error response structure
 */
export type FrappeErrorResponse = {
  exception: string;
  exc_type: string;
  exc: string;
  _server_messages?: string;
  _error_message?: string;
};

/**
 * Frappe API success response wrapper
 */
export type FrappeAPIResponse<T> = {
  data: T;
};

/**
 * Frappe API list response wrapper
 */
export type FrappeListResponse<T> = {
  data: Array<{ name: string } & Partial<T>>;
};
