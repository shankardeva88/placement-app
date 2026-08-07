import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ShieldAlert, Trash2, UserPlus } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { AppUser, Department } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { createStaffAccount, updateStaffAccount, removeStaffAccount } from "../../lib/staffAuthActions";
import type { StaffRole } from "../../lib/staffAuthActions";
import { useToast } from "../../components/ui/Toast";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { PageHeader } from "../../components/ui/PageHeader";
import { Skeleton } from "../../components/ui/Skeleton";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const smallInputClass =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

const DEPARTMENTS: Department[] = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "AIDS", "OTHER"];

const ALL_ROLES: StaffRole[] = ["admin", "dean", "principal", "cpo", "hod", "coordinator", "faculty_mentor"];
const DEPT_ROLES: StaffRole[] = ["hod", "coordinator", "faculty_mentor"];

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  dean: "Dean",
  principal: "Principal",
  cpo: "CPO",
  hod: "HOD",
  coordinator: "Coordinator",
  faculty_mentor: "Faculty Mentor",
  student: "Student",
  recruiter: "Recruiter",
};

function CreateStaffForm() {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>("coordinator");
  const [department, setDepartment] = useState<Department>("CSE");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsDepartment = DEPT_ROLES.includes(role);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    const trimmedName = name.trim();
    if (trimmedPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await createStaffAccount({
        email: trimmedEmail,
        password: trimmedPassword,
        name: trimmedName,
        role,
        department: needsDepartment ? department : undefined,
      });
      showToast(`${ROLE_LABEL[role]} account created`);
      setName("");
      setEmail("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mb-6">
      <h3 className="mb-4 text-base font-semibold text-slate-900">Create staff account</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Full name</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Temporary password</label>
            <input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={inputClass}>
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {needsDepartment && (
          <div>
            <label className={labelClass}>Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value as Department)} className={inputClass}>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" loading={submitting}>
          Create account
        </Button>
      </form>
    </Card>
  );
}

function StaffRow({ user }: { user: AppUser }) {
  const { showToast } = useToast();
  const currentDept = "department" in user ? user.department : undefined;
  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<StaffRole>(user.role as StaffRole);
  const [department, setDepartment] = useState<Department>(currentDept ?? "CSE");
  const [isActive, setIsActive] = useState(user.isActive);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const needsDepartment = DEPT_ROLES.includes(role);

  async function handleSave() {
    setSaving(true);
    try {
      await updateStaffAccount({
        uid: user.uid,
        name: name.trim(),
        role,
        department: needsDepartment ? department : undefined,
        isActive,
      });
      showToast("Account updated");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setName(user.name);
    setRole(user.role as StaffRole);
    setDepartment(currentDept ?? "CSE");
    setIsActive(user.isActive);
    setEditing(false);
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await removeStaffAccount(user.uid);
      showToast(`${user.name} removed`);
    } finally {
      setRemoving(false);
      setConfirmingRemove(false);
    }
  }

  if (confirmingRemove) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-red-50 py-2 text-sm last:border-0">
        <p className="text-red-700">
          Remove <span className="font-medium">{user.name}</span>'s access? Their login stays registered with Firebase
          (can't be deleted from here), but they'll lose all app access immediately.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="danger" onClick={handleRemove} loading={removing}>
            <Trash2 className="h-4 w-4" />
            Confirm remove
          </Button>
          <Button variant="secondary" onClick={() => setConfirmingRemove(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-0">
      <div>
        <p className="font-medium text-slate-800">{user.name}</p>
        <p className="text-xs text-slate-500">{user.email}</p>
      </div>

      {!editing ? (
        <div className="flex items-center gap-2">
          {!user.isActive && <Badge variant="danger">Inactive</Badge>}
          <Badge variant="neutral">
            {ROLE_LABEL[user.role] ?? user.role}
            {currentDept ? ` · ${currentDept}` : ""}
          </Badge>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="secondary" onClick={() => setConfirmingRemove(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={smallInputClass} placeholder="Name" />
          <select value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={smallInputClass}>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          {needsDepartment && (
            <select value={department} onChange={(e) => setDepartment(e.target.value as Department)} className={smallInputClass}>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
          <Button onClick={handleSave} loading={saving}>
            Save
          </Button>
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

export default function ManageStaff() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";
  const [staffList, setStaffList] = useState<AppUser[] | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    return onValue(ref(db, DB_NODES.users), (snap) => {
      const val = snap.val() as Record<string, AppUser> | null;
      const list = val ? Object.values(val).filter((u) => u.role !== "student") : [];
      setStaffList(list);
    });
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div>
        <PageHeader
          title="Manage Staff"
          subtitle="Create and edit staff accounts."
          icon={UserPlus}
          gradient="from-violet-500 to-purple-600"
        />
        <Card className="flex items-center gap-3 text-sm text-slate-600">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-500" />
          Staff account creation and role changes are handled by an admin account. Contact your admin if you need a
          new staff account or a role change.
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Manage Staff"
        subtitle="Create staff accounts and edit existing roles."
        icon={UserPlus}
        gradient="from-violet-500 to-purple-600"
      />

      <CreateStaffForm />

      <Card>
        <h3 className="mb-4 text-base font-semibold text-slate-900">All staff</h3>
        {staffList === null && <Skeleton className="h-24" />}
        <div className="space-y-2">
          {staffList?.map((u) => (
            <StaffRow key={u.uid} user={u} />
          ))}
        </div>
      </Card>
    </div>
  );
}
