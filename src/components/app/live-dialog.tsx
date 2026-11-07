import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useSave, db, today } from '@/lib/data';
import { useWorkspace } from '@/lib/workspace';
export function LiveDialog({kind}:{kind:'member'|'expense'|'payment'}){
 const [open,setOpen]=useState(false);const [type,setType]=useState('meal');const w=useWorkspace();
 const save=useSave(async(f:FormData)=>{
 const val=(k:string)=>String(f.get(k)??'');
 if(kind==='member')return await db.from('mess_members').insert({name:val('name'),phone:val('phone'),room:val('room')});
 if(kind==='expense')return await db.from('mess_expenses').insert({date:val('date'),type,category:val('category'),description:val('description'),amount:Number(val('amount')),method:val('method')});
 return await db.from('payments').insert({member_id:val('member_id'),date:val('date'),amount:Number(val('amount')),method:val('method'),reference:val('reference')});
 },'Record saved');
 if(!w.isAdmin)return null;
 const title=kind==='member'?'Add member':kind==='expense'?'Add expense':'Add payment';
 const selectClass='mt-2 h-11 w-full rounded-xl border bg-card px-3 text-sm';
 return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus/>{title}</Button></DialogTrigger><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><form onSubmit={async e=>{e.preventDefault();await save.mutateAsync(new FormData(e.currentTarget));setOpen(false);}} className="space-y-4">
 {kind==='member'?<>{['name','phone','room'].map(k=><div key={k}><Label htmlFor={k} className="capitalize">{k}</Label><Input id={k} name={k} required={k==='name'} maxLength={k==='name'?80:30} className="mt-2"/></div>)}</>:<>
 <div><Label htmlFor="date">Date</Label><Input id="date" name="date" type="date" defaultValue={today()} required className="mt-2"/></div>
 {kind==='payment'?<div><Label htmlFor="member_id">Member</Label><select id="member_id" name="member_id" required className={selectClass}>{w.members.filter(m=>m.status!=='left').map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div>:<><div><Label htmlFor="type">Expense type</Label><select id="type" value={type} onChange={e=>setType(e.target.value)} className={selectClass}><option value="meal">Meal / Bazar</option><option value="household">Household bill</option></select></div><div><Label htmlFor="category">Category</Label><select id="category" name="category" className={selectClass}>{(type==='meal'?w.mess?.meal_categories:w.mess?.household_categories)?.map(c=><option key={c}>{c}</option>)}</select></div><div><Label htmlFor="description">Description</Label><Input id="description" name="description" maxLength={300} className="mt-2"/></div></>}
 <div><Label htmlFor="amount">Amount (৳)</Label><Input id="amount" name="amount" type="number" min="0.01" max="9999999.99" step="0.01" required className="mt-2"/></div><div><Label htmlFor="method">Payment method</Label><select id="method" name="method" className={selectClass}>{['Cash','bKash','Nagad','Bank transfer'].map(x=><option key={x}>{x}</option>)}</select></div>{kind==='payment'&&<div><Label htmlFor="reference">Reference</Label><Input id="reference" name="reference" maxLength={100} className="mt-2"/></div>}</>}
 <Button className="w-full" disabled={save.isPending}>{save.isPending&&<Loader2 className="animate-spin"/>}Save</Button></form></DialogContent></Dialog>;
}
