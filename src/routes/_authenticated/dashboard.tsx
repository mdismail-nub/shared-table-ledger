import { createFileRoute } from '@tanstack/react-router';
import { DashboardPage } from '@/components/app/live-pages';
import { workspaceOptions } from '@/lib/workspace';
import { currentMonth } from '@/lib/data';
import { pageMeta } from '@/lib/meta';
export const Route=createFileRoute('/_authenticated/dashboard')({
 head:()=>pageMeta('Dashboard','Your dashboard in Mess Manager.'),
 loader:async({context})=>{await context.queryClient.ensureQueryData(workspaceOptions(currentMonth()));},
 component:DashboardPage,
 errorComponent:({error})=><div role="alert" className="p-6">{error.message}</div>,
 notFoundComponent:()=> <div>Page not found.</div>,
});
