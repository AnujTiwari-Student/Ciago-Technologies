/**
 * Service Account Provisioning Panel
 *
 * Allows admins to provision/deprovision service accounts for employees
 * (GitHub, Teams, ClickUp, OrangeHRM ESS)
 */

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { provisionServiceAccounts, deprovisionServiceAccounts } from "@/lib/provisioning.functions";

interface ProvisioningPanelProps {
  employeeId: string;
  employeeName: string;
}

export function ProvisioningPanel({ employeeId, employeeName }: ProvisioningPanelProps) {
  const [githubUsername, setGithubUsername] = useState("");
  const [teamsEmail, setTeamsEmail] = useState("");
  const [clickupEmail, setClickupEmail] = useState("");

  const provisionFn = useServerFn(provisionServiceAccounts);
  const deprovisionFn = useServerFn(deprovisionServiceAccounts);

  const provisionMutation = useMutation({
    mutationFn: async () => {
      return await provisionFn({
        data: {
          employeeId,
          githubUsername: githubUsername || undefined,
          teamsEmail: teamsEmail || undefined,
          clickupEmail: clickupEmail || undefined,
        },
      });
    },
    onSuccess: (results) => {
      let successCount = 0;
      let failCount = 0;

      if (results.github.success) successCount++;
      else if (githubUsername) failCount++;

      if (results.teams.success) successCount++;
      else if (teamsEmail) failCount++;

      if (results.clickup.success) successCount++;
      else if (clickupEmail) failCount++;

      if (successCount > 0) {
        toast.success(`Provisioned ${successCount} service account(s)`);
      }
      if (failCount > 0) {
        toast.error(`Failed to provision ${failCount} service account(s)`);
      }

      // Show specific errors
      if (results.github.error) {
        toast.error(`GitHub: ${results.github.error}`);
      }
      if (results.teams.error) {
        toast.error(`Teams: ${results.teams.error}`);
      }
      if (results.clickup.error) {
        toast.error(`ClickUp: ${results.clickup.error}`);
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Provisioning failed");
    },
  });

  const deprovisionMutation = useMutation({
    mutationFn: async () => {
      return await deprovisionFn({
        data: { employeeId },
      });
    },
    onSuccess: (results) => {
      let successCount = 0;
      if (results.github.success) successCount++;
      if (results.teams.success) successCount++;
      if (results.clickup.success) successCount++;
      if (results.orangehrm.success) successCount++;

      toast.success(`Deprovisioned ${successCount} service account(s)`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Deprovision failed");
    },
  });

  const handleProvision = () => {
    if (!githubUsername && !teamsEmail && !clickupEmail) {
      toast.error("Please enter at least one service account identifier");
      return;
    }
    provisionMutation.mutate();
  };

  const handleDeprovision = () => {
    if (
      confirm(
        `Are you sure you want to deprovision all service accounts for ${employeeName}? This will revoke access to GitHub, Teams, ClickUp, and OrangeHRM ESS.`,
      )
    ) {
      deprovisionMutation.mutate();
    }
  };

  const isProvisioning = provisionMutation.isPending;
  const isDeprovisioning = deprovisionMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Account Provisioning</CardTitle>
        <CardDescription>
          Provision access to GitHub, Microsoft Teams, and ClickUp for {employeeName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* GitHub */}
        <div className="space-y-2">
          <Label htmlFor="github-username">
            GitHub Username
            <span className="ml-2 text-xs text-muted-foreground">(optional)</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="github-username"
              placeholder="octocat"
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
              disabled={isProvisioning}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open("https://github.com/orgs/Ciago-Technologies/people", "_blank")
              }
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Will send invitation to join Ciago-Technologies organization
          </p>
        </div>

        {/* Microsoft Teams */}
        <div className="space-y-2">
          <Label htmlFor="teams-email">
            Microsoft Teams Email
            <span className="ml-2 text-xs text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="teams-email"
            type="email"
            placeholder="user@company.com"
            value={teamsEmail}
            onChange={(e) => setTeamsEmail(e.target.value)}
            disabled={isProvisioning}
          />
          <p className="text-xs text-muted-foreground">
            Must be an existing Microsoft 365 user in the tenant
          </p>
        </div>

        {/* ClickUp */}
        <div className="space-y-2">
          <Label htmlFor="clickup-email">
            ClickUp Email
            <span className="ml-2 text-xs text-muted-foreground">(optional)</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="clickup-email"
              type="email"
              placeholder="user@company.com"
              value={clickupEmail}
              onChange={(e) => setClickupEmail(e.target.value)}
              disabled={isProvisioning}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("https://app.clickup.com", "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Will send invitation to join workspace</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleProvision}
            disabled={isProvisioning || isDeprovisioning}
            className="flex-1"
          >
            {isProvisioning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Provisioning...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Provision Access
              </>
            )}
          </Button>

          <Button
            variant="destructive"
            onClick={handleDeprovision}
            disabled={isProvisioning || isDeprovisioning}
          >
            {isDeprovisioning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Revoking...
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Deprovision All
              </>
            )}
          </Button>
        </div>

        {/* Status Display */}
        {provisionMutation.isSuccess && provisionMutation.data && (
          <Alert>
            <AlertDescription>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  {provisionMutation.data.github.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : githubUsername ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : null}
                  <span>
                    GitHub:{" "}
                    {provisionMutation.data.github.success
                      ? "Invited"
                      : provisionMutation.data.github.error || "Not configured"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {provisionMutation.data.teams.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : teamsEmail ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : null}
                  <span>
                    Teams:{" "}
                    {provisionMutation.data.teams.success
                      ? "Added"
                      : provisionMutation.data.teams.error || "Not configured"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {provisionMutation.data.clickup.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : clickupEmail ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : null}
                  <span>
                    ClickUp:{" "}
                    {provisionMutation.data.clickup.success
                      ? "Invited"
                      : provisionMutation.data.clickup.error || "Not configured"}
                  </span>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Alert>
          <AlertDescription className="text-xs">
            <strong>Note:</strong> OrangeHRM ESS accounts are created automatically when an employee
            is hired. This panel is for provisioning access to external collaboration tools.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
