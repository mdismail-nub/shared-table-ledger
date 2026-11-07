import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Info, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { householdCategories, mealCategories, members } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function MemberSelect() {
  return (
    <Select defaultValue="m1">
      <SelectTrigger className="h-11 rounded-xl">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Shell({
  trigger,
  title,
  desc,
  children,
  onSave,
  cta,
}: {
  trigger: ReactNode;
  title: string;
  desc: string;
  children: ReactNode;
  onSave: () => void;
  cta: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
            setOpen(false);
          }}
        >
          {children}
          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{cta}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddExpenseDialog({ trigger }: { trigger: ReactNode }) {
  const [type, setType] = useState<"meal" | "household">("meal");
  const cats = type === "meal" ? mealCategories : householdCategories;
  return (
    <Shell
      trigger={trigger}
      title="Add expense"
      desc="Record a bazar purchase or a shared household bill."
      cta="Save expense"
      onSave={() =>
        toast.success("Expense saved", { description: "The expense has been added successfully." })
      }
    >
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary p-1">
        {(["meal", "household"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              "rounded-xl py-2.5 text-sm font-semibold text-muted-foreground transition",
              type === t && "bg-card text-foreground shadow-card",
            )}
          >
            {t === "meal" ? "Meal / Bazar" : "Household bill"}
          </button>
        ))}
      </div>
      <div
        className={cn(
          "flex gap-2 rounded-xl p-3 text-xs",
          type === "meal" ? "bg-mint text-mint-foreground" : "bg-peach text-peach-foreground",
        )}
      >
        <Info className="h-4 w-4 shrink-0" />
        {type === "meal"
          ? "This amount will be included in the meal rate."
          : "Household bills are split separately and never change the meal rate."}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount (৳)">
          <Input
            required
            type="number"
            min={1}
            placeholder="0"
            className="h-11 rounded-xl text-lg font-bold"
          />
        </Field>
        <Field label="Date">
          <Input type="date" defaultValue="2026-10-23" className="h-11 rounded-xl" />
        </Field>
        <Field label="Category">
          <Select key={type} defaultValue={cats[0]!}>
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cats.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Purchased by">
          <MemberSelect />
        </Field>
        <Field label="Payment method">
          <Select defaultValue="Cash">
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Cash", "bKash", "Nagad", "Bank"].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Receipt">
          <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed text-sm text-muted-foreground hover:bg-secondary">
            <Upload className="h-4 w-4" /> Attach image{" "}
            <input type="file" accept="image/*" className="sr-only" />
          </label>
        </Field>
      </div>
      <Field label="Description">
        <Textarea placeholder="e.g. Rice 25kg, lentils 2kg" className="rounded-xl" />
      </Field>
    </Shell>
  );
}

export function AddDepositDialog({ trigger }: { trigger: ReactNode }) {
  return (
    <Shell
      trigger={trigger}
      title="Add deposit"
      desc="Money received from a member increases their credit."
      cta="Save deposit"
      onSave={() =>
        toast.success("Deposit recorded", { description: "Member balance has been updated." })
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Member">
          <MemberSelect />
        </Field>
        <Field label="Amount (৳)">
          <Input
            required
            type="number"
            min={1}
            placeholder="0"
            className="h-11 rounded-xl text-lg font-bold"
          />
        </Field>
        <Field label="Type">
          <Select defaultValue="Deposit">
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Deposit", "Advance", "Refund"].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Method">
          <Select defaultValue="bKash">
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Cash", "bKash", "Nagad", "Bank"].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" defaultValue="2026-10-23" className="h-11 rounded-xl" />
        </Field>
        <Field label="Reference (optional)">
          <Input placeholder="TrxID" className="h-11 rounded-xl" />
        </Field>
      </div>
    </Shell>
  );
}

export function AddMemberDialog({ trigger }: { trigger: ReactNode }) {
  return (
    <Shell
      trigger={trigger}
      title="Add member"
      desc="Create a financial profile for a new mess member."
      cta="Add member"
      onSave={() =>
        toast.success("Member added", { description: "They can now be included in meals." })
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <Input required placeholder="e.g. Rahim Uddin" className="h-11 rounded-xl" />
        </Field>
        <Field label="Phone">
          <Input placeholder="01XXX-XXXXXX" className="h-11 rounded-xl" />
        </Field>
        <Field label="Room / seat">
          <Input placeholder="A-1" className="h-11 rounded-xl" />
        </Field>
        <Field label="Joining date">
          <Input type="date" defaultValue="2026-10-23" className="h-11 rounded-xl" />
        </Field>
        <Field label="Opening deposit (৳)">
          <Input type="number" placeholder="0" className="h-11 rounded-xl" />
        </Field>
        <Field label="Shares household bills">
          <Select defaultValue="yes">
            <SelectTrigger className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes, from join date</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </Shell>
  );
}
