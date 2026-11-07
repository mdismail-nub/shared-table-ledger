import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ArrowLeft, Check, Copy, Users, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { pageMeta } from '@/lib/meta';
import { useMe, db } from '@/lib/data';
import welcome from '@/assets/onboard-welcome.png';
import admin from '@/assets/role-admin.png';
import member from '@/assets/role-member.png';
import logo from '@/assets/logo.png.asset.json';
export const Route=createFileRoute('/')({head:()=>pageMeta('Welcome','Create your mess or join your housemates with a secure invitation.'),component:Welcome});
function Welcome(){
 const me=useMe(); const navigate=useNavigate(); const qc=useQueryClient();
 const [step,setStep]=useState<'welcome'|'roles'|'admin'|'member'|'done'>('welcome');
 const [busy,setBusy]=useState(false);const [code,setCode]=useState('');const [created,setCreated]=useState('');
 useEffect(()=>{if(me.data?.member) navigate({to:'/dashboard',replace:true}); else if(me.data){setStep(sessionStorage.getItem('mm_role')==='admin'?'admin':'member');}},[me.data,navigate]);
 async function choose(role:'admin'|'member'){sessionStorage.setItem('mm_role',role); if(!me.data) await navigate({to:'/auth'}); else setStep(role);}
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);try{
 const f=new FormData(e.currentTarget);
 if(step==='admin'){
 const {data,error}=await db.rpc('create_mess',{_name:String(f.get('name')),_address:String(f.get('address')),_manager:String(f.get('manager')),_start_day:1,_currency:'BDT (৳)'});
 if(error) throw error;const value=data as {invite_code:string};setCreated(value.invite_code);setStep('done');
 }else{const {error}=await db.rpc('join_mess_by_code',{_code:code});if(error)throw error;await qc.invalidateQueries();await navigate({to:'/dashboard'});}
 }catch(e){toast.error(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
 return <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-6 sm:px-8">
 <header className="flex items-center justify-between"><div className="flex items-center gap-3"><img src={logo.url} className="h-10 w-10 rounded-xl" alt=""/><span className="text-lg font-extrabold">Mess Manager</span></div><span className="text-xs text-muted-foreground">Better together.</span></header>
 <main className="flex flex-1 flex-col items-center justify-center py-8 text-center animate-rise">
 {step==='welcome'&&<><img src={welcome} alt="Housemates sharing a meal" className="mb-5 aspect-[4/3] w-full max-w-md rounded-3xl object-contain"/><span className="rounded-full bg-lime px-3 py-1 text-xs font-bold">A little less accounting. A lot more living.</span><h1 className="mt-5 text-4xl font-extrabold sm:text-5xl">Mess Manager</h1><p className="mt-3 max-w-sm text-muted-foreground">Good meals, happy housemates,<br/>and every taka accounted for.</p><Button size="lg" className="mt-7 w-full max-w-xs" onClick={()=>setStep('roles')}>Get started <ArrowRight/></Button><Button variant="ghost" className="mt-3" onClick={()=>navigate({to:'/auth'})}>Already a member? Sign in</Button></>}
 {step==='roles'&&<><p className="text-xs font-bold uppercase text-accent-foreground">Your place at the table</p><h1 className="mt-3 text-3xl font-extrabold">How will you join?</h1><div className="mt-8 grid w-full max-w-2xl gap-4 sm:grid-cols-2">{[{role:'admin' as const,title:'I’m the admin',text:'Bring your mess together.',image:admin,icon:ShieldCheck},{role:'member' as const,title:'I’m a member',text:'Join your housemates.',image:member,icon:Users}].map(x=><div key={x.role} className="rounded-3xl border bg-card p-5"><img src={x.image} alt="" className="mx-auto aspect-[4/3] w-full max-w-56 object-contain"/><h2 className="mt-3 text-xl font-bold">{x.title}</h2><p className="mt-2 text-sm text-muted-foreground">{x.text}</p><Button onClick={()=>choose(x.role)} variant={x.role==='admin'?'default':'lime'} className="mt-5 w-full"><x.icon/>Continue <ArrowRight/></Button></div>)}</div><Button variant="ghost" className="mt-6" onClick={()=>setStep('welcome')}><ArrowLeft/>Back</Button></>}
 {(step==='admin'||step==='member')&&<form onSubmit={submit} className="w-full max-w-md text-left"><img src={step==='admin'?admin:member} alt="" className="mx-auto h-44 object-contain"/><h1 className="mt-4 text-center text-3xl font-extrabold">{step==='admin'?'Make it your mess':'You’re invited'}</h1><p className="mt-2 text-center text-sm text-muted-foreground">{step==='admin'?'A fresh start for your shared home.':'Enter the six-digit code from your admin.'}</p><div className="mt-7 space-y-4">{step==='admin'?<>{[['name','Mess name','e.g. Green House'],['manager','Your name',me.data?.user.name??''],['address','Address','e.g. Dhaka']].map(([key,label,value])=><div key={key}><Label htmlFor={key}>{label}</Label><Input id={key} name={key} required={key!=='address'} maxLength={key==='address'?200:80} minLength={key==='name'?2:1} defaultValue={key==='manager'?value:undefined} placeholder={value} className="mt-2 h-12 bg-card"/></div>)}</>:<Input aria-label="Invitation code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" className="h-16 bg-card text-center text-3xl tracking-[0.35em]"/>}</div><Button size="lg" disabled={busy||(step==='member'&&code.length!==6)} className="mt-6 w-full">{busy?<Loader2 className="animate-spin"/>:<ArrowRight/>}{step==='admin'?'Create mess':'Join mess'}</Button><Button type="button" variant="ghost" className="mt-3 w-full" onClick={()=>setStep('roles')}><ArrowLeft/>Choose another role</Button></form>}
 {step==='done'&&<><div className="grid h-20 w-20 place-items-center rounded-full bg-mint text-mint-foreground"><Check className="h-9 w-9"/></div><h1 className="mt-6 text-3xl font-extrabold">Your table is ready!</h1><p className="mt-3 text-muted-foreground">Share this invitation with your housemates.</p><p className="mt-6 text-4xl font-extrabold tracking-[0.2em]">{created}</p><Button variant="outline" className="mt-4" onClick={async()=>{await navigator.clipboard.writeText(created);toast.success('Invite code copied');}}><Copy/>Copy invite code</Button><Button className="mt-7" size="lg" onClick={async()=>{await qc.invalidateQueries();navigate({to:'/dashboard'});}}>Go to my dashboard <ArrowRight/></Button></>}
 </main><footer className="text-center text-xs text-muted-foreground">Meals. Housemates. Peace of mind.</footer></div>;
}
