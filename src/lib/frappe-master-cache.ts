/**
 * Frappe Master Data Cache
 *
 * Fetches real Designation, Department, and Employment Type records from Frappe
 * instead of using hardcoded mappings that can drift out of sync.
 */

import type { FrappeClient } from "@/integrations/frappe/client";

interface CachedMasterData {
  designations: string[];
  departments: string[];
  employmentTypes: string[];
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let masterDataCache: CachedMasterData | null = null;

export async function getFrappeMasterData(client: FrappeClient): Promise<{
  designations: string[];
  departments: string[];
  employmentTypes: string[];
}> {
  const now = Date.now();

  // Return cached data if still valid
  if (masterDataCache && now - masterDataCache.timestamp < CACHE_TTL_MS) {
    console.log("[frappe-master-cache] Using cached master data");
    return {
      designations: masterDataCache.designations,
      departments: masterDataCache.departments,
      employmentTypes: masterDataCache.employmentTypes,
    };
  }

  console.log("[frappe-master-cache] Fetching fresh master data from Frappe");

  try {
    // Fetch all three master data types in parallel
    const [designationsResp, departmentsResp, employmentTypesResp] = await Promise.all([
      client.listDesignations(0), // 0 = no limit
      client.listDepartments(0),
      client.listEmploymentTypes(0),
    ]);

    const designations = designationsResp.map((d) => d.name);
    const departments = departmentsResp.map((d) => d.name);
    const employmentTypes = employmentTypesResp.map((e) => e.name);

    console.log("[frappe-master-cache] Fetched:", {
      designations: designations.length,
      departments: departments.length,
      employmentTypes: employmentTypes.length,
    });

    // Update cache
    masterDataCache = {
      designations,
      departments,
      employmentTypes,
      timestamp: now,
    };

    return { designations, departments, employmentTypes };
  } catch (error) {
    console.error("[frappe-master-cache] Failed to fetch master data:", error);

    // If we have stale cache, use it as fallback
    if (masterDataCache) {
      console.warn("[frappe-master-cache] Using stale cache as fallback");
      return {
        designations: masterDataCache.designations,
        departments: masterDataCache.departments,
        employmentTypes: masterDataCache.employmentTypes,
      };
    }

    throw new Error("Failed to fetch Frappe master data and no cache available");
  }
}

/**
 * Clear the cache (useful for testing or when master data changes)
 */
export function clearMasterDataCache(): void {
  masterDataCache = null;
  console.log("[frappe-master-cache] Cache cleared");
}
