function DocumentVerificationPanel() {
  const qc = useQueryClient();
  const fetchQueue = useServerFn(listOnboardingQueue);
  const reviewFn = useServerFn(reviewOnboardingDocument);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-queue"],
    queryFn: () => fetchQueue(),
  });

  const [selectedOnboarding, setSelectedOnboarding] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "submitted" | "approved">("submitted");

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data;
    if (filter === "submitted") return data.filter((r) => r.status === "submitted");
    if (filter === "approved") return data.filter((r) => r.verification_status === "approved");
    return data;
  }, [data, filter]);

  const reviewMutation = useMutation({
    mutationFn: (vars: { doc_id: string; status: string; feedback?: string }) =>
      reviewFn({
        data: {
          document_id: vars.doc_id,
          status: vars.status as any,
          feedback: vars.feedback || null,
        },
      }),
    onSuccess: () => {
      toast.success("Document reviewed");
      qc.invalidateQueries({ queryKey: ["onboarding-queue"] });
    },
    onError: (e: any) => toast.error(e?.message || "Review failed"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-card" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-10 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No documents to review</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Submitted onboarding documents will appear here for verification.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All ({data.length})
          </Button>
          <Button
            variant={filter === "submitted" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("submitted")}
          >
            Pending ({data.filter((r) => r.status === "submitted").length})
          </Button>
          <Button
            variant={filter === "approved" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("approved")}
          >
            Approved ({data.filter((r) => r.verification_status === "approved").length})
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((row) => (
          <Card
            key={row.onboarding_id}
            className="transition-all hover:border-brand/40 hover:shadow-md"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{row.candidate_name}</h3>
                    <Badge variant="outline" className="text-xs">
                      {row.role_title}
                    </Badge>
                    {row.verification_status === "approved" && (
                      <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">
                        <ShieldCheck className="mr-1 h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{row.candidate_email}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      Documents: {row.docs_approved}/{row.docs_total} approved
                    </span>
                    {row.docs_pending > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {row.docs_pending} pending
                      </span>
                    )}
                    {row.docs_issues > 0 && (
                      <span className="text-rose-600 dark:text-rose-400">
                        {row.docs_issues} need attention
                      </span>
                    )}
                    {row.submitted_at && (
                      <span>Submitted {new Date(row.submitted_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedOnboarding(row.onboarding_id)}
                >
                  Review Documents
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedOnboarding && (
        <DocumentReviewDialog
          onboardingId={selectedOnboarding}
          onClose={() => setSelectedOnboarding(null)}
          reviewMutation={reviewMutation}
        />
      )}
    </div>
  );
}

function DocumentReviewDialog({
  onboardingId,
  onClose,
  reviewMutation,
}: {
  onboardingId: string;
  onClose: () => void;
  reviewMutation: any;
}) {
  // This would fetch individual document details and show them in a dialog
  // For now, placeholder
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-card border border-border rounded-lg p-6 max-w-2xl w-full">
        <h2 className="text-xl font-bold">Document Review</h2>
        <p className="text-sm text-muted-foreground mt-2">Onboarding ID: {onboardingId}</p>
        <Button onClick={onClose} className="mt-4">
          Close
        </Button>
      </div>
    </div>
  );
}
