import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/estimate")({
  beforeLoad: () => {
    throw redirect({ to: "/", statusCode: 301 });
  },
});
