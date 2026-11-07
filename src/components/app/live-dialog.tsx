import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSave, db, today } from "@/lib/data";
import { useWorkspace } from "@/lib/workspace";

export function LiveDialog({ kind }: { kind: "member" | "expense" | "payment" }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"meal" | "household">("meal");
  const w = useWorkspace();

  const save = useSave(async (f: FormData) => {
    const val = (k: string) => String(f.get(k) ?? "").trim();

    if (kind === "member") {
      const name = val("name");
      if (name.length < 1 || name.length > 80)
        throw new Error("Member name must be between 1 and 80 characters.");
      return await db.from("mess_members").insert({
        name,
        phone: val("phone").slice(0, 30),
        room: val("room").slice(0, 30),
      });
    }

    if (kind === "expense") {
      const date = val("date");
      const category = val("category");
      const amount = Number(val("amount"));
      if (!date) throw new Error("Please select a valid date.");
      if (!category) throw new Error("Please select an expense category.");
      if (isNaN(amount) || amount <= 0 || amount >= 10000000) {
        throw new Error("Please enter a valid amount between ৳0.01 and ৳9,999,999.");
      }
      return await db.from("mess_expenses").insert({
        date,
        type,
        category: category.slice(0, 60),
        description: val("description").slice(0, 300),
        amount,
        method: val("method") || "Cash",
      });
    }

    const member_id = val("member_id");
    const date = val("date");
    const amount = Number(val("amount"));
    if (!member_id) throw new Error("Please select a member.");
    if (!date) throw new Error("Please select a valid date.");
    if (isNaN(amount) || amount <= 0 || amount >= 10000000) {
      throw new Error("Please enter a valid amount between ৳0.01 and ৳9,999,999.");
    }
    return await db.from("payments").insert({
      member_id,
      date,
      amount,
      method: val("method") || "Cash",
      reference: val("reference").slice(0, 100),
    });
  }, "Record saved");

  if (!w.isAdmin) return null;

  const title =
    kind === "member" ? "Add member" : kind === "expense" ? "Add expense" : "Add payment";
  const selectClass =
    "mt-2 h-11 w-full rounded-xl border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  const defaultMealCats = [
    "Rice",
    "Vegetables",
    "Fish & meat",
    "Eggs",
    "Cooking oil",
    "Spices",
    "Other food",
  ];
  const defaultHouseCats = ["Wi-Fi", "Electricity", "Gas", "Water", "Cleaning", "Other household"];
  const availableCategories = (type === "meal"
    ? w.mess?.meal_categories
    : w.mess?.household_categories
  )?.length
    ? type === "meal"
      ? w.mess?.meal_categories
      : w.mess?.household_categories
    : type === "meal"
      ? defaultMealCats
      : defaultHouseCats;

  const eligibleMembers = w.members.filter((m) => m.status !== "left");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {title}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await save.mutateAsync(new FormData(e.currentTarget));
              setOpen(false);
            } catch {
              // Toast displays error, form remains open for corrections
            }
          }}
          className="space-y-4"
        >
          {kind === "member" ? (
            <>
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  maxLength={80}
                  placeholder="e.g. Tanvir Ahmed"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number (optional)</Label>
                <Input
                  id="phone"
                  name="phone"
                  maxLength={30}
                  placeholder="e.g. 01700000000"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="room">Room / Seat (optional)</Label>
                <Input
                  id="room"
                  name="room"
                  maxLength={30}
                  placeholder="e.g. 302-B"
                  className="mt-2"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={today()}
                  required
                  className="mt-2"
                />
              </div>

              {kind === "payment" ? (
                <div>
                  <Label htmlFor="member_id">Member</Label>
                  {eligibleMembers.length === 0 ? (
                    <p className="mt-2 text-sm text-destructive">
                      No active members found. Please add a member first.
                    </p>
                  ) : (
                    <select id="member_id" name="member_id" required className={selectClass}>
                      {eligibleMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.room ? `(${m.room})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="type">Expense Type</Label>
                    <select
                      id="type"
                      value={type}
                      onChange={(e) => setType(e.target.value as "meal" | "household")}
                      className={selectClass}
                    >
                      <option value="meal">Meal / Food Bazar</option>
                      <option value="household">Household Bill / Utility</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <select id="category" name="category" required className={selectClass}>
                      {availableCategories?.map((c: string) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="description">Description (optional)</Label>
                    <Input
                      id="description"
                      name="description"
                      maxLength={300}
                      placeholder="e.g. Weekly chicken and spices"
                      className="mt-2"
                    />
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="amount">Amount (৳)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  max="9999999.99"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="method">Payment Method</Label>
                <select id="method" name="method" className={selectClass}>
                  {["Cash", "bKash", "Nagad", "Rocket", "Bank transfer"].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>

              {kind === "payment" && (
                <div>
                  <Label htmlFor="reference">Reference / TrxID (optional)</Label>
                  <Input
                    id="reference"
                    name="reference"
                    maxLength={100}
                    placeholder="e.g. TrxID 9H4K2M"
                    className="mt-2"
                  />
                </div>
              )}
            </>
          )}

          <Button
            className="w-full"
            disabled={save.isPending || (kind === "payment" && eligibleMembers.length === 0)}
          >
            {save.isPending && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
