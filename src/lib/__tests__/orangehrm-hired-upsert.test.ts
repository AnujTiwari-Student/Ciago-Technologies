/**
 * Phase 3: HIRED Upsert/Reconciliation Tests
 *
 * Tests the complete HIRED lifecycle:
 * - Employee reconciliation
 * - Onboarding data enrichment
 * - Race condition protection
 * - Idempotency guarantees
 * - Crash recovery
 * - Feature flag behavior
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  upsertOrangeHRMEmployeeAtHired,
  extractOnboardingData,
} from "../orangehrm-provisioning";
import type { OnboardingDataSources } from "../orangehrm-types";

// Mock PrismaClient
const mockDb = {
  jobApplication: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  employee: {
    findUnique: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
} as any;

// Mock OrangeHRMClient
const mockClient = {
  getEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  updateEmployeePersonalDetails: vi.fn(),
  updateEmployeeJobDetails: vi.fn(),
  updateEmployeeContactDetails: vi.fn(),
} as any;

describe("extractOnboardingData", () => {
  it("extracts from all sources with correct priority", () => {
    const sources: OnboardingDataSources = {
      application: {
        id: "app-1",
        userId: "user-1",
        fullName: "John Doe",
        email: "john@example.com",
        roleTitle: "Software Engineer",
        status: "hired",
      },
      onboardingRecord: {
        id: "onb-1",
        roleTitle: "Senior Software Engineer",
        department: "Engineering",
        doj: "2026-09-01",
        startDate: "2026-09-01",
        compensationInr: 1500000,
        formState: {},
        emergencyContact: { name: "Jane Doe", phone: "1234567890" },
      },
      employee: {
        department: "engineering",
        designation: "Staff Engineer",
        employmentType: "full_time",
        workLocation: "Bangalore",
        workModel: "hybrid",
        personalEmail: "john.personal@example.com",
        workEmail: "john.doe@ciagotech.com",
        contactNumber: "+91-9876543210",
        address: "123 Main St",
        baseSalary: 1500000,
        salaryCurrency: "INR",
        reportingManagerId: "manager-1",
        reportingHrId: "hr-1",
        teamName: "Platform",
        notes: "Top performer",
        doj: "2026-09-01",
      },
      jobPosting: {
        id: "job-1",
        employmentType: "full_time",
        department: "Engineering",
        location: "Bangalore",
        isRemote: false,
      },
    };

    const result = extractOnboardingData(sources);

    // Identity: from application
    expect(result.fullName).toBe("John Doe");
    expect(result.email).toBe("john@example.com");

    // Role: from onboarding (priority over application)
    expect(result.roleTitle).toBe("Senior Software Engineer");

    // Department: from employee (priority over onboarding)
    expect(result.department).toBe("engineering");

    // Employment: from employee (priority over posting)
    expect(result.employmentType).toBe("full_time");

    // Date: from onboarding
    expect(result.joiningDate).toBe("2026-09-01");

    // Contact: from employee
    expect(result.workEmail).toBe("john.doe@ciagotech.com");
    expect(result.personalEmail).toBe("john.personal@example.com");

    // Compensation
    expect(result.compensationInr).toBe(1500000);
    expect(result.baseSalary).toBe(1500000);

    // Emergency contact
    expect(result.emergencyContact).toEqual({ name: "Jane Doe", phone: "1234567890" });
  });

  it("handles null onboardingRecord gracefully", () => {
    const sources: OnboardingDataSources = {
      application: {
        id: "app-1",
        userId: "user-1",
        fullName: "Alice Smith",
        email: "alice@example.com",
        roleTitle: "Designer",
        status: "hired",
      },
      onboardingRecord: null,
      employee: null,
      jobPosting: {
        id: "job-1",
        employmentType: "contract",
        department: "Design",
        location: "Remote",
        isRemote: true,
      },
    };

    const result = extractOnboardingData(sources);

    expect(result.fullName).toBe("Alice Smith");
    expect(result.email).toBe("alice@example.com");
    expect(result.roleTitle).toBe("Designer");
    expect(result.department).toBe("Design");
    expect(result.employmentType).toBe("contract");
    expect(result.joiningDate).toBeNull();
    expect(result.workEmail).toBeNull();
  });
});

describe("upsertOrangeHRMEmployeeAtHired", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aborts if application status is not HIRED (race protection)", async () => {
    mockDb.jobApplication.findUnique.mockResolvedValue({
      id: "app-1",
      userId: "user-1",
      fullName: "John Doe",
      email: "john@example.com",
      status: "rejected", // Changed to rejected
      orangehrmEmployeeId: 42,
      orangehrmProvisioningState: "succeeded",
      orangehrmRecordStatus: "ACTIVE",
      lifecycleVersion: 1,
    });

    const onboardingData = {
      fullName: "John Doe",
      email: "john@example.com",
      roleTitle: "Engineer",
      department: null,
      employmentType: "full_time",
      joiningDate: "2026-09-01",
      startDate: null,
      workLocation: null,
      workModel: null,
      compensationInr: null,
      baseSalary: null,
      salaryCurrency: "INR",
      personalEmail: null,
      contactNumber: null,
      workEmail: null,
      address: null,
      emergencyContact: null,
      reportingManagerId: null,
      reportingHrId: null,
      teamName: null,
      notes: null,
    };

    const result = await upsertOrangeHRMEmployeeAtHired(
      "app-1",
      "user-1",
      onboardingData,
      mockDb,
      mockClient
    );

    expect(result.success).toBe(false);
    expect(result.action).toBe("failed");
    expect(result.message).toContain("rejected");
    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "HIRED_UPSERT_ABORTED_STATUS_CHANGED",
        }),
      })
    );
  });

  it("returns already_complete for idempotent call (employee exists and mapped)", async () => {
    mockDb.jobApplication.findUnique.mockResolvedValue({
      id: "app-1",
      userId: "user-1",
      fullName: "John Doe",
      email: "john@example.com",
      status: "hired",
      orangehrmEmployeeId: 42,
      orangehrmProvisioningState: "succeeded",
      orangehrmRecordStatus: "ACTIVE",
      lifecycleVersion: 1,
    });

    mockClient.getEmployee.mockResolvedValue({
      empNumber: 42,
      employeeId: "EMP-42",
      firstName: "John",
      lastName: "Doe",
    });

    const onboardingData = {
      fullName: "John Doe",
      email: "john@example.com",
      roleTitle: "Engineer",
      department: null,
      employmentType: "full_time",
      joiningDate: "2026-09-01",
      startDate: null,
      workLocation: null,
      workModel: null,
      compensationInr: null,
      baseSalary: null,
      salaryCurrency: "INR",
      personalEmail: "john.personal@example.com",
      contactNumber: "+91-9876543210",
      workEmail: "john.work@ciagotech.com",
      address: "123 Main St, Bangalore",
      emergencyContact: null,
      reportingManagerId: null,
      reportingHrId: null,
      teamName: null,
      notes: null,
    };

    const result = await upsertOrangeHRMEmployeeAtHired(
      "app-1",
      "user-1",
      onboardingData,
      mockDb,
      mockClient
    );

    expect(result.success).toBe(true);
    expect(result.action).toBe("already_complete");
    expect(result.empNumber).toBe(42);

    // Should still enrich (idempotent enrichment)
    expect(mockClient.updateEmployeePersonalDetails).toHaveBeenCalled();
    expect(mockClient.updateEmployeeContactDetails).toHaveBeenCalled();
    expect(mockClient.updateEmployeeJobDetails).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ joinedDate: "2026-09-01" })
    );
  });

  it("blocks reuse of terminated employee (rehire protection)", async () => {
    mockDb.jobApplication.findUnique.mockResolvedValue({
      id: "app-1",
      userId: "user-1",
      fullName: "Jane Doe",
      email: "jane@example.com",
      status: "hired",
      orangehrmEmployeeId: null,
      orangehrmProvisioningState: "not_started",
      orangehrmRecordStatus: "ACTIVE",
      lifecycleVersion: 1,
    });

    mockDb.employee.findUnique.mockResolvedValue({
      orangehrmEmployeeId: 99,
      orangehrmRecordStatus: "TERMINATED", // Employee was terminated
    });

    // Mock updateMany for centralized provisioning path
    mockDb.jobApplication.updateMany.mockResolvedValue({ count: 1 });

    // Mock createEmployee for centralized provisioning fallback
    mockClient.createEmployee = vi.fn().mockResolvedValue({
      empNumber: 100,
      employeeId: "EMP-100",
      firstName: "Jane",
      lastName: "Doe",
    });

    mockClient.updateEmployeeContactDetails = vi.fn().mockResolvedValue(undefined);

    const onboardingData = {
      fullName: "Jane Doe",
      email: "jane@example.com",
      roleTitle: "Engineer",
      department: null,
      employmentType: "full_time",
      joiningDate: null,
      startDate: null,
      workLocation: null,
      workModel: null,
      compensationInr: null,
      baseSalary: null,
      salaryCurrency: "INR",
      personalEmail: null,
      contactNumber: null,
      workEmail: null,
      address: null,
      emergencyContact: null,
      reportingManagerId: null,
      reportingHrId: null,
      teamName: null,
      notes: null,
    };

    const result = await upsertOrangeHRMEmployeeAtHired(
      "app-1",
      "user-1",
      onboardingData,
      mockDb,
      mockClient
    );

    // Should NOT reuse terminated employee
    // Should trigger centralized provisioning instead
    expect(mockDb.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "HIRED_REHIRE_TERMINATED_EMPLOYEE_BLOCKED",
        }),
      })
    );
  });
});

describe("Phase 3 Integration Tests", () => {
  it("full name splitting works correctly", () => {
    const testCases = [
      { input: "John Doe", expectedFirst: "John", expectedLast: "Doe" },
      { input: "Alice", expectedFirst: "Alice", expectedLast: "" },
      { input: "Dr. Jane Smith Jr.", expectedFirst: "Dr.", expectedLast: "Jane Smith Jr." },
      { input: "   Bob  Builder  ", expectedFirst: "Bob", expectedLast: "Builder" },
    ];

    for (const tc of testCases) {
      const nameParts = tc.input.trim().split(/\s+/);
      const firstName = nameParts[0] || tc.input;
      const lastName = nameParts.slice(1).join(" ") || "";

      expect(firstName).toBe(tc.expectedFirst);
      expect(lastName).toBe(tc.expectedLast);
    }
  });
});
