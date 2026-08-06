/**
 * Joining Date Management Functions
 *
 * Handles setting joining dates, generating letters, and sending hiring emails
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAdminDb } from "@/lib/db/admin";
import { format, startOfDay, endOfDay } from "date-fns";
import { generateOfferLetter, generateJoiningLetter, cleanupLetterFiles } from "./letter-generator";
import { generateHiringEmailWithLetters } from "./email-templates/hiring-with-letters";
import { sendCredentialsEmail } from "./cron/send-joining-credentials";
import fs from "fs";
import path from "path";

/**
 * Set joining date for a hired candidate and send offer + joining letters
 */
export const setJoiningDate = createServerFn({ method: "POST" })
  .validator(
    z.object({
      applicationId: z.string().uuid(),
      joiningDate: z.string().datetime(), // ISO 8601 format
    })
  )
  .handler(async ({ data }) => {
    const db = getAdminDb();
    const { applicationId, joiningDate } = data;

    try {
      // 1. Fetch application
      const application = await db.jobApplication.findUnique({
        where: { id: applicationId },
      });

      if (!application) {
        throw new Error("Application not found");
      }

      // 2. Validate application status
      if (application.status !== "hired") {
        throw new Error("Application status must be 'hired' to set joining date");
      }

      // 3. Validate background check is passed (cleared)
      const bgCheck = await db.backgroundVerification.findUnique({
        where: { applicationId },
      });
      if (!bgCheck || (bgCheck.status !== "passed" && bgCheck.status !== "waived")) {
        throw new Error("Background verification must be passed or waived before setting joining date");
      }

      // 4. Fetch salary from job posting
      const jobPosting = await db.jobPosting.findUnique({
        where: { id: application.roleId },
        select: { salaryMinInr: true, salaryMaxInr: true },
      });

      const annualCtc = jobPosting?.salaryMaxInr
        ? Number(jobPosting.salaryMaxInr)
        : jobPosting?.salaryMinInr
          ? Number(jobPosting.salaryMinInr)
          : null;
      const salaryCtcDisplay = annualCtc
        ? `₹${annualCtc.toLocaleString("en-IN")}`
        : "As per offer";

      // 5. Update application with joining date
      const joiningDateObj = new Date(joiningDate);
      await db.jobApplication.update({
        where: { id: applicationId },
        data: {
          joiningDate: joiningDateObj,
        },
      });

      // 6. Generate offer letter
      const joiningDateFormatted = format(joiningDateObj, "dd-MM-yyyy");
      const offerLetterResult = await generateOfferLetter({
        candidateName: application.fullName,
        position: application.roleTitle,
        joiningDate: joiningDateFormatted,
        salaryCtc: salaryCtcDisplay,
        email: application.email,
      });

      if (!offerLetterResult.success) {
        throw new Error(`Failed to generate offer letter: ${offerLetterResult.error}`);
      }

      // 6. Generate joining letter
      const workEmail = application.email; // TODO: Generate proper work email
      const employeeId = `EMP${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`; // TODO: Generate proper employee ID

      const joiningLetterResult = await generateJoiningLetter({
        candidateName: application.fullName,
        position: application.roleTitle,
        joiningDate: joiningDateFormatted,
        employeeId: employeeId,
        department: "Engineering", // TODO: Get from job posting
        reportingTo: "Hiring Manager", // TODO: Get from application/org structure
        email: workEmail,
      });

      if (!joiningLetterResult.success) {
        throw new Error(`Failed to generate joining letter: ${joiningLetterResult.error}`);
      }

      // 7. Prepare email with attachments
      const firstName = application.fullName.split(" ")[0];
      const emailContent = generateHiringEmailWithLetters({
        candidateName: application.fullName,
        firstName,
        position: application.roleTitle,
        joiningDate: joiningDateObj,
        salaryCtc: salaryCtcDisplay,
        workEmail,
      });

      // 8. Read PDF files as attachments
      const offerLetterBuffer = fs.readFileSync(offerLetterResult.filePath!);
      const joiningLetterBuffer = fs.readFileSync(joiningLetterResult.filePath!);

      // 9. Send email with Resend using fetch API
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        throw new Error("RESEND_API_KEY not configured");
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: "Ciago Technologies <hr@ciagotech.com>",
          to: application.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          attachments: [
            {
              filename: `Offer_Letter_${application.fullName.replace(/\s+/g, "_")}.pdf`,
              content: offerLetterBuffer.toString("base64"),
            },
            {
              filename: `Joining_Letter_${application.fullName.replace(/\s+/g, "_")}.pdf`,
              content: joiningLetterBuffer.toString("base64"),
            },
          ],
        }),
      });

      const emailResult = await response.json();

      if (!response.ok) {
        throw new Error(`Resend API error: ${JSON.stringify(emailResult)}`);
      }

      console.log(`[joining-date] Email sent successfully:`, emailResult.id);

      // 10. Update application with sent timestamps
      await db.jobApplication.update({
        where: { id: applicationId },
        data: {
          offerLetterSentAt: new Date(),
          joiningLetterSentAt: new Date(),
        },
      });

      // 11. Track email in database
      await db.email.create({
        data: {
          sender: "Ciago Technologies <hr@ciagotech.com>",
          recipient: application.email,
          subject: emailContent.subject,
          emailType: "hiring_notification",
          status: "sent",
          resendId: emailResult.id,
          userId: application.userId,
          applicationId: application.id,
          metadata: {
            joiningDate: joiningDateObj.toISOString(),
            offerLetterPath: offerLetterResult.filePath,
            joiningLetterPath: joiningLetterResult.filePath,
          },
        },
      });

      // 12. Cleanup PDF files after sending
      await cleanupLetterFiles([offerLetterResult.filePath!, joiningLetterResult.filePath!]);

      // 13. If joining date is today or earlier, send Frappe credentials immediately
      let credentialsSent = false;
      if (joiningDateObj <= endOfDay(new Date()) && application.frappeProvisioningState === "succeeded") {
        console.log(`[joining-date] Joining date is today/past — sending credentials email immediately`);
        credentialsSent = await sendCredentialsEmail(application);
      }

      return {
        success: true,
        message: credentialsSent
          ? "Joining date set, letters sent, and credentials email sent"
          : "Joining date set and letters sent successfully",
        data: {
          applicationId: application.id,
          joiningDate: joiningDateObj,
          emailSent: true,
          emailId: emailResult.data?.id,
          credentialsSent,
        },
      };
    } catch (error) {
      console.error("[joining-date] Error setting joining date:", error);
      throw new Error(
        `Failed to set joining date: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

/**
 * Check if user can access Frappe dashboard based on joining date
 */
export const checkFrappeDashboardAccess = createServerFn({ method: "POST" })
  .validator(
    z.object({
      applicationId: z.string().uuid(),
    })
  )
  .handler(async ({ data }) => {
    const db = getAdminDb();
    const { applicationId } = data;

    try {
      const application = await db.jobApplication.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          joiningDate: true,
          status: true,
          frappeProvisioningState: true,
        },
      });

      if (!application) {
        throw new Error("Application not found");
      }

      // Check if hired
      if (application.status !== "hired") {
        return {
          hasAccess: false,
          reason: "not_hired",
          message: "Application status is not 'hired'",
        };
      }

      // Check if joining date is set
      if (!application.joiningDate) {
        return {
          hasAccess: false,
          reason: "no_joining_date",
          message: "Joining date has not been set yet",
        };
      }

      // Check if joining date has passed
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const joiningDate = new Date(application.joiningDate);
      joiningDate.setHours(0, 0, 0, 0);

      if (today < joiningDate) {
        const daysUntil = Math.ceil((joiningDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        return {
          hasAccess: false,
          reason: "before_joining_date",
          message: "Dashboard will unlock on your joining date",
          joiningDate: application.joiningDate,
          daysUntil,
        };
      }

      // Check Frappe provisioning status
      if (application.frappeProvisioningState !== "succeeded") {
        return {
          hasAccess: false,
          reason: "provisioning_pending",
          message: "Your account is being set up. Please check back shortly.",
        };
      }

      // All checks passed - user has access
      return {
        hasAccess: true,
        reason: "access_granted",
        message: "Welcome! Your dashboard is ready.",
        joiningDate: application.joiningDate,
      };
    } catch (error) {
      console.error("[joining-date] Error checking dashboard access:", error);
      throw new Error(
        `Failed to check dashboard access: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

/**
 * Get all applications with joining dates (for admin dashboard)
 */
export const getApplicationsWithJoiningDates = createServerFn({ method: "GET" }).handler(async () => {
  const db = getAdminDb();

  try {
    const applications = await db.jobApplication.findMany({
      where: {
        joiningDate: {
          not: null,
        },
        status: "hired",
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        roleTitle: true,
        joiningDate: true,
        offerLetterSentAt: true,
        joiningLetterSentAt: true,
        frappeProvisioningState: true,
        createdAt: true,
      },
      orderBy: {
        joiningDate: "asc",
      },
    });

    return {
      success: true,
      data: applications,
    };
  } catch (error) {
    console.error("[joining-date] Error fetching applications:", error);
    throw new Error(
      `Failed to fetch applications: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

/**
 * Get joining dates for today (for cron job)
 */
export const getTodayJoiningDates = createServerFn({ method: "GET" }).handler(async () => {
  const db = getAdminDb();

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const applications = await db.jobApplication.findMany({
      where: {
        joiningDate: {
          gte: today,
          lt: tomorrow,
        },
        status: "hired",
        frappeProvisioningState: "succeeded",
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        roleTitle: true,
        joiningDate: true,
        userId: true,
      },
    });

    return {
      success: true,
      data: applications,
      count: applications.length,
    };
  } catch (error) {
    console.error("[joining-date] Error fetching today's joining dates:", error);
    throw new Error(
      `Failed to fetch today's joining dates: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});
