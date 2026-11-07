import { createFileRoute } from '@tanstack/react-router';
import { AccountsPage } from '@/components/app/live-pages';
import { workspaceOptions } from '@/lib/workspace';
import { currentMonth } from '@/lib/data';
import { pageMeta } from '@/lib/meta';
export const Route=createFileRoute('/_authenticated/accounts')({
 head:()=>pageMeta('Accounts','Your accounts in Mess Manager.'),
 loader:async({context})=>{await context.queryClient.ensureQueryData(workspaceOptions(currentMonth()));},
 component:AccountsPage,
 errorComponent:({error})=><div role="alert" className="p-6">{error instanceof Error ? error.message : "This page could not load."}</div>,
 notFoundComponent:()=> <div>Page not found.</div>,
});
