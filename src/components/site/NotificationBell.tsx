import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications.functions";

export function NotificationBell() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listMyNotifications);
  const markOne = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);

  const { data } = useQuery({
    queryKey: ["my-notifications"],
    queryFn: () => list(),
    refetchInterval: 60_000,
    retry: 1,
  });

  const unreadCount = useMemo(() => (data ?? []).filter((n) => !n.read).length, [data]);

  const readOne = useMutation({
    mutationFn: (id: string) => markOne({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-notifications"] }),
  });
  const readAll = useMutation({
    mutationFn: () => markAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-notifications"] }),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => readAll.mutate()}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {(!data || data.length === 0) && (
            <li className="p-6 text-center text-xs text-muted-foreground">You're all caught up.</li>
          )}
          {data?.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  if (!n.read) readOne.mutate(n.id);
                  if (n.link) navigate({ to: n.link as any });
                }}
                className={`flex w-full flex-col items-start gap-1 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-accent ${
                  n.read ? "opacity-70" : ""
                }`}
              >
                <div className="flex w-full items-center gap-2">
                  {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
                  <p className="flex-1 truncate text-sm font-semibold">{n.title}</p>
                </div>
                <p className="text-xs text-muted-foreground">{n.body}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  {new Date(n.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
