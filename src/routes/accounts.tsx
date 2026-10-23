import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { EmptyState, PageIntro } from "@/components/app/ui";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/accounts")({
  head: () => pageMeta("Monthly Accounts", "Meal rate, dues and balance settlement."),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageIntro title="Monthly Accounts" subtitle="Meal rate, dues and balance settlement." />
      <EmptyState icon={Sparkles} title="Coming soon" text="This page's design is next in line." />
    </div>
  );
}
