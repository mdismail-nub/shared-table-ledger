import { createFileRoute } from '@tanstack/react-router';
import { MealsPage } from '@/components/app/live-pages';
import { workspaceOptions } from '@/lib/workspace';
import { currentMonth } from '@/lib/data';
import { pageMeta } from '@/lib/meta';
export const Route=createFileRoute('/_authenticated/meals')({
 head:()=>pageMeta('Meals','Your meals in Mess Manager.'),
 loader:async({context})=>{await context.queryClient.ensureQueryData(workspaceOptions(currentMonth()));},
 component:MealsPage,
 errorComponent:({error})=><div role="alert" className="p-6">{error instanceof Error ? error.message : "This page could not load."}</div>,
 notFoundComponent:()=> <div>Page not found.</div>,
});
