import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { EmptyState, PageIntro } from "@/components/app/ui";
import { pageMeta } from "@/lib/meta";

export const Route = createFileRoute("/settings")({
  head: () => pageMeta("Settings", "Mess details, categories and accounting rules."),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageIntro title="Settings" subtitle="Mess details, categories and accounting rules." />
      <EmptyState icon={Sparkles} title="Coming soon" text="This page's design is next in line." />
    </div>
  );
}
