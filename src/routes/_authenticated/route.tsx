import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
export const Route=createFileRoute('/_authenticated')({ssr:false,beforeLoad:async()=>{
 const {data:{user}}=await supabase.auth.getUser(); if(!user) throw redirect({to:'/auth'});
 const {data,error}=await supabase.from('mess_members').select('id').eq('user_id',user.id).maybeSingle();
 if(error) throw new Error(error.message); if(!data) throw redirect({to:'/'});
},component:Outlet});
