/**
 * Frappe Dashboard Lock Screen
 *
 * Shows when user tries to access Frappe before their joining date
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Calendar, Clock } from "lucide-react";
import { format, differenceInDays, differenceInHours } from "date-fns";

export interface DashboardLockProps {
  joiningDate: Date;
  candidateName?: string;
  position?: string;
}

export function DashboardLock({ joiningDate, candidateName, position }: DashboardLockProps) {
  const now = new Date();
  const daysUntil = differenceInDays(joiningDate, now);
  const hoursUntil = differenceInHours(joiningDate, now);

  // Calculate time remaining
  const timeRemaining =
    daysUntil > 1
      ? `${daysUntil} days`
      : daysUntil === 1
        ? "1 day"
        : hoursUntil > 1
          ? `${hoursUntil} hours`
          : "Less than 1 hour";

  return (
    <div className="flex min-h-[600px] items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-2 border-dashed shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg">
            <Lock className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl font-bold">Dashboard Access Locked</CardTitle>
          {candidateName && (
            <p className="text-lg text-muted-foreground">Welcome, {candidateName}!</p>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Joining Date Display */}
          <div className="rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 p-6 text-center text-white shadow-md">
            <div className="mb-2 flex items-center justify-center gap-2">
              <Calendar className="h-5 w-5" />
              <p className="text-sm font-medium uppercase tracking-wide">Your Joining Date</p>
            </div>
            <p className="text-3xl font-bold">{format(joiningDate, "PPPP")}</p>
            {position && <p className="mt-2 text-sm opacity-90">Position: {position}</p>}
          </div>

          {/* Countdown */}
          <div className="flex items-center justify-center gap-4 rounded-lg border bg-card p-6">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Time Remaining</p>
              <p className="text-2xl font-bold">{timeRemaining}</p>
            </div>
          </div>

          {/* Information */}
          <div className="space-y-4">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
              <h3 className="mb-2 flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-100">
                <span className="text-xl">🔒</span> Dashboard Status
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Your Frappe HR Dashboard will automatically unlock on{" "}
                <strong>{format(joiningDate, "PP")}</strong>. You'll have access to all HR
                services, leave management, attendance tracking, and more.
              </p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
              <h3 className="mb-2 flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-100">
                <span className="text-xl">📧</span> Credentials Email
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                On your joining date, you'll receive an email with your login credentials and
                password setup link. Please check your work email inbox.
              </p>
            </div>

            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
              <h3 className="mb-2 flex items-center gap-2 font-semibold text-green-900 dark:text-green-100">
                <span className="text-xl">📋</span> What to Prepare
              </h3>
              <ul className="space-y-1 text-sm text-green-800 dark:text-green-200">
                <li>• Review your offer letter and joining letter (sent via email)</li>
                <li>• Prepare required documents (educational certificates, ID proofs)</li>
                <li>• Note down your joining date and reporting time</li>
                <li>• Keep your work email accessible for credentials</li>
              </ul>
            </div>
          </div>

          {/* Contact Info */}
          <div className="border-t pt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Need help or have questions?
              <br />
              Contact HR at{" "}
              <a
                href="mailto:hr@ciagotech.com"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                hr@ciagotech.com
              </a>
            </p>
          </div>

          {/* Status Badge */}
          <div className="flex justify-center">
            <Badge variant="outline" className="border-violet-500 text-violet-700">
              <Lock className="mr-1 h-3 w-3" />
              Locked until {format(joiningDate, "PP")}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Compact version for smaller spaces (e.g., cards, modals)
 */
export function DashboardLockCompact({ joiningDate }: { joiningDate: Date }) {
  const daysUntil = differenceInDays(joiningDate, new Date());

  return (
    <div className="rounded-lg border-2 border-dashed p-6 text-center">
      <Lock className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
      <h3 className="mb-2 text-lg font-semibold">Dashboard Locked</h3>
      <p className="mb-3 text-sm text-muted-foreground">
        Your dashboard will unlock on
        <br />
        <span className="font-semibold text-foreground">{format(joiningDate, "PPP")}</span>
      </p>
      <Badge variant="secondary">
        <Clock className="mr-1 h-3 w-3" />
        {daysUntil} {daysUntil === 1 ? "day" : "days"} remaining
      </Badge>
    </div>
  );
}
