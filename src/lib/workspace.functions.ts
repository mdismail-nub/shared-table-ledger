import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
function monthRange(m:string){const [y,mo]=m.split('-').map(Number); const next=mo===12?`${y+1}-01`:`${y}-${String(mo+1).padStart(2,'0')}`;return {start:`${m}-01`,end:`${next}-01`};}
export const loadWorkspace = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((v: { month: string }) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(v.month)) throw new Error('Invalid month'); return v;
}).handler(async ({ data, context }) => {
  const db = context.supabase;
  const { start, end } = monthRange(data.month);
  const results = await Promise.all([
    db.from('messes').select('id,owner_id,name,address,manager,start_day,currency,show_invite_to_members,meal_categories,household_categories').maybeSingle(),
    db.from('mess_members').select('*').order('created_at'),
    db.from('mess_user_roles').select('role').eq('user_id', context.userId).maybeSingle(),
    db.from('mess_meals').select('*').gte('date',start).lt('date',end).order('date',{ascending:false}),
    db.from('mess_expenses').select('*').gte('date',start).lt('date',end).order('date',{ascending:false}),
    db.from('payments').select('*').gte('date',start).lt('date',end).order('date',{ascending:false}),
    db.rpc('mess_month_summary',{_start:start,_end:end}),
  ]);
  const error=results.find(r=>r.error)?.error; if(error) throw new Error(error.message);
  return {mess:results[0].data, members:results[1].data??[],isAdmin:results[2].data?.role==='admin', meals:results[3].data??[],expenses:results[4].data??[],payments:results[5].data??[],summary:results[6].data,userId:context.userId};
});
