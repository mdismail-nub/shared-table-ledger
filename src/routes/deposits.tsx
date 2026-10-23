import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { EmptyState, PageIntro } from "@/components/app/ui";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/deposits")({
  head: () => pageMeta("Deposits", "Deposits, withdrawals and payment history."),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageIntro title="Deposits" subtitle="Deposits, withdrawals and payment history." />
      <EmptyState icon={Sparkles} title="Coming soon" text="This page's design is next in line." />
    </div>
  );
}
