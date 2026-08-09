import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayoutRoute } from "./components/AppLayoutRoute";
import { StaffLayoutRoute } from "./components/StaffLayoutRoute";
import { RootRedirect } from "./components/RootRedirect";
import { ToastProvider } from "./components/ui/Toast";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProfileSetup from "./pages/ProfileSetup";
import Dashboard from "./pages/Dashboard";
import Drives from "./pages/Drives";
import AcademicRecord from "./pages/AcademicRecord";
import PersonalDetails from "./pages/PersonalDetails";
import Offers from "./pages/Offers";
import Notifications from "./pages/Notifications";
import Training from "./pages/Training";
import MentorProgress from "./pages/MentorProgress";
import MockPerformance from "./pages/MockPerformance";
import CheckIn from "./pages/CheckIn";
import StaffDashboard from "./pages/staff/StaffDashboard";
import StaffDrives from "./pages/staff/Drives";
import FacultyMentorDrives from "./pages/staff/FacultyMentorDrives";
import DriveApplicants from "./pages/staff/DriveApplicants";
import DriveEligibility from "./pages/staff/DriveEligibility";
import Students from "./pages/staff/Students";
import BulkImportStudents from "./pages/staff/BulkImportStudents";
import ImportTrainings from "./pages/staff/ImportTrainings";
import StudentDetail from "./pages/staff/StudentDetail";
import StaffOffers from "./pages/staff/Offers";
import StaffNotifications from "./pages/staff/Notifications";
import StaffTraining from "./pages/staff/Training";
import FacultyMentorTraining from "./pages/staff/FacultyMentorTraining";
import AttendanceReport from "./pages/staff/AttendanceReport";
import MentorTools from "./pages/staff/MentorTools";
import MenteeInfo from "./pages/staff/MenteeInfo";
import MockEvaluations from "./pages/staff/MockEvaluations";
import ManageStaff from "./pages/staff/ManageStaff";
import Alumni from "./pages/staff/Alumni";
import ReportsHome from "./pages/staff/reports/ReportsHome";
import StudentMasterReport from "./pages/staff/reports/StudentMasterReport";
import PlacementReport from "./pages/staff/reports/PlacementReport";
import DriveSummaryReport from "./pages/staff/reports/DriveSummaryReport";
import MentorWiseReport from "./pages/staff/reports/MentorWiseReport";
import MenteeRosterReport from "./pages/staff/reports/MenteeRosterReport";
import ResumeReviewReport from "./pages/staff/reports/ResumeReviewReport";
import SkillAssessmentReport from "./pages/staff/reports/SkillAssessmentReport";
import MentorReportsHome from "./pages/staff/reports/MentorReportsHome";
import MenteeMasterReport from "./pages/staff/reports/MenteeMasterReport";
import MenteeFollowUpReport from "./pages/staff/reports/MenteeFollowUpReport";
import MenteeMockEvaluationReport from "./pages/staff/reports/MenteeMockEvaluationReport";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/profile-setup"
            element={
              <ProtectedRoute>
                <ProfileSetup />
              </ProtectedRoute>
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
            path="/staff/notifications"
            element={
              <StaffLayoutRoute>
                <StaffNotifications />
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
            path="/staff/reports/placements"
            element={
              <StaffLayoutRoute>
                <PlacementReport />
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
            path="/staff/reports/mentors"
            element={
              <StaffLayoutRoute>
                <MentorWiseReport />
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
            path="/staff/mentor-reports/follow-ups"
            element={
              <StaffLayoutRoute>
                <MenteeFollowUpReport />
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
      </AuthProvider>
    </ToastProvider>
  );
}
