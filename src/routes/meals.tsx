import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { EmptyState, PageIntro } from "@/components/app/ui";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/meals")({
  head: () => pageMeta("Meals", "Daily meal entry and monthly totals."),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageIntro title="Meals" subtitle="Daily meal entry and monthly totals." />
      <EmptyState icon={Sparkles} title="Coming soon" text="This page's design is next in line." />
    </div>
  );
}
