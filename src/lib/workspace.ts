import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { loadWorkspace } from './workspace.functions';
import { currentMonth, useMonth, type Member, type Summary } from './data';
import { buildLedger, mealRate } from './accounting';
export const workspaceOptions=(month=currentMonth())=>queryOptions({queryKey:['workspace',month],queryFn:()=>loadWorkspace({data:{month}})});
export function useWorkspace(){
 const {month}=useMonth(); const {data}=useSuspenseQuery(workspaceOptions(month));
 const summary=data.summary as unknown as Summary;
 const rate=mealRate(Number(summary.food),Number(summary.total_meals));
 const shared=summary.active_members?Number(summary.household)/Number(summary.active_members):0;
 const members=data.members as Member[];
 const ledger=buildLedger(members,data.meals,data.payments,rate,shared);
 return {...data,month,summary,rate,shared,members,ledger,own:ledger.find(m=>m.user_id===data.userId)};
}
