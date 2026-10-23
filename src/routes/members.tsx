import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { EmptyState, PageIntro } from "@/components/app/ui";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/members")({
  head: () => pageMeta("Members", "Member profiles and individual accounts."),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageIntro title="Members" subtitle="Member profiles and individual accounts." />
      <EmptyState icon={Sparkles} title="Coming soon" text="This page's design is next in line." />
    </div>
  );
}
