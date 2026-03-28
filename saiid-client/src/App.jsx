import React, { Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ToastProvider from './context/ToastContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import PrivateRoute from './private/privateRoute.jsx';
import SkeletonLoader from './components/skeleton';
import FormSkeleton from './components/formSkeleton.jsx'; // Assuming this is another skeleton component

const MainOrphan = React.lazy(() => import('./resources/forms/orphan/main.jsx'));
const MainAid = React.lazy(() => import('./resources/forms/aid/main.jsx'));
const MainTeacher = React.lazy(() => import('./resources/forms/school/teacher/main.jsx'))
const MainStudent = React.lazy(() => import('./resources/forms/school/student/main.jsx'))
const MainEmployment = React.lazy(() => import('./resources/forms/employment/main.jsx'));
const MainShelter = React.lazy(() => import('./resources/forms/shelter/main.jsx'));
const MainPatient = React.lazy(() => import('./resources/forms/patient/main.jsx'));
const MainMedical = React.lazy(() => import('./resources/forms/medical/main.jsx'));
const Login = React.lazy(() => import('./resources/auth/login'));
const Logout = React.lazy(() => import('./resources/auth/logout'));
// const Register = React.lazy(() => import('./resources/auth/register'));
const Edit = React.lazy(() => import('./resources/auth/edit'));
// تحميل Base مباشرة (غير lazy) لأنه يُستخدم في كل صفحة ويسبب تأخير
import Base from './resources/layout/base';
const StatisticsIndex = React.lazy(() => import('./resources/admin/statistics/StatisticsIndex.jsx'));
const OrphanStatistics = React.lazy(() => import('./resources/admin/statistics/orphanStatistics.jsx'));
const AidStatistics = React.lazy(() => import('./resources/admin/statistics/aidStatistics.jsx'));
const PatientStatistics = React.lazy(() => import('./resources/admin/statistics/patientStatistics.jsx'));
const ShelterStatistics = React.lazy(() => import('./resources/admin/statistics/shelterStatistics.jsx'));
const IndexOrphans = React.lazy(() => import('./resources/admin/orphan/index.jsx'));
const OrphanGroupings = React.lazy(() => import('./resources/admin/orphan-groupings/advanced.jsx'));
const IndexAids = React.lazy(() => import('./resources/admin/aids/index.jsx'));
const IndexStudents = React.lazy(() => import('./resources/admin/school/student/index.jsx'));
const IndexTeachers = React.lazy(() => import('./resources/admin/school/teacher/index.jsx'));
const IndexEmployments = React.lazy(() => import('./resources/admin/employment/index.jsx'));
const FormControlPanel = React.lazy(() => import('./resources/admin/FormControlPanel.jsx'));
// const IndexShelters = React.lazy(() => import('./resources/admin/shelter/index.jsx'));
const DownloadTemplate = React.lazy(() => import('./resources/forms/shelter/downloadTemplate.jsx'));
const IndexShelters = React.lazy(() => import('./resources/admin/shelter/index.jsx'))
const IndexPatients = React.lazy(() => import('./resources/admin/patient/index.jsx'))
const IndexProjects = React.lazy(() => import('./resources/admin/projects/index.jsx'))
const Index = React.lazy(() => import('./resources/index.jsx'));

// Project Management System
const PMDashboard = React.lazy(() => import('./resources/project-management/dashboard/Dashboard.jsx'));
// ✅ إضافة retry mechanism للـ lazy import لتجنب مشاكل التحميل
const PMProjectsList = React.lazy(() =>
  import('./resources/project-management/projects/ProjectsList.jsx').catch((error) => {
    console.error('Error loading ProjectsList:', error);
    // Retry once after a short delay
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(import('./resources/project-management/projects/ProjectsList.jsx'));
      }, 1000);
    });
  })
);
const PMNewProject = React.lazy(() => import('./resources/project-management/projects/NewProject.jsx'));
const PMEditProject = React.lazy(() => import('./resources/project-management/projects/EditProject.jsx'));
// ✅ إضافة retry mechanism للـ lazy import لتجنب مشاكل التحميل
const PMProjectDetails = React.lazy(() =>
  import('./resources/project-management/projects/ProjectDetails.jsx').catch((error) => {
    console.error('Error loading ProjectDetails:', error);
    // Retry once after a short delay
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(import('./resources/project-management/projects/ProjectDetails.jsx'));
      }, 1000);
    });
  })
);
const PMProjectSupply = React.lazy(() => import('./resources/project-management/projects/ProjectSupply.jsx'));
const PMEditSupply = React.lazy(() => import('./resources/project-management/projects/EditSupply.jsx'));
const PMTeamsManagement = React.lazy(() => import('./resources/project-management/teams/TeamsManagement.jsx'));
const PMCurrenciesManagement = React.lazy(() => import('./resources/project-management/currencies/CurrenciesManagement.jsx'));
const PMSubcategoriesList = React.lazy(() => import('./resources/project-management/subcategories/SubcategoriesList.jsx'));
const PMSubcategoryDetails = React.lazy(() => import('./resources/project-management/subcategories/SubcategoryDetails.jsx'));
const PMSubcategoryForm = React.lazy(() => import('./resources/project-management/subcategories/SubcategoryForm.jsx'));
const PMProjectTypesList = React.lazy(() => import('./resources/project-management/project-types/ProjectTypesList.jsx'));
const PMProjectTypeForm = React.lazy(() => import('./resources/project-management/project-types/ProjectTypeForm.jsx'));
const PMNotifications = React.lazy(() => import('./resources/project-management/notifications/Notifications.jsx'));
const PMUsersManagement = React.lazy(() => import('./resources/project-management/users/UsersManagement.jsx'));
const PMReports = React.lazy(() => import('./resources/project-management/reports/Reports.jsx'));
const PMWarehouse = React.lazy(() => import('./resources/project-management/warehouse/Warehouse.jsx'));
const PMWarehouseForm = React.lazy(() => import('./resources/project-management/warehouse/WarehouseForm.jsx'));
const PMWarehouseDashboard = React.lazy(() => import('./resources/project-management/warehouse/WarehouseDashboard.jsx'));
const PMSurplusDashboard = React.lazy(() => import('./resources/project-management/surplus/SurplusDashboard.jsx'));
const PMSurplusReport = React.lazy(() => import('./resources/project-management/surplus/SurplusReport.jsx'));
const PMSurplusCategories = React.lazy(() => import('./resources/project-management/surplus/SurplusCategories.jsx'));
const PMSurplusCategoryForm = React.lazy(() => import('./resources/project-management/surplus/SurplusCategoryForm.jsx'));
const PMSurplusCategoryDetails = React.lazy(() => import('./resources/project-management/surplus/SurplusCategoryDetails.jsx'));
const PMBeneficiariesStatistics = React.lazy(() => import('./resources/project-management/beneficiaries/BeneficiariesStatistics.jsx'));
const PMBeneficiariesManagement = React.lazy(() => import('./resources/project-management/beneficiaries/BeneficiariesManagement.jsx'));
const PMAdvancedProjectsManagement = React.lazy(() => import('./resources/project-management/projects/AdvancedProjectsManagement.jsx'));
const PMSponsorshipGroups = React.lazy(() => import('./resources/project-management/sponsorship/SponsorshipGroups.jsx'));
const PMSponsorshipItems = React.lazy(() => import('./resources/project-management/sponsorship/SponsorshipItems.jsx'));

// Media Management System
const MediaDashboard = React.lazy(() => import('./resources/media-management/Dashboard.jsx'));
const MediaProjectsList = React.lazy(() => import('./resources/media-management/ProjectsList.jsx'));
const MediaNewProjects = React.lazy(() => import('./resources/media-management/NewProjects.jsx'));
const MediaReports = React.lazy(() => import('./resources/media-management/Reports.jsx'));
const MediaNotifications = React.lazy(() => import('./resources/media-management/Notifications.jsx'));
const MontageProducersManagement = React.lazy(() => import('./resources/media-management/MontageProducersManagement.jsx'));
const MyMontageProjects = React.lazy(() => import('./resources/media-management/MyMontageProjects.jsx'));
const MontageProjectDetails = React.lazy(() => import('./resources/media-management/MontageProjectDetails.jsx'));
const ArchivesList = React.lazy(() => import('./resources/media-management/archives/ArchivesList.jsx'));
const NewArchive = React.lazy(() => import('./resources/media-management/archives/NewArchive.jsx'));
const ArchiveDetails = React.lazy(() => import('./resources/media-management/archives/ArchiveDetails.jsx'));
const EditArchive = React.lazy(() => import('./resources/media-management/archives/EditArchive.jsx'));

// Supervision System
const SupervisionDashboard = React.lazy(() => import('./resources/supervision/Dashboard.jsx'));
const DetailedProjects = React.lazy(() => import('./resources/supervision/DetailedProjects.jsx'));
const FinancialReports = React.lazy(() => import('./resources/supervision/FinancialReports.jsx'));
const MontageProducersStats = React.lazy(() => import('./resources/supervision/MontageProducersStats.jsx'));
const PhotographersStats = React.lazy(() => import('./resources/supervision/PhotographersStats.jsx'));
import SupervisionRoute from './resources/supervision/components/SupervisionRoute.jsx';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/" element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Index /></Suspense> } />
              <Route path="/login" element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Login /></Suspense> } />
              <Route path="/admin" element={ <Navigate to="/project-management/dashboard" replace /> } />
              {/* <Route path="/register" element={<Suspense fallback={<SkeletonLoader width="100%" height="100vh" />}><Register /></Suspense>} /> */ }
              <Route path="/orphan-form" element={ <Suspense fallback={ <FormSkeleton width="100%" height="100vh" /> }><MainOrphan /></Suspense> } />
              <Route path="/aid-form" element={ <Suspense fallback={ <FormSkeleton width="100%" height="100vh" /> }><MainAid /></Suspense> } />
              <Route path="/teacher-form" element={ <Suspense fallback={ <FormSkeleton width="100%" height="100vh" /> }><MainTeacher /></Suspense> } />
              <Route path="/patient-form" element={ <Suspense fallback={ <FormSkeleton width="100%" height="100vh" /> }><MainPatient /></Suspense> } />
              {/* <Route path="/teacher-form" element={<Suspense fallback={<FormSkeleton width="100%" height="100vh" />}><MainTeacher /></Suspense>} /> */ }
              <Route path="/employment-form" element={ <Suspense fallback={ <FormSkeleton width="100%" height="100vh" /> }><MainEmployment /></Suspense> } />
              <Route path="/student-form" element={ <Suspense fallback={ <FormSkeleton width="100%" height="100vh" /> }><MainStudent /></Suspense> } />
              <Route path="/shelter-form" element={ <Suspense fallback={ <FormSkeleton width="100%" height="100vh" /> }><MainShelter /></Suspense> } />
              <Route path="/medical-treatment-form" element={ <Suspense fallback={ <FormSkeleton width="100%" height="100vh" /> }><MainMedical /></Suspense> } />
              <Route path="/shelter-template" element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><DownloadTemplate /></Suspense> } />
              {/* <Route path="/form-closed" element={<Suspense fallback={<FormSkeleton width="100%" height="100vh" />}><FormClosed /></Suspense>} /> */ }
              <Route path="/statistics" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><StatisticsIndex /></Base></Suspense> } /> } />
              <Route path="/statistics/orphans-statistics" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><OrphanStatistics /></Base></Suspense> } /> } />
              <Route path="/statistics/aids-statistics" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><AidStatistics /></Base></Suspense> } /> } />
              <Route path="/statistics/patient-statistics" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PatientStatistics /></Base></Suspense> } /> } />
              <Route path="/statistics/shelter-statistics" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><ShelterStatistics /></Base></Suspense> } /> } />
              <Route path="/orphans" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><IndexOrphans /></Base></Suspense> } /> } />
              <Route path="/orphan-groupings" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><OrphanGroupings /></Base></Suspense> } /> } />
              <Route path="/aids" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><IndexAids /></Base></Suspense> } /> } />
              <Route path="/students" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><IndexStudents /></Base></Suspense> } /> } />
              <Route path="/teachers" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><IndexTeachers /></Base></Suspense> } /> } />
              <Route path="/employments" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><IndexEmployments /></Base></Suspense> } /> } />
              <Route path="/shelters" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><IndexShelters /></Base></Suspense> } /> } />
              <Route path="/patients" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><IndexPatients /></Base></Suspense> } /> } />
              <Route path="/projects" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><IndexProjects /></Base></Suspense> } /> } />
              <Route path="/forms-control" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><FormControlPanel /></Base></Suspense> } /> } />
              <Route path="/edit/:userId" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><Edit /></Base></Suspense> } /> } />

              {/* Project Management System Routes */ }
              <Route path="/project-management/dashboard" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMDashboard /></Base></Suspense> } /> } />
              <Route path="/project-management/projects" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMProjectsList /></Base></Suspense> } /> } />
              <Route path="/project-management/detailed-projects" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><DetailedProjects /></Base></Suspense> } /> } />
              <Route path="/project-management/projects/finished" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMProjectsList /></Base></Suspense> } /> } />
              <Route path="/project-management/projects/advanced" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMAdvancedProjectsManagement /></Base></Suspense> } /> } />
              <Route path="/project-management/projects/new" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMNewProject /></Base></Suspense> } /> } />
              <Route path="/project-management/projects/:id" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMProjectDetails /></Base></Suspense> } /> } />
              <Route path="/project-management/projects/:id/supply" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMProjectSupply /></Base></Suspense> } /> } />
              <Route path="/project-management/projects/:id/supply/edit" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMEditSupply /></Base></Suspense> } /> } />
              <Route path="/project-management/projects/:id/edit" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMEditProject /></Base></Suspense> } /> } />
              <Route path="/project-management/teams" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMTeamsManagement /></Base></Suspense> } /> } />
              <Route path="/project-management/users" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMUsersManagement /></Base></Suspense> } /> } />
              <Route path="/project-management/currencies" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMCurrenciesManagement /></Base></Suspense> } /> } />
              <Route path="/project-management/subcategories" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMSubcategoriesList /></Base></Suspense> } /> } />
              <Route path="/project-management/subcategories/new" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMSubcategoryForm /></Base></Suspense> } /> } />
              <Route path="/project-management/subcategories/:id" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMSubcategoryDetails /></Base></Suspense> } /> } />
              <Route path="/project-management/subcategories/:id/edit" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMSubcategoryForm /></Base></Suspense> } /> } />
              <Route path="/project-management/project-types" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMProjectTypesList /></Base></Suspense> } /> } />
              <Route path="/project-management/project-types/new" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMProjectTypeForm /></Base></Suspense> } /> } />
              <Route path="/project-management/project-types/:id/edit" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMProjectTypeForm /></Base></Suspense> } /> } />
              <Route path="/project-management/notifications" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMNotifications /></Base></Suspense> } /> } />
              <Route path="/project-management/reports" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMReports /></Base></Suspense> } /> } />
              <Route path="/project-management/beneficiaries/statistics" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMBeneficiariesStatistics /></Base></Suspense> } /> } />
              <Route path="/project-management/beneficiaries" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMBeneficiariesManagement /></Base></Suspense> } /> } />
              <Route path="/warehouse" element={ <Navigate to="/warehouse/dashboard" replace /> } />
              <Route path="/warehouse/create" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMWarehouseForm /></Base></Suspense> } /> } />
              <Route path="/warehouse/:id/edit" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMWarehouseForm /></Base></Suspense> } /> } />
              <Route path="/warehouse/dashboard" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMWarehouseDashboard /></Base></Suspense> } /> } />
              <Route path="/warehouse/list" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMWarehouse /></Base></Suspense> } /> } />
              <Route path="/surplus/dashboard" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMSurplusDashboard /></Base></Suspense> } /> } />
              <Route path="/surplus/report" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMSurplusReport /></Base></Suspense> } /> } />
              <Route path="/surplus/categories" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMSurplusCategories /></Base></Suspense> } /> } />
              <Route path="/surplus/categories/new" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMSurplusCategoryForm /></Base></Suspense> } /> } />
              <Route path="/surplus/categories/:id/edit" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMSurplusCategoryForm /></Base></Suspense> } /> } />
              <Route path="/surplus/categories/:id" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMSurplusCategoryDetails /></Base></Suspense> } /> } />

              {/* Sponsorship Groups Routes */ }
              <Route path="/project-management/sponsorship-groups" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMSponsorshipGroups /></Base></Suspense> } /> } />
              <Route path="/project-management/sponsorship-groups/:id/items" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMSponsorshipItems /></Base></Suspense> } /> } />

              {/* Media Management System Routes */ }
              <Route path="/media-management/dashboard" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><MediaDashboard /></Base></Suspense> } /> } />
              <Route path="/media-management/new-projects" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><MediaNewProjects /></Base></Suspense> } /> } />
              <Route path="/media-management/projects" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><MediaProjectsList /></Base></Suspense> } /> } />
              <Route path="/media-management/projects/finished" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><MediaProjectsList /></Base></Suspense> } /> } />
              <Route path="/media-management/projects/:id" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PMProjectDetails /></Base></Suspense> } /> } />
              <Route path="/media-management/reports" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><MediaReports /></Base></Suspense> } /> } />
              <Route path="/media-management/photographers-stats" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><PhotographersStats /></Base></Suspense> } /> } />
              <Route path="/media-management/producers-stats" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><MontageProducersStats /></Base></Suspense> } /> } />
              <Route path="/media-management/notifications" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><MediaNotifications /></Base></Suspense> } /> } />
              <Route path="/media-management/producers" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><MontageProducersManagement /></Base></Suspense> } /> } />
              <Route path="/media-management/producers/:id/projects" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><MediaProjectsList /></Base></Suspense> } /> } />
              <Route path="/media-management/my-projects" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><MyMontageProjects /></Base></Suspense> } /> } />
              <Route path="/media-management/my-projects/:id" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><MontageProjectDetails /></Base></Suspense> } /> } />
              {/* Media Archives Routes */ }
              <Route path="/media-management/archives" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><ArchivesList /></Base></Suspense> } /> } />
              <Route path="/media-management/archives/new" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><NewArchive /></Base></Suspense> } /> } />
              <Route path="/media-management/archives/:id" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><ArchiveDetails /></Base></Suspense> } /> } />
              <Route path="/media-management/archives/:id/edit" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><EditArchive /></Base></Suspense> } /> } />

              {/* Supervision System Routes */ }
              <Route path="/supervision" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><SupervisionRoute><Navigate to="/supervision/dashboard" replace /></SupervisionRoute></Base></Suspense> } /> } />
              <Route path="/supervision/dashboard" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><SupervisionRoute><SupervisionDashboard /></SupervisionRoute></Base></Suspense> } /> } />
              <Route path="/supervision/projects" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><SupervisionRoute><DetailedProjects /></SupervisionRoute></Base></Suspense> } /> } />
              <Route path="/supervision/financial" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><SupervisionRoute><FinancialReports /></SupervisionRoute></Base></Suspense> } /> } />
              <Route path="/supervision/montage-producers" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><SupervisionRoute><MontageProducersStats /></SupervisionRoute></Base></Suspense> } /> } />
              <Route path="/supervision/photographers" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Base><SupervisionRoute><PhotographersStats /></SupervisionRoute></Base></Suspense> } /> } />

              <Route path="/logout" element={ <PrivateRoute element={ <Suspense fallback={ <SkeletonLoader width="100%" height="100vh" /> }><Logout /></Suspense> } /> } />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
