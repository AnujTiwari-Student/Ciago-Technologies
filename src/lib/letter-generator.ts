/**
 * PDF Letter Generation - Python Script Wrapper
 *
 * Executes Python scripts to generate offer and joining letters with company logo
 */

import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

export interface OfferLetterParams {
  candidateName: string;
  position: string;
  joiningDate: string; // Format: DD-MM-YYYY
  salaryCtc: string; // e.g., "₹12,00,000" or "12 LPA"
  email: string;
}

export interface JoiningLetterParams {
  candidateName: string;
  position: string;
  joiningDate: string; // Format: DD-MM-YYYY
  employeeId: string;
  department: string;
  reportingTo: string;
  email: string;
  frappeUrl?: string;
}

export interface LetterGenerationResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

/**
 * Generate offer letter PDF
 */
export async function generateOfferLetter(
  params: OfferLetterParams,
  outputPath?: string
): Promise<LetterGenerationResult> {
  try {
    const projectRoot = process.cwd();
    const scriptPath = path.join(projectRoot, "scripts", "generate-offer-letter.py");
    const logoPath = path.join(projectRoot, "public", "logo-dark.svg");

    // Default output path
    const fileName = `offer_letter_${params.candidateName.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
    const outputFile = outputPath || path.join(projectRoot, ".tests", fileName);

    // Ensure output directory exists
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Escape arguments for shell
    const escapedArgs = [
      `"${params.candidateName}"`,
      `"${params.position}"`,
      `"${params.joiningDate}"`,
      `"${params.salaryCtc}"`,
      `"${params.email}"`,
      `"${outputFile}"`,
      `"${logoPath}"`,
    ];

    // Execute Python script
    const command = `python "${scriptPath}" ${escapedArgs.join(" ")}`;
    console.log(`[letter-generator] Executing: ${command}`);

    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, // 30 second timeout
    });

    if (stderr && !stderr.includes("[SUCCESS]")) {
      console.warn(`[letter-generator] Warning: ${stderr}`);
    }

    // Verify file was created
    if (!fs.existsSync(outputFile)) {
      throw new Error("PDF file was not created");
    }

    console.log(`[letter-generator] Offer letter generated: ${outputFile}`);

    return {
      success: true,
      filePath: outputFile,
    };
  } catch (error) {
    console.error("[letter-generator] Error generating offer letter:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate joining letter PDF
 */
export async function generateJoiningLetter(
  params: JoiningLetterParams,
  outputPath?: string
): Promise<LetterGenerationResult> {
  try {
    const projectRoot = process.cwd();
    const scriptPath = path.join(projectRoot, "scripts", "generate-joining-letter.py");
    const logoPath = path.join(projectRoot, "public", "logo-dark.svg");

    // Default output path
    const fileName = `joining_letter_${params.candidateName.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
    const outputFile = outputPath || path.join(projectRoot, ".tests", fileName);

    // Ensure output directory exists
    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const frappeUrl = params.frappeUrl || process.env.FRAPPE_BASE_URL || "https://frappe.ciagotech.com";

    // Escape arguments for shell
    const escapedArgs = [
      `"${params.candidateName}"`,
      `"${params.position}"`,
      `"${params.joiningDate}"`,
      `"${params.employeeId}"`,
      `"${params.department}"`,
      `"${params.reportingTo}"`,
      `"${params.email}"`,
      `"${outputFile}"`,
      `"${frappeUrl}"`,
      `"${logoPath}"`,
    ];

    // Execute Python script
    const command = `python "${scriptPath}" ${escapedArgs.join(" ")}`;
    console.log(`[letter-generator] Executing: ${command}`);

    const { stdout, stderr } = await execAsync(command, {
      timeout: 30000, // 30 second timeout
    });

    if (stderr && !stderr.includes("[SUCCESS]")) {
      console.warn(`[letter-generator] Warning: ${stderr}`);
    }

    // Verify file was created
    if (!fs.existsSync(outputFile)) {
      throw new Error("PDF file was not created");
    }

    console.log(`[letter-generator] Joining letter generated: ${outputFile}`);

    return {
      success: true,
      filePath: outputFile,
    };
  } catch (error) {
    console.error("[letter-generator] Error generating joining letter:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate both offer and joining letters
 */
export async function generateBothLetters(
  offerParams: OfferLetterParams,
  joiningParams: JoiningLetterParams
): Promise<{
  offerLetter: LetterGenerationResult;
  joiningLetter: LetterGenerationResult;
}> {
  const [offerLetter, joiningLetter] = await Promise.all([
    generateOfferLetter(offerParams),
    generateJoiningLetter(joiningParams),
  ]);

  return {
    offerLetter,
    joiningLetter,
  };
}

/**
 * Cleanup generated letter files (for testing or after sending email)
 */
export async function cleanupLetterFiles(filePaths: string[]): Promise<void> {
  for (const filePath of filePaths) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[letter-generator] Cleaned up: ${filePath}`);
      }
    } catch (error) {
      console.warn(`[letter-generator] Failed to cleanup ${filePath}:`, error);
    }
  }
}
