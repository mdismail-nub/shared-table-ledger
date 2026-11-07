import { createFileRoute } from '@tanstack/react-router';
import { ReportsPage } from '@/components/app/live-pages';
import { workspaceOptions } from '@/lib/workspace';
import { currentMonth } from '@/lib/data';
import { pageMeta } from '@/lib/meta';
export const Route=createFileRoute('/_authenticated/reports')({
 head:()=>pageMeta('Reports','Your reports in Mess Manager.'),
 loader:async({context})=>{await context.queryClient.ensureQueryData(workspaceOptions(currentMonth()));},
 component:ReportsPage,
 errorComponent:({error})=><div role="alert" className="p-6">{error.message}</div>,
 notFoundComponent:()=> <div>Page not found.</div>,
});
