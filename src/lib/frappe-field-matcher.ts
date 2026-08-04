/**
 * Intelligent field matching for Frappe sync
 *
 * Uses exact match → fuzzy match → auto-create (or hold for review) priority
 */

import { compareTwoStrings, findBestMatch } from 'string-similarity';
import type { FrappeClient } from "@/integrations/frappe/client";

export type MappingConfidence = 'exact_match' | 'fuzzy_match' | 'auto_created' | 'held_for_review';

export interface FieldMappingResult {
  mappedValue: string;
  confidence: MappingConfidence;
  similarity?: number;
  created?: boolean;
}

const FUZZY_THRESHOLD = 0.75;

/**
 * Match designation with exact → fuzzy → auto-create logic
 */
export async function matchDesignation(
  input: string,
  availableDesignations: string[],
  client: FrappeClient,
  autoCreate: boolean = true,
  logPrefix: string = '[matcher]'
): Promise<FieldMappingResult> {
  const trimmedInput = input.trim();

  // Step 1: Exact match (case-insensitive)
  const exactMatch = availableDesignations.find(
    d => d.toLowerCase() === trimmedInput.toLowerCase()
  );

  if (exactMatch) {
    console.log(`${logPrefix} Designation: "${trimmedInput}" → exact_match → "${exactMatch}"`);
    return {
      mappedValue: exactMatch,
      confidence: 'exact_match',
    };
  }

  // Step 2: Fuzzy match
  const bestMatch = findBestMatch(trimmedInput, availableDesignations);
  const topMatch = bestMatch.bestMatch;

  if (topMatch.rating >= FUZZY_THRESHOLD) {
    console.log(`${logPrefix} Designation: "${trimmedInput}" → fuzzy_match (${topMatch.rating.toFixed(2)}) → "${topMatch.target}"`);
    return {
      mappedValue: topMatch.target,
      confidence: 'fuzzy_match',
      similarity: topMatch.rating,
    };
  }

  // Step 3: Auto-create or hold for review
  if (autoCreate) {
    console.warn(`${logPrefix} Designation: "${trimmedInput}" → NO MATCH → auto_created → "${trimmedInput}" (creating new record)`);

    try {
      await client.createDesignation(trimmedInput);
      return {
        mappedValue: trimmedInput,
        confidence: 'auto_created',
        created: true,
      };
    } catch (error) {
      console.error(`${logPrefix} Failed to auto-create designation "${trimmedInput}":`, error);
      throw new Error(`Failed to create new Designation "${trimmedInput}": ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    console.warn(`${logPrefix} Designation: "${trimmedInput}" → NO MATCH → held_for_review (AUTO_CREATE_RECORDS=false)`);
    return {
      mappedValue: '', // Will not create Job Opening
      confidence: 'held_for_review',
    };
  }
}

/**
 * Match department with exact → fuzzy → auto-create logic
 */
export async function matchDepartment(
  input: string,
  availableDepartments: string[],
  client: FrappeClient,
  company: string = 'Ciago Technologies',
  autoCreate: boolean = true,
  logPrefix: string = '[matcher]'
): Promise<FieldMappingResult> {
  const trimmedInput = input.trim();

  // Step 1: Exact match (case-insensitive)
  const exactMatch = availableDepartments.find(
    d => d.toLowerCase() === trimmedInput.toLowerCase()
  );

  if (exactMatch) {
    console.log(`${logPrefix} Department: "${trimmedInput}" → exact_match → "${exactMatch}"`);
    return {
      mappedValue: exactMatch,
      confidence: 'exact_match',
    };
  }

  // Step 2: Fuzzy match
  const bestMatch = findBestMatch(trimmedInput, availableDepartments);
  const topMatch = bestMatch.bestMatch;

  if (topMatch.rating >= FUZZY_THRESHOLD) {
    console.log(`${logPrefix} Department: "${trimmedInput}" → fuzzy_match (${topMatch.rating.toFixed(2)}) → "${topMatch.target}"`);
    return {
      mappedValue: topMatch.target,
      confidence: 'fuzzy_match',
      similarity: topMatch.rating,
    };
  }

  // Step 3: Auto-create or hold for review
  if (autoCreate) {
    // Frappe departments have company suffix, so create with suffix
    const departmentName = trimmedInput.includes(' - ') ? trimmedInput : `${trimmedInput} - CT`;

    console.warn(`${logPrefix} Department: "${trimmedInput}" → NO MATCH → auto_created → "${departmentName}" (creating new record)`);

    try {
      await client.createDepartment(trimmedInput, company);
      return {
        mappedValue: departmentName,
        confidence: 'auto_created',
        created: true,
      };
    } catch (error) {
      console.error(`${logPrefix} Failed to auto-create department "${trimmedInput}":`, error);
      throw new Error(`Failed to create new Department "${trimmedInput}": ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    console.warn(`${logPrefix} Department: "${trimmedInput}" → NO MATCH → held_for_review (AUTO_CREATE_RECORDS=false)`);
    return {
      mappedValue: '',
      confidence: 'held_for_review',
    };
  }
}

/**
 * Match employment type with EXACT match only (no fuzzy, no auto-create)
 * This is a closed set and must match exactly
 *
 * Normalizes underscores to hyphens before matching (full_time → full-time)
 */
export function matchEmploymentType(
  input: string,
  availableEmploymentTypes: string[],
  logPrefix: string = '[matcher]'
): FieldMappingResult {
  const trimmedInput = input.trim();

  // Normalize: replace underscores with hyphens for matching
  // This allows "full_time" from our form to match "Full-time" in Frappe
  const normalizedInput = trimmedInput.replace(/_/g, '-');

  // ONLY exact match (case-insensitive, after normalization)
  const exactMatch = availableEmploymentTypes.find(
    e => e.toLowerCase() === normalizedInput.toLowerCase()
  );

  if (exactMatch) {
    console.log(`${logPrefix} Employment Type: "${trimmedInput}" → exact_match (normalized "${normalizedInput}") → "${exactMatch}"`);
    return {
      mappedValue: exactMatch,
      confidence: 'exact_match',
    };
  }

  // NO fuzzy match, NO auto-create for employment types
  const validOptions = availableEmploymentTypes.join(', ');
  const errorMessage = `Employment Type: "${trimmedInput}" (normalized: "${normalizedInput}") → NO EXACT MATCH → sync failed. Valid options: ${validOptions}`;

  console.error(`${logPrefix} ${errorMessage}`);

  throw new Error(errorMessage);
}
