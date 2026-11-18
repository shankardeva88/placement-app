import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayoutRoute } from "./components/AppLayoutRoute";
import { StaffLayoutRoute } from "./components/StaffLayoutRoute";
import { RootRedirect } from "./components/RootRedirect";
import { ToastProvider } from "./components/ui/Toast";
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Drives = lazy(() => import("./pages/Drives"));
const AcademicRecord = lazy(() => import("./pages/AcademicRecord"));
const PersonalDetails = lazy(() => import("./pages/PersonalDetails"));
const Offers = lazy(() => import("./pages/Offers"));
const Internships = lazy(() => import("./pages/Internships"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Training = lazy(() => import("./pages/Training"));
const MentorProgress = lazy(() => import("./pages/MentorProgress"));
const MockPerformance = lazy(() => import("./pages/MockPerformance"));
const CheckIn = lazy(() => import("./pages/CheckIn"));
const StaffDashboard = lazy(() => import("./pages/staff/StaffDashboard"));
const StaffDrives = lazy(() => import("./pages/staff/Drives"));
const FacultyMentorDrives = lazy(() => import("./pages/staff/FacultyMentorDrives"));
const FacultyMentorInternships = lazy(() => import("./pages/staff/FacultyMentorInternships"));
const MenteeDriveStatus = lazy(() => import("./pages/staff/MenteeDriveStatus"));
const DriveApplicants = lazy(() => import("./pages/staff/DriveApplicants"));
const DriveEligibility = lazy(() => import("./pages/staff/DriveEligibility"));
const Students = lazy(() => import("./pages/staff/Students"));
const BulkImportStudents = lazy(() => import("./pages/staff/BulkImportStudents"));
const BulkUpdateStudents = lazy(() => import("./pages/staff/BulkUpdateStudents"));
const ImportTrainings = lazy(() => import("./pages/staff/ImportTrainings"));
const StudentDetail = lazy(() => import("./pages/staff/StudentDetail"));
const StaffOffers = lazy(() => import("./pages/staff/Offers"));
const StaffInternships = lazy(() => import("./pages/staff/Internships"));
const StaffNotifications = lazy(() => import("./pages/staff/Notifications"));
const StaffTraining = lazy(() => import("./pages/staff/Training"));
const FacultyMentorTraining = lazy(() => import("./pages/staff/FacultyMentorTraining"));
const AttendanceReport = lazy(() => import("./pages/staff/AttendanceReport"));
const MentorTools = lazy(() => import("./pages/staff/MentorTools"));
const MenteeInfo = lazy(() => import("./pages/staff/MenteeInfo"));
const MockEvaluations = lazy(() => import("./pages/staff/MockEvaluations"));
const ManageStaff = lazy(() => import("./pages/staff/ManageStaff"));
const Alumni = lazy(() => import("./pages/staff/Alumni"));
const ReportsHome = lazy(() => import("./pages/staff/reports/ReportsHome"));
const StudentMasterReport = lazy(() => import("./pages/staff/reports/StudentMasterReport"));
const FullStudentReport = lazy(() => import("./pages/staff/reports/FullStudentReport"));
const TrainingReport = lazy(() => import("./pages/staff/reports/TrainingReport"));
const AssessmentReport = lazy(() => import("./pages/staff/reports/AssessmentReport"));
const CertificationReport = lazy(() => import("./pages/staff/reports/CertificationReport"));
const PlacementReport = lazy(() => import("./pages/staff/reports/PlacementReport"));
const OffersInternshipsReport = lazy(() => import("./pages/staff/reports/OffersInternshipsReport"));
const DriveSummaryReport = lazy(() => import("./pages/staff/reports/DriveSummaryReport"));
const DriveStudentWiseReport = lazy(() => import("./pages/staff/reports/DriveStudentWiseReport"));
const MentorWiseReport = lazy(() => import("./pages/staff/reports/MentorWiseReport"));
const AlumniReport = lazy(() => import("./pages/staff/reports/AlumniReport"));
const MenteeRosterReport = lazy(() => import("./pages/staff/reports/MenteeRosterReport"));
const FollowUpLogReport = lazy(() => import("./pages/staff/reports/FollowUpLogReport"));
const MockInterviewReport = lazy(() => import("./pages/staff/reports/MockInterviewReport"));
const MockInterviewAnalytics = lazy(() => import("./pages/staff/reports/MockInterviewAnalytics"));
const ResumeReviewReport = lazy(() => import("./pages/staff/reports/ResumeReviewReport"));
const SkillAssessmentReport = lazy(() => import("./pages/staff/reports/SkillAssessmentReport"));
const MentorReportsHome = lazy(() => import("./pages/staff/reports/MentorReportsHome"));
const MenteeMasterReport = lazy(() => import("./pages/staff/reports/MenteeMasterReport"));
const MenteeFullReport = lazy(() => import("./pages/staff/reports/MenteeFullReport"));
const MenteeOffersInternshipsReport = lazy(() => import("./pages/staff/reports/MenteeOffersInternshipsReport"));
const MenteeTrainingReport = lazy(() => import("./pages/staff/reports/MenteeTrainingReport"));
const MenteeAssessmentReport = lazy(() => import("./pages/staff/reports/MenteeAssessmentReport"));
const MenteeDriveSummaryReport = lazy(() => import("./pages/staff/reports/MenteeDriveSummaryReport"));
const MenteeFollowUpReport = lazy(() => import("./pages/staff/reports/MenteeFollowUpReport"));
const MenteeFollowUpLogReport = lazy(() => import("./pages/staff/reports/MenteeFollowUpLogReport"));
const MenteeMockEvaluationReport = lazy(() => import("./pages/staff/reports/MenteeMockEvaluationReport"));

// Every route above is its own lazy-loaded chunk now instead of one ~1.3MB
// bundle containing every staff report/page regardless of which one a
// given login actually visits — that single bundle was the main reason the
// app felt slow to load. This only shows while THIS route's chunk is still
// downloading (first visit to it, or after a deploy); every layout/shell
// chrome around it (sidebar, header) is unaffected since those aren't lazy.
function PageLoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center text-sm text-slate-400">
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/profile-setup"
            element={
              <ProtectedRoute>
                <ProfileSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/change-password"
            element={
              <AppLayoutRoute>
                <ChangePassword />
              </AppLayoutRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <AppLayoutRoute>
                <Dashboard />
              </AppLayoutRoute>
            }
          />
          <Route
            path="/drives"
            element={
              <AppLayoutRoute>
                <Drives />
              </AppLayoutRoute>
            }
          />
          <Route
            path="/academic-record"
            element={
              <AppLayoutRoute>
                <AcademicRecord />
              </AppLayoutRoute>
            }
          />
          <Route
            path="/personal-details"
            element={
              <AppLayoutRoute>
                <PersonalDetails />
              </AppLayoutRoute>
            }
          />
          <Route
            path="/offers"
            element={
              <AppLayoutRoute>
                <Offers />
              </AppLayoutRoute>
            }
          />
          <Route
            path="/internships"
            element={
              <AppLayoutRoute>
                <Internships />
              </AppLayoutRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <AppLayoutRoute>
                <Notifications />
              </AppLayoutRoute>
            }
          />
          <Route
            path="/training"
            element={
              <AppLayoutRoute>
                <Training />
              </AppLayoutRoute>
            }
          />
          <Route
            path="/mentor-progress"
            element={
              <AppLayoutRoute>
                <MentorProgress />
              </AppLayoutRoute>
            }
          />
          <Route
            path="/mock-performance"
            element={
              <AppLayoutRoute>
                <MockPerformance />
              </AppLayoutRoute>
            }
          />
          <Route
            path="/checkin/:sessionId/:token"
            element={
              <ProtectedRoute>
                <CheckIn />
              </ProtectedRoute>
            }
          />

          <Route
            path="/staff/dashboard"
            element={
              <StaffLayoutRoute>
                <StaffDashboard />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/drives"
            element={
              <StaffLayoutRoute>
                <StaffDrives />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/mentor-drives"
            element={
              <StaffLayoutRoute>
                <FacultyMentorDrives />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/mentor-internships"
            element={
              <StaffLayoutRoute>
                <FacultyMentorInternships />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/mentee-drive-status"
            element={
              <StaffLayoutRoute>
                <MenteeDriveStatus />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/drives/:driveId"
            element={
              <StaffLayoutRoute>
                <DriveApplicants />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/drives/:driveId/eligibility"
            element={
              <StaffLayoutRoute>
                <DriveEligibility />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/students"
            element={
              <StaffLayoutRoute>
                <Students />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/bulk-import-students"
            element={
              <StaffLayoutRoute>
                <BulkImportStudents />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/bulk-update-students"
            element={
              <StaffLayoutRoute>
                <BulkUpdateStudents />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/import-trainings"
            element={
              <StaffLayoutRoute>
                <ImportTrainings />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/students/:uid"
            element={
              <StaffLayoutRoute>
                <StudentDetail />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/offers"
            element={
              <StaffLayoutRoute>
                <StaffOffers />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/internships"
            element={
              <StaffLayoutRoute>
                <StaffInternships />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/notifications"
            element={
              <StaffLayoutRoute>
                <StaffNotifications />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/change-password"
            element={
              <StaffLayoutRoute>
                <ChangePassword />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/training"
            element={
              <StaffLayoutRoute>
                <StaffTraining />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/mentor-training"
            element={
              <StaffLayoutRoute>
                <FacultyMentorTraining />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/attendance-report"
            element={
              <StaffLayoutRoute>
                <AttendanceReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/mentor-tools"
            element={
              <StaffLayoutRoute>
                <MentorTools />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/mentee-info"
            element={
              <StaffLayoutRoute>
                <MenteeInfo />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/mock-evaluations"
            element={
              <StaffLayoutRoute>
                <MockEvaluations />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/manage-staff"
            element={
              <StaffLayoutRoute>
                <ManageStaff />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/alumni"
            element={
              <StaffLayoutRoute>
                <Alumni />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports"
            element={
              <StaffLayoutRoute>
                <ReportsHome />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports/students"
            element={
              <StaffLayoutRoute>
                <StudentMasterReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports/students-full"
            element={
              <StaffLayoutRoute>
                <FullStudentReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports/training"
            element={
              <StaffLayoutRoute>
                <TrainingReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports/assessments"
            element={
              <StaffLayoutRoute>
                <AssessmentReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports/certifications"
            element={
              <StaffLayoutRoute>
                <CertificationReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports/placements"
            element={
              <StaffLayoutRoute>
                <PlacementReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports/offers-internships"
            element={
              <StaffLayoutRoute>
                <OffersInternshipsReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports/drives"
            element={
              <StaffLayoutRoute>
                <DriveSummaryReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports/drives-student-wise"
            element={
              <StaffLayoutRoute>
                <DriveStudentWiseReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports/mentors"
            element={
              <StaffLayoutRoute>
                <MentorWiseReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports/alumni"
            element={
              <StaffLayoutRoute>
                <AlumniReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports/mentee-roster"
            element={
              <StaffLayoutRoute>
                <MenteeRosterReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports/follow-up-log"
            element={
              <StaffLayoutRoute>
                <FollowUpLogReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports/mock-interviews"
            element={
              <StaffLayoutRoute>
                <MockInterviewReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports/mock-interview-analytics"
            element={
              <StaffLayoutRoute>
                <MockInterviewAnalytics />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports/resume-reviews"
            element={
              <StaffLayoutRoute>
                <ResumeReviewReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/reports/skill-assessments"
            element={
              <StaffLayoutRoute>
                <SkillAssessmentReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/mentor-reports"
            element={
              <StaffLayoutRoute>
                <MentorReportsHome />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/mentor-reports/mentees"
            element={
              <StaffLayoutRoute>
                <MenteeMasterReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/mentor-reports/mentees-full"
            element={
              <StaffLayoutRoute>
                <MenteeFullReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/mentor-reports/offers-internships"
            element={
              <StaffLayoutRoute>
                <MenteeOffersInternshipsReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/mentor-reports/training"
            element={
              <StaffLayoutRoute>
                <MenteeTrainingReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/mentor-reports/assessments"
            element={
              <StaffLayoutRoute>
                <MenteeAssessmentReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/mentor-reports/drives"
            element={
              <StaffLayoutRoute>
                <MenteeDriveSummaryReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/mentor-reports/follow-ups"
            element={
              <StaffLayoutRoute>
                <MenteeFollowUpReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/mentor-reports/follow-up-log"
            element={
              <StaffLayoutRoute>
                <MenteeFollowUpLogReport />
              </StaffLayoutRoute>
            }
          />
          <Route
            path="/staff/mentor-reports/mock-evaluations"
            element={
              <StaffLayoutRoute>
                <MenteeMockEvaluationReport />
              </StaffLayoutRoute>
            }
          />
          </Routes>
        </Suspense>
      </AuthProvider>
    </ToastProvider>
  );
}
