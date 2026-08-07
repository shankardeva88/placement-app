import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, ExternalLink, Pencil, Power, Trash2, User } from "lucide-react";
import { ref, onValue } from "firebase/database";
import { db } from "../../firebase/config";
import { DB_NODES } from "@placement-app/types";
import type { ApplicationStatus, Department, Drive, Gender, Student } from "@placement-app/types";
import { useAuth } from "../../auth/AuthContext";
import { setStudentVerified, updateStudentProfile, setStudentActive, removeStudent } from "../../lib/studentsDirectoryLib";
import type { StudentProfileUpdate } from "../../lib/studentsDirectoryLib";
import { useAllApplications } from "../../lib/applicantsLib";
import { useAllOffers } from "../../lib/offersManagementLib";
import { useToast } from "../../components/ui/Toast";
import { Card } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import type { BadgeVariant } from "../../components/ui/Badge";
import { RoundProgress } from "../../components/RoundProgress";
import { Button } from "../../components/ui/Button";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader } from "../../components/ui/PageHeader";

const CAN_MANAGE_ROLES = ["coordinator", "hod", "dean", "principal", "cpo", "admin"];
const DEPARTMENTS: Department[] = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "AIML", "AIDS", "OTHER"];
const GENDERS: Gender[] = ["male", "female", "other", "prefer_not_to_say"];

const APPLICATION_STATUS_BADGE: Record<ApplicationStatus, BadgeVariant> = {
  applied: "brand",
  shortlisted: "brand",
  in_round: "warning",
  selected: "success",
  rejected: "danger",
  withdrawn: "neutral",
};

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-xs font-medium text-slate-600";

function EditStudentForm({ student, uid, onDone }: { student: Student; uid: string; onDone: () => void }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({
    rollNo: student.rollNo,
    name: student.name,
    department: student.department,
    batchYear: student.batchYear,
    cgpa: student.cgpa,
    activeBacklogs: student.activeBacklogs,
    gender: student.gender ?? "prefer_not_to_say",
    studentPhone: student.studentPhone ?? "",
    personalEmail: student.personalEmail ?? "",
    dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().slice(0, 10) : "",
    tenthPercentage: student.tenthPercentage ?? "",
    tenthYearOfPassing: student.tenthYearOfPassing ?? "",
    twelfthPercentage: student.twelfthPercentage ?? "",
    twelfthYearOfPassing: student.twelfthYearOfPassing ?? "",
    resumeUrl: student.resumeUrl ?? "",
  });
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const updates: StudentProfileUpdate = {
        rollNo: form.rollNo,
        name: form.name,
        department: form.department,
        batchYear: form.batchYear,
        cgpa: form.cgpa,
        activeBacklogs: form.activeBacklogs,
        gender: form.gender,
        studentPhone: form.studentPhone || undefined,
        personalEmail: form.personalEmail || undefined,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).getTime() : undefined,
        tenthPercentage: form.tenthPercentage === "" ? undefined : Number(form.tenthPercentage),
        tenthYearOfPassing: form.tenthYearOfPassing === "" ? undefined : Number(form.tenthYearOfPassing),
        twelfthPercentage: form.twelfthPercentage === "" ? undefined : Number(form.twelfthPercentage),
        twelfthYearOfPassing: form.twelfthYearOfPassing === "" ? undefined : Number(form.twelfthYearOfPassing),
        resumeUrl: form.resumeUrl || undefined,
      };
      await updateStudentProfile(uid, updates);
      showToast("Profile updated");
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mb-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Edit roster info</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className={labelClass}>Roll number</label>
            <input required value={form.rollNo} onChange={(e) => set("rollNo", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Name</label>
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Department</label>
            <select value={form.department} onChange={(e) => set("department", e.target.value as Department)} className={inputClass}>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Batch year</label>
            <input type="number" value={form.batchYear} onChange={(e) => set("batchYear", Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>CGPA</label>
            <input type="number" step="0.01" min={0} max={10} value={form.cgpa} onChange={(e) => set("cgpa", Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Active backlogs</label>
            <input type="number" min={0} value={form.activeBacklogs} onChange={(e) => set("activeBacklogs", Number(e.target.value))} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Gender</label>
            <select value={form.gender} onChange={(e) => set("gender", e.target.value as Gender)} className={inputClass}>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Date of birth</label>
            <input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input value={form.studentPhone} onChange={(e) => set("studentPhone", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Personal email</label>
            <input type="email" value={form.personalEmail} onChange={(e) => set("personalEmail", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>10th %</label>
            <input type="number" step="0.01" value={form.tenthPercentage} onChange={(e) => set("tenthPercentage", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>10th year</label>
            <input type="number" value={form.tenthYearOfPassing} onChange={(e) => set("tenthYearOfPassing", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>12th %</label>
            <input type="number" step="0.01" value={form.twelfthPercentage} onChange={(e) => set("twelfthPercentage", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>12th year</label>
            <input type="number" value={form.twelfthYearOfPassing} onChange={(e) => set("twelfthYearOfPassing", e.target.value)} className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Resume link</label>
            <input type="url" value={form.resumeUrl} onChange={(e) => set("resumeUrl", e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" loading={submitting}>
            Save changes
          </Button>
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{children || "—"}</dd>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="mb-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">{children}</dl>
    </Card>
  );
}

export default function StudentDetail() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const canManage = !!appUser && CAN_MANAGE_ROLES.includes(appUser.role);
  const [student, setStudent] = useState<Student | null | undefined>(undefined);
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const allApplications = useAllApplications(appUser);
  const allOffers = useAllOffers(appUser);
  const applications = allApplications?.filter((a) => a.studentId === uid) ?? [];
  const offers = allOffers?.filter((o) => o.studentId === uid) ?? [];
  const [drives, setDrives] = useState<Record<string, Drive>>({});
  const [verifying, setVerifying] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return onValue(ref(db, `${DB_NODES.students}/${uid}`), (snap) => {
      setStudent(snap.exists() ? (snap.val() as Student) : null);
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onValue(ref(db, `${DB_NODES.users}/${uid}/isActive`), (snap) => {
      setIsActive(snap.exists() ? (snap.val() as boolean) : true);
    });
  }, [uid]);

  useEffect(() => {
    return onValue(ref(db, DB_NODES.drives), (snap) => {
      setDrives((snap.val() as Record<string, Drive> | null) ?? {});
    });
  }, []);

  async function handleToggleVerified() {
    if (!student || !uid) return;
    setVerifying(true);
    try {
      await setStudentVerified(uid, !student.verifiedByFaculty);
      showToast(student.verifiedByFaculty ? "Verification removed" : "Profile verified");
    } finally {
      setVerifying(false);
    }
  }

  async function handleToggleActive() {
    if (!uid || isActive === null) return;
    setTogglingActive(true);
    try {
      await setStudentActive(uid, !isActive);
      showToast(isActive ? "Student deactivated" : "Student reactivated");
    } finally {
      setTogglingActive(false);
    }
  }

  async function handleDelete() {
    if (!uid) return;
    setDeleting(true);
    try {
      await removeStudent(uid);
      showToast("Student deleted");
      navigate("/staff/students");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  const semesterEntries = student?.semesterWiseSgpa
    ? Object.entries(student.semesterWiseSgpa).sort(([a], [b]) => a.localeCompare(b))
    : [];

  return (
    <div>
      <Link to="/staff/students" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to students
      </Link>

      {student === undefined && <Skeleton className="h-40" />}
      {student === null && <p className="text-sm text-slate-500">Student not found, or you don't have access to this record.</p>}

      {student && (
        <>
          <PageHeader
            title={`${student.rollNo} — ${student.name}`}
            subtitle={
              <span className="flex items-center gap-2">
                {`${student.department} · Batch ${student.batchYear} · Semester ${student.currentSemester}`}
                {isActive === false && <Badge variant="danger">Inactive</Badge>}
              </span>
            }
            icon={User}
            gradient="from-emerald-500 to-teal-600"
            action={
              <div className="flex flex-wrap gap-2">
                {canManage && (
                  <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
                    <Pencil className="h-4 w-4" />
                    {editing ? "Cancel edit" : "Edit"}
                  </Button>
                )}
                <Button variant={student.verifiedByFaculty ? "secondary" : "primary"} loading={verifying} onClick={handleToggleVerified}>
                  <BadgeCheck className="h-4 w-4" />
                  {student.verifiedByFaculty ? "Unverify profile" : "Verify profile"}
                </Button>
                {canManage && (
                  <Button variant={isActive === false ? "primary" : "danger"} loading={togglingActive} onClick={handleToggleActive}>
                    <Power className="h-4 w-4" />
                    {isActive === false ? "Reactivate" : "Deactivate"}
                  </Button>
                )}
                {canManage && (
                  <Button variant="danger" onClick={() => setConfirmingDelete(true)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
            }
          />

          {confirmingDelete && (
            <Card className="mb-4 border-red-200 bg-red-50">
              <p className="mb-3 text-sm text-red-700">
                Permanently delete <span className="font-medium">{student.name}</span>'s account and all roster data? This
                can't be undone — the login, profile, and department listing are all removed. If this student just needs
                to lose access temporarily, use Deactivate instead.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="danger" onClick={handleDelete} loading={deleting}>
                  <Trash2 className="h-4 w-4" />
                  Yes, delete permanently
                </Button>
                <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          {editing && <EditStudentForm student={student} uid={student.uid} onDone={() => setEditing(false)} />}

          <SectionCard title="Academics">
            <Field label="CGPA">{student.cgpa}</Field>
            <Field label="Active backlogs">{student.activeBacklogs}</Field>
            <Field label="Placement status">
              <span className="capitalize">{student.placementStatus.replace("_", " ")}</span>
            </Field>
            <Field label="Verified">{student.verifiedByFaculty ? "Yes" : "No"}</Field>
            <Field label="Alumni">{student.isAlumni ? "Yes" : "No"}</Field>
          </SectionCard>

          {semesterEntries.length > 0 && (
            <SectionCard title="Semester-wise SGPA">
              {semesterEntries.map(([sem, sgpa]) => (
                <Field key={sem} label={sem.replace("sem", "Semester ")}>
                  {sgpa}
                </Field>
              ))}
            </SectionCard>
          )}

          <SectionCard title="10th / 12th / Diploma">
            <Field label="10th">
              {student.tenthPercentage != null ? `${student.tenthPercentage}%` : "—"}
              {student.tenthSchool ? ` · ${student.tenthSchool}` : ""}
              {student.tenthBoard ? ` (${student.tenthBoard})` : ""}
              {student.tenthYearOfPassing ? `, ${student.tenthYearOfPassing}` : ""}
            </Field>
            <Field label="12th">
              {student.twelfthPercentage != null ? `${student.twelfthPercentage}%` : "—"}
              {student.twelfthSchool ? ` · ${student.twelfthSchool}` : ""}
              {student.twelfthBoard ? ` (${student.twelfthBoard})` : ""}
              {student.twelfthYearOfPassing ? `, ${student.twelfthYearOfPassing}` : ""}
            </Field>
            <Field label="Diploma">
              {student.diplomaPercentage != null ? `${student.diplomaPercentage}%` : "—"}
              {student.diplomaSchool ? ` · ${student.diplomaSchool}` : ""}
              {student.diplomaBoard ? ` (${student.diplomaBoard})` : ""}
              {student.diplomaYearOfPassing ? `, ${student.diplomaYearOfPassing}` : ""}
            </Field>
          </SectionCard>

          <SectionCard title="Contact">
            <Field label="Student phone">{student.studentPhone}</Field>
            <Field label="Personal email">{student.personalEmail}</Field>
            <Field label="Alternate phone">{student.alternatePhone}</Field>
            <Field label="Parent / Guardian name">{student.parentName}</Field>
            <Field label="Parent / Guardian phone">{student.parentPhone}</Field>
          </SectionCard>

          <SectionCard title="Address">
            <Field label="Permanent address">{student.address}</Field>
            <Field label="City">{student.city}</Field>
            <Field label="State">{student.state}</Field>
            <Field label="Pincode">{student.pincode}</Field>
          </SectionCard>

          <SectionCard title="Personal details">
            <Field label="Date of birth">{student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : undefined}</Field>
            <Field label="Gender">
              <span className="capitalize">{student.gender?.replace("_", " ")}</span>
            </Field>
            <Field label="Blood group">{student.bloodGroup}</Field>
          </SectionCard>

          <Card className="mb-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Skills & links</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <Field label="Skills">{(student.skills ?? []).join(", ")}</Field>
              <div>
                <dt className="text-slate-500">Resume</dt>
                <dd className="font-medium text-slate-900">
                  {student.resumeUrl ? (
                    <a href={student.resumeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">LinkedIn</dt>
                <dd className="font-medium text-slate-900">
                  {student.linkedinUrl ? (
                    <a href={student.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">GitHub</dt>
                <dd className="font-medium text-slate-900">
                  {student.githubUrl ? (
                    <a href={student.githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Portfolio</dt>
                <dd className="font-medium text-slate-900">
                  {student.portfolioUrl ? (
                    <a href={student.portfolioUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          {(student.certifications ?? []).length > 0 && (
            <Card className="mb-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Certifications</h3>
              <ul className="divide-y divide-slate-100">
                {(student.certifications ?? []).map((cert, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="font-medium text-slate-800">{cert.name}</span>
                    {cert.url && (
                      <a href={cert.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="mb-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Trainings</h3>
            {Object.keys(student.trainings ?? {}).length === 0 ? (
              <p className="text-sm text-slate-500">None recorded yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(student.trainings ?? {}).map(([name, label]) => (
                  <Badge key={name} variant="success" title={label}>
                    {name}
                  </Badge>
                ))}
              </div>
            )}
          </Card>

          <Card className="mb-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Applications</h3>
            {applications.length === 0 ? (
              <p className="text-sm text-slate-500">No applications yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {applications.map((a) => (
                  <li key={a.applicationId} className="space-y-2 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-800">{drives[a.driveId]?.companyName ?? a.driveId}</span>
                      <Badge variant={APPLICATION_STATUS_BADGE[a.status]}>{a.status.replace("_", " ")}</Badge>
                    </div>
                    {drives[a.driveId] && <RoundProgress rounds={drives[a.driveId].rounds} application={a} />}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Offers</h3>
            {offers.length === 0 ? (
              <p className="text-sm text-slate-500">No offers yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {offers.map((o) => (
                  <li key={o.offerId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="font-medium text-slate-800">
                      {drives[o.driveId]?.companyName ?? o.driveId} — {o.designation}
                    </span>
                    <Badge variant="success">{o.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
