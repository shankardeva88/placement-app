// ============================================================================
// Placement App — Shared TypeScript Types
// Single source of truth used by both the web app and the React Native app.
// Backed by Firebase Realtime Database (no billing account required, unlike
// Firestore/Cloud Functions which need the Blaze plan).
//
// Realtime Database stores everything as one big JSON tree, so timestamps
// are plain numbers (milliseconds since epoch) instead of Firestore's
// Timestamp object. Use `ServerValue.TIMESTAMP` from "firebase/database"
// when writing, which Firebase replaces server-side.
// ============================================================================

/** Milliseconds since epoch. Write with `ServerValue.TIMESTAMP`. */
export type Timestamp = number;

// ----------------------------------------------------------------------------
// 0. Institution config
// ----------------------------------------------------------------------------

/** Single campus for now — kept as a field (not hardcoded) so a second
 * campus can be added later without a schema migration. */
export type CampusId = string; // default: "main"

/** Adjust this list to your college's actual 9 departments.
 * Kept as a string union so autocomplete works everywhere, but stored
 * as plain string in the database (no enum lock-in if a dept is renamed). */
export type Department =
  | "CSE"
  | "ECE"
  | "EEE"
  | "MECH"
  | "CIVIL"
  | "IT"
  | "AIML"
  | "AIDS"
  | "OTHER"; // placeholder for the 9th dept — tell me its code and I'll swap this in

// ----------------------------------------------------------------------------
// 1. Roles & Users
// ----------------------------------------------------------------------------

export type UserRole =
  | "admin" // institution-wide, the only role that can create/edit staff accounts and roles
  | "dean" // Dean of Placement — institution-wide
  | "principal" // institution-wide, approvals/escalations
  | "cpo" // College Placement Officer — institution-wide operations
  | "hod" // Department-level
  | "coordinator" // Department-level, drive operations (you)
  | "faculty_mentor" // Assigned student group
  | "student"
  | "recruiter"; // external, limited access

export interface BaseUser {
  uid: string; // Firebase Auth UID
  email: string;
  name: string;
  role: UserRole;
  campusId: CampusId;
  createdAt: Timestamp;
  isActive: boolean;
}

export type FacultyDesignation = "professor" | "associate_professor" | "assistant_professor";

/** Roles scoped to a single department: hod, coordinator, faculty_mentor.
 * Dean/Principal/CPO are NOT department-scoped (see InstitutionUser). */
export interface DepartmentScopedUser extends BaseUser {
  role: "hod" | "coordinator" | "faculty_mentor";
  department: Department;
  designation?: FacultyDesignation; // set when creating via Mentor Tools' Add Mentor form; optional elsewhere
}

export interface InstitutionUser extends BaseUser {
  role: "dean" | "principal" | "cpo" | "admin";
  // no department field — sees across all 9 departments
}

export interface RecruiterUser extends BaseUser {
  role: "recruiter";
  companyName: string;
}

export type AppUser =
  | DepartmentScopedUser
  | InstitutionUser
  | RecruiterUser
  | (BaseUser & { role: "student" }); // student profile lives in `students/`

// ----------------------------------------------------------------------------
// 2. Student Master Profile
// ----------------------------------------------------------------------------

export type PlacementStatus =
  | "not_placed"
  | "placed"
  | "multiple_offers"
  | "opted_higher_studies"
  | "opted_out";

export type Gender = "male" | "female" | "other" | "prefer_not_to_say";
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";

export interface Student {
  studentId: string; // RTDB key under /students
  uid: string; // Firebase Auth UID
  campusId: CampusId;
  rollNo: string;
  name: string;
  email?: string; // college login email — mirrors /users/{uid}/email, duplicated here so
  // dept-scoped coordinator/hod (who can read /students but not /users) can see it too
  department: Department;
  batchYear: number; // e.g. 2026 (graduating year)
  currentSemester: number;

  cgpa: number;
  semesterWiseSgpa?: Record<string, number>; // { "sem1": 8.2, "sem2": 7.9, ... }
  activeBacklogs: number;

  tenthPercentage?: number;
  tenthSchool?: string;
  tenthBoard?: string;
  tenthYearOfPassing?: number;

  twelfthPercentage?: number;
  twelfthSchool?: string;
  twelfthBoard?: string;
  twelfthYearOfPassing?: number;

  diplomaPercentage?: number;
  diplomaSchool?: string;
  diplomaBoard?: string;
  diplomaYearOfPassing?: number;

  // Contact — separate from the login email/uid, since a student's placement
  // record needs a way to reach them (and a parent) beyond their college inbox.
  studentPhone?: string;
  personalEmail?: string;
  parentName?: string;
  parentPhone?: string;
  alternatePhone?: string;

  // Address
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;

  // Personal details
  dateOfBirth?: Timestamp;
  gender?: Gender;
  bloodGroup?: BloodGroup;

  // Professional links
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;

  // Directly-viewable image link (not a Drive share page like resumeUrl below)
  // — a Drive share link opens Drive's viewer, not the raw image, so it can't
  // be dropped into an <img src>. Students are pointed at a host that gives a
  // direct link (e.g. Drive's "uc?export=view&id=" form, or any public image
  // URL) — see the PersonalDetails.tsx field for the exact guidance shown.
  photoUrl?: string;
  resumeUrl?: string; // Google Drive share link for now (Storage deferred — see README)
  // Typed as always-present, but RTDB silently omits empty arrays on write
  // (writing skills: [] just doesn't persist the key) — so any record
  // written with no skills yet has this field genuinely missing at runtime,
  // e.g. bulk-imported students (see bulkImportLib.ts). Always read as
  // `student.skills ?? []`, never `student.skills.anything` directly.
  skills: string[];
  certifications?: { name: string; url?: string; issuedAt?: Timestamp }[];

  // Completed external/corporate trainings (Infosys Springboard, SAP, etc.)
  // — training name -> the raw label from the coordinator's tracking sheet
  // (often carries a batch/group, e.g. "Infosys(SP) (B-2)"), not just a
  // boolean. Uploaded via Import Trainings (trainingImportLib.ts), merged
  // in (not replaced) on each upload so re-uploading one training's sheet
  // doesn't erase previously recorded ones. Presence of a key is what drive
  // eligibility's requiredTrainings checks, not the label value.
  trainings?: Record<string, string>;

  // Stamped whenever the student saves Personal Details (skills,
  // certifications, resume link, ...) or Academic Record (semester-wise
  // SGPA, CGPA, backlogs) — the placement-critical fields, not every field
  // on the record (unlike `updatedAt`, which is touched by everything,
  // including staff edits). Lets a coordinator sort/filter students by
  // "recently updated their own placement info" — see the Students page
  // "Recently updated" filter.
  lastSignificantUpdateAt?: Timestamp;

  profileComplete: boolean;
  placementStatus: PlacementStatus;
  isAlumni: boolean;

  verifiedByFaculty: boolean; // locks fields once true
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// 3. Eligibility & Drives
// ----------------------------------------------------------------------------

export interface EligibilityCriteria {
  minCgpa: number; // company "minimum X%" cutoffs are entered as CGPA (X / 9.5)
  maxBacklogsAllowed: number; // 0 = no backlogs allowed
  departments: Department[]; // which depts can apply
  batchYears: number[]; // which graduating years
  minPri?: number; // optional — require Placement Readiness Index threshold
  requiredSkills?: string[]; // student must have ALL of these in Student.skills
  requiredTrainings?: string[]; // student must have ALL of these as keys in Student.trainings
  gender?: Gender | "any"; // "any" (or omitted) = no restriction
}

export type DriveStatus = "upcoming" | "ongoing" | "completed" | "cancelled";
export type DriveType = "full_time" | "internship"; // add now, use later

export interface DriveRound {
  roundId: string;
  name: string; // "Aptitude", "GD", "Technical Interview", "HR"
  date?: Timestamp;
  status: "pending" | "in_progress" | "completed";
}

// A named role a company is hiring for within one drive — jobRole/ctc on
// Drive itself stay as the primary/first role (so every existing single-role
// drive and every display site that just reads drive.jobRole/drive.ctc
// keeps working unchanged); `roles` holds ADDITIONAL roles beyond that one.
// See driveRolesLib.ts for the helpers that present both uniformly.
export interface DriveRole {
  roleId: string;
  jobRole: string;
  ctc: number; // LPA
}

export interface Drive {
  driveId: string;
  campusId: CampusId;
  companyName: string;
  jobRole: string;
  type: DriveType;
  ctc: number; // LPA
  jdUrl?: string; // Google Drive share link
  // Additional roles beyond the primary jobRole/ctc above — set when a
  // company is hiring for more than one role/package in the same drive
  // visit. Empty/absent means single-role, the common case.
  roles?: DriveRole[];
  eligibility: EligibilityCriteria;
  // When set (non-empty), overrides eligibility entirely for this drive —
  // only these exact students can see/apply, regardless of CGPA/department/
  // batch criteria. For companies that hand-pick a small headcount rather
  // than opening the drive to everyone who qualifies (see checkEligibility
  // in driveActions.ts).
  selectedStudentIds?: string[];
  rounds: DriveRound[];
  driveDate: Timestamp;
  status: DriveStatus;
  createdBy: string; // coordinator uid
  createdAt: Timestamp;
}

// ----------------------------------------------------------------------------
// 4. Applications
// ----------------------------------------------------------------------------

export type ApplicationStatus =
  | "applied"
  | "shortlisted"
  | "in_round"
  | "selected"
  | "rejected"
  | "withdrawn";

export interface Application {
  applicationId: string;
  studentId: string;
  department: Department; // denormalized from the applicant, for department-scoped rules — see DB_NODES doc comment
  driveId: string;
  // Which of the drive's roles this application is for — absent/undefined
  // means the drive's primary jobRole/ctc; a value here matches a
  // DriveRole.roleId in Drive.roles. Only meaningful when the drive has
  // more than one role (see Drive.roles).
  roleId?: string;
  status: ApplicationStatus;
  currentRoundId?: string;
  resumeUrlSnapshot: string; // resume as it was at time of applying
  appliedAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// 5. Offers & Joining
// ----------------------------------------------------------------------------

export type OfferStatus = "received" | "verified" | "accepted" | "declined";

export interface Offer {
  offerId: string;
  studentId: string;
  department: Department; // denormalized from the student, for department-scoped rules — see DB_NODES doc comment
  driveId: string;
  ctc: number;
  designation: string;
  offerLetterUrl: string; // Google Drive share link
  status: OfferStatus;
  verifiedBy?: string; // coordinator uid
  joiningDate?: Timestamp;
  createdAt: Timestamp;
}

export interface JoiningReport {
  reportId: string;
  studentId: string;
  department: Department; // denormalized from the student, for department-scoped rules — see DB_NODES doc comment
  offerId: string;
  joiningDate: Timestamp;
  proofUrl: string; // joining letter / ID card scan — Google Drive share link
  status: "pending" | "submitted" | "verified" | "not_joined";
  submittedAt?: Timestamp;
}

// ----------------------------------------------------------------------------
// 6. Notifications
// ----------------------------------------------------------------------------

export type NotificationAudienceType =
  | "all"
  | "department"
  | "eligible_list"
  | "selected_students"
  | "custom";

export interface AppNotification {
  notificationId: string;
  title: string;
  body: string;
  audience: {
    type: NotificationAudienceType;
    filterValue?: string; // e.g. department code, or driveId
  };
  sentBy: string; // uid
  sentAt: Timestamp;
  readBy: string[]; // uids that opened it
}

// ----------------------------------------------------------------------------
// 7. Training & Attendance
// ----------------------------------------------------------------------------

export type SkillTrack =
  | "aptitude"
  | "coding"
  | "communication"
  | "group_discussion"
  | "domain_technical"
  | "other";

export interface TrainingBatch {
  batchId: string;
  name: string;
  skillTrack: SkillTrack;
  trainerId: string; // faculty_mentor uid, or external trainer id
  department: Department;
  batchYear: number;
  studentIds: string[];
  createdAt: Timestamp;
}

export interface TrainingSession {
  sessionId: string;
  batchId: string;
  date: Timestamp;
  topic: string;
  startTime: string; // "10:00"
  endTime: string; // "12:00"
  mode: "offline" | "online";
  qrToken?: string; // current self-check-in code; regenerated each time check-in opens
  checkInOpenUntil?: Timestamp; // qrToken is only valid up to this moment (server-checked)
}

export type AttendanceStatus = "present" | "absent" | "late";
export type AttendanceMethod = "manual" | "qr" | "geo";

export interface AttendanceRecord {
  attendanceId: string;
  sessionId: string;
  studentId: string;
  department: Department; // denormalized from the student, for department-scoped rules — see DB_NODES doc comment
  status: AttendanceStatus;
  markedBy: string; // trainer uid, or the student's own uid for a self-check-in
  markedAt: Timestamp;
  method: AttendanceMethod;
  checkInToken?: string; // the code submitted for a self-check-in — audit trail
}

// ----------------------------------------------------------------------------
// 8. Mentor Progress Tracking
// ----------------------------------------------------------------------------

export interface MentorMapping {
  mappingId: string;
  facultyId: string;
  studentId: string;
  department: Department;
  assignedAt: Timestamp;
}

/** A faculty_mentor's real job at a small college: ~10-12 assigned mentees
 * (via MentorMapping above), regular follow-up across academics, placement,
 * attendance, activities, and parent contact — not just the placement-tool
 * actions below (mock interviews etc). This is a running, timestamped log per
 * mentee a mentor adds to over the semester. "Activities" deliberately has no
 * dedicated field — it's just another category a mentor writes a note under,
 * not structured data (varies too much per student to standardize). */
export type FollowUpCategory =
  | "academics"
  | "placement"
  | "attendance"
  | "activities"
  | "personal"
  | "parent_communication";

export type ParentContactMode = "call" | "meeting" | "message";

export interface MenteeFollowUp {
  followUpId: string;
  studentId: string;
  department: Department; // denormalized from the student, for department-scoped rules — see DB_NODES doc comment
  mentorId: string;
  category: FollowUpCategory;
  note: string;
  parentContactMode?: ParentContactMode; // only set when category === "parent_communication"
  nextMeetingDate?: Timestamp; // optional — the most recent entry with this set is "the" next meeting for the mentee
  createdAt: Timestamp;
}

/** A student's *general* mentor (MentorMapping) and who's prepping them for
 * one specific upcoming drive are different questions — a mock interview
 * from months ago for a different company shouldn't count as "ready" for
 * next week's drive. This is that per-drive assignment: coordinator assigns
 * each eligible student (from the drive's Eligibility List) to a mentor for
 * targeted prep, and readiness is tracked via MockInterview.driveId below. */
export interface DrivePrepAssignment {
  assignmentId: string;
  driveId: string;
  studentId: string;
  department: Department; // denormalized from the student, for department-scoped rules — see DB_NODES doc comment
  mentorId: string;
  assignedBy: string; // coordinator/hod uid
  assignedAt: Timestamp;
}

export type MockInterviewType = "technical" | "hr" | "group_discussion";

export interface MockInterview {
  interviewId: string;
  studentId: string;
  department: Department; // denormalized from the student, for department-scoped rules — see DB_NODES doc comment
  mentorId: string;
  date: Timestamp;
  type: MockInterviewType;
  scores: {
    communication: number; // 0-10
    technical: number; // 0-10
    confidence: number; // 0-10
  };
  feedback: string;
  recordingUrl?: string; // Drive/YouTube unlisted link
  driveId?: string; // set when this session was prep for a specific drive — see DrivePrepAssignment
}

/** A dated mock-interview drive (e.g. "Infosys Mock", 3-8-26 to 25-8-26) a
 * coordinator sets up ahead of a company visit — MockEvaluation records
 * below are the daily per-mentee entries logged against it. Deliberately no
 * roster field: who's "in" the module is just whichever students have a
 * mentor assigned (MentorMapping) in this department, so there's nothing to
 * keep in sync — a mentor evaluates their own mentees against whatever
 * module is currently active for their department (today between
 * startDate/endDate). */
export interface MockInterviewModule {
  moduleId: string;
  name: string;
  department: Department;
  startDate: Timestamp;
  endDate: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
}

export type MockEvalRating =
  | "excellent"
  | "very_good"
  | "good"
  | "average"
  | "need_to_improve"
  | "poor"
  | "absent";

/** One mentor's evaluation of one mentee on one calendar day of a
 * MockInterviewModule. evaluationId = `${moduleId}_${studentId}_{YYYY-MM-DD}`
 * — deliberately deterministic (not a push id) so re-logging the same
 * mentee on the same day overwrites that day's entry instead of creating a
 * duplicate, letting a mentor fix a mistake without a separate delete step. */
export interface MockEvaluation {
  evaluationId: string;
  moduleId: string;
  studentId: string;
  department: Department; // denormalized from the student, for department-scoped rules — see DB_NODES doc comment
  mentorId: string;
  date: Timestamp; // midnight-normalized day this entry is for
  selfIntroduction: MockEvalRating;
  projectExplanation: MockEvalRating;
  technicalOopJava: MockEvalRating;
  technicalCnOs: MockEvalRating;
  technicalDbmsSql: MockEvalRating;
  communication: MockEvalRating;
  hr: MockEvalRating;
  selfConfidence: MockEvalRating;
  overallPerformance: MockEvalRating;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ResumeReviewStatus = "not_reviewed" | "needs_revision" | "approved";

export interface ResumeReview {
  reviewId: string;
  studentId: string;
  department: Department; // denormalized from the student, for department-scoped rules — see DB_NODES doc comment
  mentorId: string;
  version: number;
  fileUrl: string; // Google Drive share link
  status: ResumeReviewStatus;
  comments: string[];
  reviewedAt?: Timestamp;
}

export type SkillAssessmentType = "technical" | "soft_skill" | "certification";
export type SkillAssessmentSource = "manual" | "hackerrank" | "codechef" | "other";

export interface SkillAssessment {
  assessmentId: string;
  studentId: string;
  department: Department; // denormalized from the student, for department-scoped rules — see DB_NODES doc comment
  type: SkillAssessmentType;
  source: SkillAssessmentSource;
  score: number; // 0-100 normalized
  date: Timestamp;
  notes?: string;
}

/** Computed, denormalized readiness snapshot — recalculated client-side for
 * now whenever an underlying signal (attendance, mock score, resume status,
 * skill score) changes (see apps/web/src/lib/computeReadiness.ts). Move this
 * to a Cloud Function trigger later once billing is enabled — same shape,
 * just a more reliable/tamper-proof place to run the calculation. */
export interface ReadinessScore {
  studentId: string;
  attendancePct: number; // 0-100
  mockInterviewAvg: number; // 0-10
  resumeStatus: ResumeReviewStatus;
  skillScoreAvg: number; // 0-100
  cgpa: number;
  pri: number; // 0-100 composite — Placement Readiness Index
  priBand: "green" | "amber" | "red";
  computedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// 9. Alumni (passed-out batches)
// ----------------------------------------------------------------------------

/** Deliberately a separate, lighter-weight record from Student — alumni
 * don't have a Firebase Auth account (they don't log into this app) and
 * aren't part of any live drive/training workflow, just a historical
 * archive the coordinator maintains by hand. Lives in its own `alumni` node
 * rather than `students` so it never gets mixed into "current students"
 * queries (drive eligibility, batch rosters, offer pickers, etc). */
export type AlumniPlacementStatus = "placed" | "unplaced" | "entrepreneur" | "higher_studies";

export interface AlumniRecord {
  alumniId: string;
  rollNo: string;
  name: string;
  department: Department;
  batchYear: number; // graduating year (already passed)
  cgpa?: number;
  placementStatus: AlumniPlacementStatus;
  companyName?: string;
  designation?: string;
  ctc?: number;
  offerLetterUrl?: string; // Google Drive share link, same pattern as elsewhere
  higherStudiesDetails?: string; // e.g. "MS Computer Science, ASU"
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  addedBy: string; // staff uid
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// 10. Realtime Database top-level node name constants
// (import these instead of hardcoding string literals in queries)
// ----------------------------------------------------------------------------

/** RTDB security rules can only check *data that already exists* against
 * auth.uid — they can't prove ownership of a record that hasn't been created
 * yet, so a plain `data.child('studentId').val() === auth.uid` read rule
 * denies access to a not-yet-existing record instead of returning "not
 * found". The fix used throughout this schema: give these collections a
 * deterministic id that *encodes* the owning student, so ownership can be
 * checked from the path instead of the data. Follow these conventions when
 * writing to these nodes from any app (web, mobile, coordinator tooling):
 *   - applications/{id}:    id = `${studentUid}_${driveId}`
 *   - offers/{id}:          id = `${studentUid}_${driveId}`
 *   - joiningReports/{id}:  id = the offerId it belongs to (1:1 with the offer)
 *
 * `attendance` is the one exception — it's *nested*, not a flat composite id:
 * attendance/{sessionId}/{studentUid}. Self-check-in (see TrainingSession.qrToken)
 * needs the rule to look up trainingSessions/{sessionId}/qrToken, and a single
 * flat wildcard can't be substring-parsed back into its sessionId part — two
 * wildcards on a nested path solve that directly.
 *
 * Collections that are many-per-student with no natural composite key
 * (mockInterviews, resumeReviews, skillAssessments, mentorMapping) instead
 * use a denormalized index at studentIndex/{studentUid}/{collectionName}/{recordId} = true.
 * Whoever creates one of those records (staff/mentor tooling) must also
 * write the matching studentIndex entry in the same update() call — that's
 * how a student discovers "which record ids are mine" without a collection
 * scan the rules would otherwise deny.
 *
 * `students` is the one collection with genuinely department-scoped read
 * access (coordinator/hod/faculty_mentor see only their own department), so
 * instead of a root grant it has departmentIndex/{department}/{studentUid} =
 * true, written by the student at profile-completion time, letting
 * dept-scoped staff enumerate their department's student uids and then read
 * each one individually (already permitted).
 *
 * `mentorIndex/{department}/{mentorUid} = true` is the same pattern applied
 * to staff: coordinator/hod need to list faculty_mentor accounts in their
 * own department to build a mentor picker (e.g. assigning drive prep,
 * below) — written when a staff account is created with role
 * "faculty_mentor" (see createStaffAccount in apps/web/src/lib/staffAuthActions.ts).
 *
 * The same department-scoping applies to every other staff-visible
 * collection tied to a specific student (applications, offers,
 * joiningReports, attendance, mentorMapping, mockInterviews, resumeReviews,
 * skillAssessments, drivePrepAssignments) — a dept-scoped role (hod/
 * coordinator/faculty_mentor) may only read/write records for students in
 * their own department; institution roles (dean/principal/cpo/admin) still
 * see everything. Each of these records now carries a denormalized
 * `department` field (copied from the student at write time) so the rule can
 * check `data.child('department').val() === myDept` without an extra
 * cross-reference, and each has a matching {collection}DeptIndex/{department}/
 * {recordId} = true node (same shape as departmentIndex/mentorIndex) so
 * dept-scoped staff can enumerate "which record ids are in my department"
 * instead of only fetching one known id at a time — the same problem
 * departmentIndex solves for students, applied uniformly here. Whoever
 * creates one of these records must write the matching DeptIndex entry in
 * the same update() call.
 *
 * Two deliberate simplifications, both because drives can span multiple
 * departments (Drive.eligibility.departments) while these records are scoped
 * by a single department each:
 *   - A dept-scoped coordinator/hod reviewing a multi-department drive they
 *     created only sees their own department's applicants/offers inline —
 *     institution roles see the full picture. Properly supporting "see every
 *     department for a drive I created" would need restructuring
 *     applications/offers to be nested by driveId, which touches the core
 *     apply/offer flow — judged not worth the regression risk for now.
 *   - readinessScores is department-scoped in principle but isn't wired up
 *     anywhere yet (no read or write site exists in the app — see the
 *     ReadinessScore comment above), so it's skipped from this pass; revisit
 *     if/when it's actually built.
 *
 * `drivePrepAssignments` records "who's prepping which student for which
 * upcoming drive" — deliberately separate from the general MentorMapping,
 * since a student's regular mentor and who's doing *targeted* prep for one
 * specific drive are different questions. Readiness is then just: does a
 * MockInterview exist with a matching driveId for that student?
 *
 * `menteeFollowUps` follows the same department-scoped pattern as the rest,
 * but is deliberately NOT student-readable (unlike mockInterviews/
 * resumeReviews/skillAssessments, which are written *for* the student) —
 * these are a mentor's own working notes, including parent-communication
 * summaries, not feedback meant to be shown back to the student.
 */
export const DB_NODES = {
  users: "users",
  students: "students",
  drives: "drives",
  applications: "applications",
  applicationsDeptIndex: "applicationsDeptIndex",
  offers: "offers",
  offersDeptIndex: "offersDeptIndex",
  joiningReports: "joiningReports",
  joiningReportsDeptIndex: "joiningReportsDeptIndex",
  notifications: "notifications",
  trainingBatches: "trainingBatches",
  trainingSessions: "trainingSessions",
  attendance: "attendance",
  attendanceDeptIndex: "attendanceDeptIndex",
  mentorMapping: "mentorMapping",
  mentorMappingDeptIndex: "mentorMappingDeptIndex",
  mockInterviews: "mockInterviews",
  mockInterviewsDeptIndex: "mockInterviewsDeptIndex",
  mockInterviewModules: "mockInterviewModules",
  mockInterviewModulesDeptIndex: "mockInterviewModulesDeptIndex",
  mockEvaluations: "mockEvaluations",
  mockEvaluationsDeptIndex: "mockEvaluationsDeptIndex",
  resumeReviews: "resumeReviews",
  resumeReviewsDeptIndex: "resumeReviewsDeptIndex",
  skillAssessments: "skillAssessments",
  skillAssessmentsDeptIndex: "skillAssessmentsDeptIndex",
  readinessScores: "readinessScores",
  studentIndex: "studentIndex",
  departmentIndex: "departmentIndex",
  alumni: "alumni",
  mentorIndex: "mentorIndex",
  drivePrepAssignments: "drivePrepAssignments",
  drivePrepAssignmentsDeptIndex: "drivePrepAssignmentsDeptIndex",
  menteeFollowUps: "menteeFollowUps",
  menteeFollowUpsDeptIndex: "menteeFollowUpsDeptIndex",
} as const;
