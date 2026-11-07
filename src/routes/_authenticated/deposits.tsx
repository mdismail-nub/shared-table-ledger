import { createFileRoute } from '@tanstack/react-router';
import { PaymentsPage } from '@/components/app/live-pages';
import { workspaceOptions } from '@/lib/workspace';
import { currentMonth } from '@/lib/data';
import { pageMeta } from '@/lib/meta';
export const Route=createFileRoute('/_authenticated/deposits')({
 head:()=>pageMeta('Deposits','Your deposits in Mess Manager.'),
 loader:async({context})=>{await context.queryClient.ensureQueryData(workspaceOptions(currentMonth()));},
 component:PaymentsPage,
 errorComponent:({error})=><div role="alert" className="p-6">{error.message}</div>,
 notFoundComponent:()=> <div>Page not found.</div>,
});
