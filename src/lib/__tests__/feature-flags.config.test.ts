import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAPABILITIES,
  FEATURE_FLAGS,
  FEATURE_KEYS,
  getCapabilityDefault,
} from "@/lib/feature-flags";

describe("feature-flags config", () => {
  it("exposes all configured keys in FEATURE_KEYS", () => {
    const configured = Object.values(FEATURE_FLAGS);
    expect(new Set(FEATURE_KEYS)).toEqual(new Set(configured));
  });

  it("returns defaults via getCapabilityDefault", () => {
    expect(getCapabilityDefault(FEATURE_FLAGS.clerkAuthentication)).toBe(
      DEFAULT_CAPABILITIES.clerkAuthentication,
    );
    expect(getCapabilityDefault(FEATURE_FLAGS.dashboard)).toBe(
      DEFAULT_CAPABILITIES.dashboardEnabled,
    );
    expect(getCapabilityDefault(FEATURE_FLAGS.maintenanceMode)).toBe(
      DEFAULT_CAPABILITIES.maintenanceMode,
    );
  });
});
