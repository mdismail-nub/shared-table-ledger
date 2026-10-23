import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { EmptyState, PageIntro } from "@/components/app/ui";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/expenses")({
  head: () => pageMeta("Expenses", "Bazar purchases and household bills."),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageIntro title="Expenses" subtitle="Bazar purchases and household bills." />
      <EmptyState icon={Sparkles} title="Coming soon" text="This page's design is next in line." />
    </div>
  );
}
