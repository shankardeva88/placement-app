import { Fragment, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { IdCard, Plus, X, Pencil, BadgeCheck } from "lucide-react";
import type { BloodGroup, Gender } from "@placement-app/types";
import { useAuth } from "../auth/AuthContext";
import { updatePersonalDetails } from "../lib/personalDetailsActions";
import { useToast } from "../components/ui/Toast";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];
const GENDER_LABEL: Record<Gender, string> = Object.fromEntries(GENDERS.map((g) => [g.value, g.label])) as Record<
  Gender,
  string
>;

const BLOOD_GROUPS: BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

/** Toggles between the live input (editing) and a plain read-only display of
 * its current value (view mode, the default) — one render path instead of a
 * separate read-only mirror of the whole form. */
function ViewOrEdit({ editing, display, children }: { editing: boolean; display: string; children: ReactNode }) {
  if (editing) return <>{children}</>;
  return (
    <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
      {display || <span className="text-slate-400">—</span>}
    </p>
  );
}

function toDateInputValue(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toISOString().slice(0, 10);
}

/** Roll No / Name / College Email / current education — none of this is
 * part of PersonalDetailsInput (identity fields freeze on verification, and
 * college email is the login itself, not something this form edits), but
 * the page never showed them at all before. Always read-only. */
function IdentityHeader() {
  const { student } = useAuth();
  if (!student) return null;

  return (
    <Card className="mb-6">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        <BadgeCheck className="h-4 w-4" />
        On file with the placement cell
      </div>
      <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-slate-500">Roll number</p>
          <p className="font-medium text-slate-900">{student.rollNo || "—"}</p>
        </div>
        <div>
          <p className="text-slate-500">Name</p>
          <p className="font-medium text-slate-900">{student.name || "—"}</p>
        </div>
        <div>
          <p className="text-slate-500">College email (login)</p>
          <p className="font-medium text-slate-900">{student.email || "—"}</p>
        </div>
        <div>
          <p className="text-slate-500">Department</p>
          <p className="font-medium text-slate-900">{student.department}</p>
        </div>
        <div>
          <p className="text-slate-500">Batch</p>
          <p className="font-medium text-slate-900">{student.batchYear}</p>
        </div>
        <div>
          <p className="text-slate-500">Current semester</p>
          <p className="font-medium text-slate-900">{student.currentSemester}</p>
        </div>
      </div>
    </Card>
  );
}

export default function PersonalDetails() {
  const { firebaseUser, student } = useAuth();
  const { showToast } = useToast();

  const [studentPhone, setStudentPhone] = useState(student?.studentPhone ?? "");
  const [personalEmail, setPersonalEmail] = useState(student?.personalEmail ?? "");
  const [parentName, setParentName] = useState(student?.parentName ?? "");
  const [parentPhone, setParentPhone] = useState(student?.parentPhone ?? "");
  const [alternatePhone, setAlternatePhone] = useState(student?.alternatePhone ?? "");

  const [address, setAddress] = useState(student?.address ?? "");
  const [city, setCity] = useState(student?.city ?? "");
  const [state, setState] = useState(student?.state ?? "");
  const [pincode, setPincode] = useState(student?.pincode ?? "");

  const [dateOfBirth, setDateOfBirth] = useState(toDateInputValue(student?.dateOfBirth));
  const [gender, setGender] = useState<Gender | "">(student?.gender ?? "");
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | "">(student?.bloodGroup ?? "");

  const [tenthPercentage, setTenthPercentage] = useState(
    student?.tenthPercentage?.toString() ?? ""
  );
  const [tenthSchool, setTenthSchool] = useState(student?.tenthSchool ?? "");
  const [tenthBoard, setTenthBoard] = useState(student?.tenthBoard ?? "");
  const [tenthYearOfPassing, setTenthYearOfPassing] = useState(
    student?.tenthYearOfPassing?.toString() ?? ""
  );

  const [twelfthPercentage, setTwelfthPercentage] = useState(
    student?.twelfthPercentage?.toString() ?? ""
  );
  const [twelfthSchool, setTwelfthSchool] = useState(student?.twelfthSchool ?? "");
  const [twelfthBoard, setTwelfthBoard] = useState(student?.twelfthBoard ?? "");
  const [twelfthYearOfPassing, setTwelfthYearOfPassing] = useState(
    student?.twelfthYearOfPassing?.toString() ?? ""
  );

  const [diplomaPercentage, setDiplomaPercentage] = useState(
    student?.diplomaPercentage?.toString() ?? ""
  );
  const [diplomaSchool, setDiplomaSchool] = useState(student?.diplomaSchool ?? "");
  const [diplomaBoard, setDiplomaBoard] = useState(student?.diplomaBoard ?? "");
  const [diplomaYearOfPassing, setDiplomaYearOfPassing] = useState(
    student?.diplomaYearOfPassing?.toString() ?? ""
  );

  const [linkedinUrl, setLinkedinUrl] = useState(student?.linkedinUrl ?? "");
  const [githubUrl, setGithubUrl] = useState(student?.githubUrl ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState(student?.portfolioUrl ?? "");
  const [resumeUrl, setResumeUrl] = useState(student?.resumeUrl ?? "");

  const [skillsText, setSkillsText] = useState(student?.skills?.join(", ") ?? "");
  const [certifications, setCertifications] = useState(
    student?.certifications?.map((c) => ({ name: c.name, url: c.url ?? "" })) ?? []
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Defaults to edit mode for a student filling this in for the first time
  // (profileComplete false), view mode for everyone reviewing what's
  // already on file — set once when the student record first loads, not
  // re-applied afterward so it doesn't fight the Edit/Cancel buttons.
  const [editing, setEditing] = useState(false);
  const [editingInitialized, setEditingInitialized] = useState(false);
  useEffect(() => {
    if (!editingInitialized && student) {
      setEditing(!student.profileComplete);
      setEditingInitialized(true);
    }
  }, [student, editingInitialized]);

  function resetFromStudent() {
    if (!student) return;
    setStudentPhone(student.studentPhone ?? "");
    setPersonalEmail(student.personalEmail ?? "");
    setParentName(student.parentName ?? "");
    setParentPhone(student.parentPhone ?? "");
    setAlternatePhone(student.alternatePhone ?? "");
    setAddress(student.address ?? "");
    setCity(student.city ?? "");
    setState(student.state ?? "");
    setPincode(student.pincode ?? "");
    setDateOfBirth(toDateInputValue(student.dateOfBirth));
    setGender(student.gender ?? "");
    setBloodGroup(student.bloodGroup ?? "");
    setTenthPercentage(student.tenthPercentage?.toString() ?? "");
    setTenthSchool(student.tenthSchool ?? "");
    setTenthBoard(student.tenthBoard ?? "");
    setTenthYearOfPassing(student.tenthYearOfPassing?.toString() ?? "");
    setTwelfthPercentage(student.twelfthPercentage?.toString() ?? "");
    setTwelfthSchool(student.twelfthSchool ?? "");
    setTwelfthBoard(student.twelfthBoard ?? "");
    setTwelfthYearOfPassing(student.twelfthYearOfPassing?.toString() ?? "");
    setDiplomaPercentage(student.diplomaPercentage?.toString() ?? "");
    setDiplomaSchool(student.diplomaSchool ?? "");
    setDiplomaBoard(student.diplomaBoard ?? "");
    setDiplomaYearOfPassing(student.diplomaYearOfPassing?.toString() ?? "");
    setLinkedinUrl(student.linkedinUrl ?? "");
    setGithubUrl(student.githubUrl ?? "");
    setPortfolioUrl(student.portfolioUrl ?? "");
    setResumeUrl(student.resumeUrl ?? "");
    setSkillsText(student.skills?.join(", ") ?? "");
    setCertifications(student.certifications?.map((c) => ({ name: c.name, url: c.url ?? "" })) ?? []);
  }

  function handleCancel() {
    resetFromStudent();
    setError(null);
    setEditing(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firebaseUser) return;
    setError(null);
    setSubmitting(true);
    try {
      await updatePersonalDetails(firebaseUser.uid, {
        studentPhone,
        personalEmail,
        parentName,
        parentPhone,
        alternatePhone,
        address,
        city,
        state,
        pincode,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth).getTime() : null,
        gender,
        bloodGroup,
        tenthPercentage: tenthPercentage ? Number(tenthPercentage) : null,
        tenthSchool,
        tenthBoard,
        tenthYearOfPassing: tenthYearOfPassing ? Number(tenthYearOfPassing) : null,
        twelfthPercentage: twelfthPercentage ? Number(twelfthPercentage) : null,
        twelfthSchool,
        twelfthBoard,
        twelfthYearOfPassing: twelfthYearOfPassing ? Number(twelfthYearOfPassing) : null,
        diplomaPercentage: diplomaPercentage ? Number(diplomaPercentage) : null,
        diplomaSchool,
        diplomaBoard,
        diplomaYearOfPassing: diplomaYearOfPassing ? Number(diplomaYearOfPassing) : null,
        linkedinUrl,
        githubUrl,
        portfolioUrl,
        resumeUrl,
        skills: skillsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        certifications: certifications
          .filter((c) => c.name.trim())
          .map((c) => (c.url.trim() ? { name: c.name.trim(), url: c.url.trim() } : { name: c.name.trim() })),
      });
      showToast("Verified and saved");
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Student Info"
        subtitle="Contact info, address, and academic history — used by the placement cell to reach you."
        icon={IdCard}
        gradient="from-fuchsia-500 to-pink-600"
      />

      <IdentityHeader />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="flex items-center gap-3">
            {editing ? (
              // key="editing-actions" forces React to mount fresh DOM buttons
              // here instead of reusing the "Edit" button's node and mutating
              // its type from "button" to "submit" in place — without this,
              // that mutation happens synchronously inside the Edit click's
              // own event handler, so the *same* native click the browser is
              // still dispatching sees a submit button and submits the form
              // immediately (looks like "click Edit → instantly saved").
              <Fragment key="editing-actions">
                <Button type="submit" loading={submitting}>
                  {submitting ? "Saving…" : "Verify"}
                </Button>
                <Button type="button" variant="secondary" onClick={handleCancel} disabled={submitting}>
                  Cancel
                </Button>
              </Fragment>
            ) : (
              <Button key="view-actions" type="button" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}

          <Section title="Contact details">
            <Field label="Student phone number">
              <ViewOrEdit editing={editing} display={studentPhone}>
                <input type="tel" value={studentPhone} onChange={(e) => setStudentPhone(e.target.value)} className={inputClass} />
              </ViewOrEdit>
            </Field>
            <Field label="Personal email">
              <ViewOrEdit editing={editing} display={personalEmail}>
                <input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} className={inputClass} />
              </ViewOrEdit>
            </Field>
            <Field label="Parent / Guardian name">
              <ViewOrEdit editing={editing} display={parentName}>
                <input type="text" value={parentName} onChange={(e) => setParentName(e.target.value)} className={inputClass} />
              </ViewOrEdit>
            </Field>
            <Field label="Parent / Guardian phone number">
              <ViewOrEdit editing={editing} display={parentPhone}>
                <input type="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} className={inputClass} />
              </ViewOrEdit>
            </Field>
            <Field label="Alternate contact number">
              <ViewOrEdit editing={editing} display={alternatePhone}>
                <input type="tel" value={alternatePhone} onChange={(e) => setAlternatePhone(e.target.value)} className={inputClass} />
              </ViewOrEdit>
            </Field>
          </Section>

          <Section title="Address">
            <div className="sm:col-span-2">
              <Field label="Permanent address">
                <ViewOrEdit editing={editing} display={address}>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={2}
                    className={inputClass}
                  />
                </ViewOrEdit>
              </Field>
            </div>
            <Field label="City">
              <ViewOrEdit editing={editing} display={city}>
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
              </ViewOrEdit>
            </Field>
            <Field label="State">
              <ViewOrEdit editing={editing} display={state}>
                <input type="text" value={state} onChange={(e) => setState(e.target.value)} className={inputClass} />
              </ViewOrEdit>
            </Field>
            <Field label="Pincode">
              <ViewOrEdit editing={editing} display={pincode}>
                <input type="text" value={pincode} onChange={(e) => setPincode(e.target.value)} className={inputClass} />
              </ViewOrEdit>
            </Field>
          </Section>

          <Section title="Personal details">
            <Field label="Date of birth">
              <ViewOrEdit editing={editing} display={dateOfBirth ? new Date(dateOfBirth).toLocaleDateString() : ""}>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className={inputClass}
                />
              </ViewOrEdit>
            </Field>
            <Field label="Gender">
              <ViewOrEdit editing={editing} display={gender ? GENDER_LABEL[gender] : ""}>
                <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} className={inputClass}>
                  <option value="">Select</option>
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </ViewOrEdit>
            </Field>
            <Field label="Blood group">
              <ViewOrEdit editing={editing} display={bloodGroup}>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                  className={inputClass}
                >
                  <option value="">Select</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </ViewOrEdit>
            </Field>
          </Section>

          <Section title="10th details">
            <Field label="Percentage %">
              <ViewOrEdit editing={editing} display={tenthPercentage}>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={tenthPercentage}
                  onChange={(e) => setTenthPercentage(e.target.value)}
                  className={inputClass}
                />
              </ViewOrEdit>
            </Field>
            <Field label="School name">
              <ViewOrEdit editing={editing} display={tenthSchool}>
                <input type="text" value={tenthSchool} onChange={(e) => setTenthSchool(e.target.value)} className={inputClass} />
              </ViewOrEdit>
            </Field>
            <Field label="Board">
              <ViewOrEdit editing={editing} display={tenthBoard}>
                <input type="text" value={tenthBoard} onChange={(e) => setTenthBoard(e.target.value)} className={inputClass} />
              </ViewOrEdit>
            </Field>
            <Field label="Year of passing">
              <ViewOrEdit editing={editing} display={tenthYearOfPassing}>
                <input
                  type="number"
                  value={tenthYearOfPassing}
                  onChange={(e) => setTenthYearOfPassing(e.target.value)}
                  className={inputClass}
                />
              </ViewOrEdit>
            </Field>
          </Section>

          <Section title="12th details">
            <Field label="Percentage %">
              <ViewOrEdit editing={editing} display={twelfthPercentage}>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={twelfthPercentage}
                  onChange={(e) => setTwelfthPercentage(e.target.value)}
                  className={inputClass}
                />
              </ViewOrEdit>
            </Field>
            <Field label="School / College name">
              <ViewOrEdit editing={editing} display={twelfthSchool}>
                <input type="text" value={twelfthSchool} onChange={(e) => setTwelfthSchool(e.target.value)} className={inputClass} />
              </ViewOrEdit>
            </Field>
            <Field label="Board">
              <ViewOrEdit editing={editing} display={twelfthBoard}>
                <input type="text" value={twelfthBoard} onChange={(e) => setTwelfthBoard(e.target.value)} className={inputClass} />
              </ViewOrEdit>
            </Field>
            <Field label="Year of passing">
              <ViewOrEdit editing={editing} display={twelfthYearOfPassing}>
                <input
                  type="number"
                  value={twelfthYearOfPassing}
                  onChange={(e) => setTwelfthYearOfPassing(e.target.value)}
                  className={inputClass}
                />
              </ViewOrEdit>
            </Field>
          </Section>

          <Section title="Diploma details (if applicable)">
            <Field label="Percentage %">
              <ViewOrEdit editing={editing} display={diplomaPercentage}>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  value={diplomaPercentage}
                  onChange={(e) => setDiplomaPercentage(e.target.value)}
                  className={inputClass}
                />
              </ViewOrEdit>
            </Field>
            <Field label="College name">
              <ViewOrEdit editing={editing} display={diplomaSchool}>
                <input type="text" value={diplomaSchool} onChange={(e) => setDiplomaSchool(e.target.value)} className={inputClass} />
              </ViewOrEdit>
            </Field>
            <Field label="Board">
              <ViewOrEdit editing={editing} display={diplomaBoard}>
                <input type="text" value={diplomaBoard} onChange={(e) => setDiplomaBoard(e.target.value)} className={inputClass} />
              </ViewOrEdit>
            </Field>
            <Field label="Year of passing">
              <ViewOrEdit editing={editing} display={diplomaYearOfPassing}>
                <input
                  type="number"
                  value={diplomaYearOfPassing}
                  onChange={(e) => setDiplomaYearOfPassing(e.target.value)}
                  className={inputClass}
                />
              </ViewOrEdit>
            </Field>
          </Section>

          <Section title="Resume">
            <div className="sm:col-span-2">
              <Field label="Resume link">
                {editing ? (
                  <>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/..."
                      value={resumeUrl}
                      onChange={(e) => setResumeUrl(e.target.value)}
                      className={inputClass}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Paste a Google Drive share link (set to "Anyone with the link can view") — there's no file
                      upload here, just a link to wherever your resume already lives.
                    </p>
                  </>
                ) : resumeUrl ? (
                  <a
                    href={resumeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-slate-100 hover:underline"
                  >
                    View current resume →
                  </a>
                ) : (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">
                    No resume added yet — click Edit to add a link.
                  </p>
                )}
              </Field>
            </div>
          </Section>

          <Section title="Professional links">
            <Field label="LinkedIn">
              <ViewOrEdit editing={editing} display={linkedinUrl}>
                <input
                  type="url"
                  placeholder="https://linkedin.com/in/..."
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  className={inputClass}
                />
              </ViewOrEdit>
            </Field>
            <Field label="GitHub">
              <ViewOrEdit editing={editing} display={githubUrl}>
                <input
                  type="url"
                  placeholder="https://github.com/..."
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  className={inputClass}
                />
              </ViewOrEdit>
            </Field>
            <Field label="Portfolio">
              <ViewOrEdit editing={editing} display={portfolioUrl}>
                <input
                  type="url"
                  placeholder="https://..."
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  className={inputClass}
                />
              </ViewOrEdit>
            </Field>
          </Section>

          <Section title="Skills">
            <div className="sm:col-span-2">
              <Field label="Skills (comma separated)">
                <ViewOrEdit editing={editing} display={skillsText}>
                  <input
                    type="text"
                    placeholder="e.g. React, Java, SQL, Python"
                    value={skillsText}
                    onChange={(e) => setSkillsText(e.target.value)}
                    className={inputClass}
                  />
                </ViewOrEdit>
              </Field>
              {editing && (
                <p className="mt-1 text-xs text-slate-500">
                  Companies filter drives by skill, so keep this current — add anything you've learned since setup.
                </p>
              )}
            </div>
          </Section>

          <Section title="Certifications">
            <div className="space-y-2 sm:col-span-2">
              {!editing && certifications.length === 0 && <p className="text-sm text-slate-400">—</p>}
              {editing
                ? certifications.map((cert, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Certification name"
                        value={cert.name}
                        onChange={(e) =>
                          setCertifications((prev) => prev.map((c, idx) => (idx === i ? { ...c, name: e.target.value } : c)))
                        }
                        className={`${inputClass} flex-1`}
                      />
                      <input
                        type="url"
                        placeholder="Credential link (optional)"
                        value={cert.url}
                        onChange={(e) =>
                          setCertifications((prev) => prev.map((c, idx) => (idx === i ? { ...c, url: e.target.value } : c)))
                        }
                        className={`${inputClass} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => setCertifications((prev) => prev.filter((_, idx) => idx !== i))}
                        className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                : certifications.map((cert, i) => (
                    <p key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {cert.name}
                      {cert.url && (
                        <a href={cert.url} target="_blank" rel="noreferrer" className="ml-2 text-brand-700 hover:underline">
                          link
                        </a>
                      )}
                    </p>
                  ))}
              {editing && (
                <button
                  type="button"
                  onClick={() => setCertifications((prev) => [...prev, { name: "", url: "" }])}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
                >
                  <Plus className="h-4 w-4" />
                  Add certification
                </button>
              )}
            </div>
          </Section>
        </form>
      </Card>
    </div>
  );
}
