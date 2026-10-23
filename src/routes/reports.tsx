import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { EmptyState, PageIntro } from "@/components/app/ui";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/reports")({
  head: () => pageMeta("Reports", "Charts, statements and exports."),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageIntro title="Reports" subtitle="Charts, statements and exports." />
      <EmptyState icon={Sparkles} title="Coming soon" text="This page's design is next in line." />
    </div>
  );
}
