# ProjectProposal Controller Routes Documentation

## 📋 **Overview**
This document contains all routes related to `ProjectProposalController` in the `api.php` file, organized by functionality and access levels.

**Base URL**: `http://localhost:5174/`

---

## 🔐 **Authentication & CORS Routes**

### **CORS Preflight Routes**
```php
// OPTIONS routes for CORS preflight
Route::options('/project-proposals/{id}/beneficiaries', $corsPreflight);
Route::options('/project-proposals/{id}', $corsPreflight);
```

---

## 🌐 **Public Routes** (All Authenticated Users)
*Middleware: `auth:sanctum` + `throttle:project-proposals`*

### **Basic CRUD Operations**
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `GET` | `http://localhost:5174/project-proposals` | `index()` | Get all projects with filtering and pagination |
| `GET` | `http://localhost:5174/project-proposals/{id}` | `show()` | Get specific project details |
| `GET` | `http://localhost:5174/project-proposals/export` | `export()` | Export projects to Excel with filters |

### **Special Routes**
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `GET` | `http://localhost:5174/project-proposals/debug-data` | - | Debug endpoint for testing project data |
| `GET` | `http://localhost:5174/project-proposals/executed-for-beneficiaries` | `getExecutedProjectsForBeneficiaries()` | Get executed projects for beneficiaries management |
| `GET` | `http://localhost:5174/project-proposals/new-projects-needing-photographer` | `getNewProjectsNeedingPhotographer()` | Get new projects that need photographer assignment |
| `GET` | `http://localhost:5174/project-proposals/{id}/timeline` | `getTimeline()` | Get project timeline/audit trail |
| `GET` | `http://localhost:5174/project-proposals/{id}/daily-phases` | `getDailyPhases()` | Get project daily phases |

---

## 👑 **Admin Only Routes**
*Middleware: `auth:sanctum` + `role:admin`*

### **Project Management**
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `GET` | `http://localhost:5174/project-proposals-dashboard` | `dashboard()` | Admin dashboard statistics |
| `POST` | `http://localhost:5174/project-proposals` | `create()` | Create new project proposal |
| `DELETE` | `http://localhost:5174/project-proposals/{id}` | `destroy()` | Delete project |
| `POST` | `http://localhost:5174/project-proposals/{id}/mark-as-completed` | `markAsCompleted()` | Mark project as completed (from "وصل للمتبرع" to "منتهي") |

---

## 🔍 **Advanced Management Routes** (Admin & Project Manager)
*Middleware: `auth:sanctum` + `role:admin,project_manager`*

| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `GET` | `http://localhost:5174/admin/project-proposals/advanced-search` | `advancedSearch()` | Advanced project search |
| `GET` | `http://localhost:5174/admin/project-proposals/{id}/full-details` | `getFullProjectDetails()` | Get complete project details |
| `PATCH` | `http://localhost:5174/admin/project-proposals/{id}/advanced-update` | `advancedUpdate()` | Advanced project update (allows empty fields) |
| `POST` | `http://localhost:5174/admin/project-proposals/{id}/change-status` | `changeStatus()` | Change project status to any available status |

---

## 📊 **Project Manager Routes**
*Middleware: `auth:sanctum` + `role:project_manager,media_manager,admin,orphan_sponsor_coordinator,supervision`*

### **Execution Status Management**
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `POST` | `http://localhost:5174/project-proposals/{id}/update-execution-status` | `updateExecutionStatus()` | Update execution status (from "قيد التنفيذ" to "تم التنفيذ") |

### **Project Assignment & Status**
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `POST` | `http://localhost:5174/project-proposals/{id}/assign` | `assignProject()` | Assign project to researcher |
| `POST` | `http://localhost:5174/project-proposals/{id}/return-to-supply` | `returnToSupply()` | Return project to "تم التوريد" stage |
| `POST` | `http://localhost:5174/project-proposals/{id}/postpone` | `postponeProject()` | Postpone project |
| `POST` | `http://localhost:5174/project-proposals/{id}/resume` | `resumeProject()` | Resume postponed project |
| `POST` | `http://localhost:5174/project-proposals/{id}/move-to-supply` | `moveToSupply()` | Move project to supply stage |
| `POST` | `http://localhost:5174/project-proposals/{id}/convert-to-shekel` | `convertToShekel()` | Convert project amount to Shekel |

---

## 📝 **Project Update Routes** (Multiple Roles)

### **Beneficiaries Management**
*Middleware: `auth:sanctum` + `role:project_manager,executed_projects_coordinator,admin,orphan_sponsor_coordinator`*
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `PATCH` | `http://localhost:5174/project-proposals/{id}/beneficiaries` | `updateBeneficiaries()` | Update project beneficiaries count |

### **General Project Update**
*Middleware: `auth:sanctum` + `role:project_manager,executed_projects_coordinator,admin,orphan_sponsor_coordinator`*
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `PATCH`/`PUT` | `http://localhost:5174/project-proposals/{id}` | `update()` | Update project details |

### **Orphan Sponsor Coordinator Update**
*Middleware: `auth:sanctum` + `role:orphan_sponsor_coordinator,admin`*
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `PATCH`/`PUT` | `http://localhost:5174/project-proposals/{id}` | `update()` | Update sponsorship projects |

---

## 📺 **Media Manager Routes**
*Middleware: `auth:sanctum` + `role:media_manager,admin`*

### **Dashboard & Reports**
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `GET` | `http://localhost:5174/project-proposals/media-dashboard` | `mediaDashboard()` | Media dashboard statistics |
| `GET` | `http://localhost:5174/project-proposals/media-reports` | `mediaReports()` | Media reports with filtering |

### **Photographer Assignment**
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `POST` | `http://localhost:5174/project-proposals/bulk-assign-photographer` | `bulkAssignPhotographer()` | Bulk assign photographer to multiple projects |
| `POST` | `http://localhost:5174/project-proposals/{id}/assign-photographer` | `assignPhotographer()` | Assign photographer to project |

### **Media Status Management**
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `POST` | `http://localhost:5174/project-proposals/{id}/update-media-status` | `updateMediaStatus()` | Update media status |
| `POST` | `http://localhost:5174/project-proposals/batch-update-status` | `batchUpdateStatus()` | Batch update media status for multiple projects |

### **Montage Producer Management**
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `POST` | `http://localhost:5174/project-proposals/{id}/assign-montage-producer` | `assignMontageProducer()` | Assign montage producer to project |
| `POST` | `http://localhost:5174/project-proposals/batch-assign-producer` | `batchAssignProducer()` | Bulk assign montage producer to multiple projects |

---

## 🏕 **Executed Projects Coordinator Routes**
*Middleware: `auth:sanctum` + `role:executed_projects_coordinator,admin`*

| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `POST` | `http://localhost:5174/project-proposals/{id}/select-shelter` | `selectShelter()` | Select shelter for project |
| `POST` | `http://localhost:5174/project-proposals/{id}/transfer-to-execution` | `transferToExecution()` | Transfer project to execution system |

---

## 🏕 **Orphan Sponsor Coordinator Routes**
*Middleware: `auth:sanctum` + `role:orphan_sponsor_coordinator,admin`*

### **Execution Transfer**
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `POST` | `http://localhost:5174/project-proposals/{id}/transfer-to-execution` | `transferToExecution()` | Transfer sponsorship project to execution |

### **Orphan Management**
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `POST` | `http://localhost:5174/project-proposals/{id}/orphans` | `addOrphansToProject()` | Add orphans to project |
| `DELETE` | `http://localhost:5174/project-proposals/{id}/orphans/{orphanId}` | `removeOrphanFromProject()` | Remove orphan from project |
| `GET` | `http://localhost:5174/project-proposals/{id}/orphans` | `getProjectOrphans()` | Get sponsored orphans for project |
| `GET` | `http://localhost:5174/orphans/{orphanId}/projects` | `getOrphanProjects()` | Get projects for orphan |

---

## 👥 **Beneficiaries Management Routes**
*Middleware: `auth:sanctum`*

### **General Beneficiary Access**
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `GET` | `http://localhost:5174/project-proposals/{id}/beneficiaries` | `getBeneficiaries()` | Get project beneficiaries |
| `GET` | `http://localhost:5174/project-proposals/{id}/beneficiaries/export` | `exportBeneficiaries()` | Export beneficiaries to Excel |

### **Admin & Executed Projects Coordinator**
*Additional Middleware: `role:admin,executed_projects_coordinator`*
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `GET` | `http://localhost:5174/project-proposals/{id}/beneficiaries/template` | `downloadTemplate()` | Download beneficiaries template |
| `POST` | `http://localhost:5174/project-proposals/{id}/beneficiaries/upload` | `uploadExcel()` | Upload beneficiaries from Excel |
| `DELETE` | `http://localhost:5174/project-proposals/{id}/beneficiaries` | `deleteBeneficiaries()` | Delete all beneficiaries |
| `POST` | `http://localhost:5174/beneficiaries/counts` | `getBeneficiariesCounts()` | Get beneficiaries counts for multiple projects |

### **Admin Only Beneficiary Statistics**
*Additional Middleware: `role:admin`*
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `GET` | `http://localhost:5174/beneficiaries/statistics` | `getStatistics()` | Get beneficiaries statistics |
| `GET` | `http://localhost:5174/beneficiaries/by-aid-type/{aidType}` | `getUniqueBeneficiariesByAidType()` | Get unique beneficiaries by aid type |

---

## 🎬 **Montage Producer Routes**
*Middleware: `auth:sanctum` + `role:montage_producer`*

| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `GET` | `http://localhost:5174/my-montage-projects` | `index()` | Get montage producer's projects |
| `GET` | `http://localhost:5174/my-montage-projects/{id}` | `show()` | Get specific montage project |
| `POST` | `http://localhost:5174/my-montage-projects/{id}/complete-montage` | `completeMontage()` | Mark montage as completed |
| `POST` | `http://localhost:5174/my-montage-projects/{id}/update-status` | `updateStatus()` | Update project status |

---

## 🔍 **Supervision Routes** (Higher Management)
*Middleware: `auth:sanctum` + `role:supervision,admin,project_manager,media_manager`*

### **Summary Reports**
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `GET` | `http://localhost:5174/supervision/summary-dashboard` | `summaryDashboard()` | Summary dashboard |
| `GET` | `http://localhost:5174/supervision/financial-summary` | `financialSummary()` | Financial summary |
| `GET` | `http://localhost:5174/supervision/performance-summary` | `performanceSummary()` | Performance summary |

### **Detailed Reports**
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `GET` | `http://localhost:5174/supervision/detailed-projects` | `detailedProjectsReport()` | Detailed projects report |
| `GET` | `http://localhost:5174/supervision/detailed-financial` | `detailedFinancialReport()` | Detailed financial report |
| `GET` | `http://localhost:5174/supervision/detailed-beneficiaries` | `detailedBeneficiariesReport()` | Detailed beneficiaries report |

### **Statistics**
| Method | Full URL | Controller Method | Description |
|---------|-----------|------------------|-------------|
| `GET` | `http://localhost:5174/supervision/montage-producers-statistics` | `montageProducersStatistics()` | Montage producers statistics |
| `GET` | `http://localhost:5174/supervision/photographers-statistics` | `getPhotographersStatistics()` | Photographers statistics |

---

## 📊 **Route Summary by Category**

### **CRUD Operations**
- ✅ **Create**: `POST http://localhost:5174/project-proposals` (Admin only)
- ✅ **Read**: `GET http://localhost:5174/project-proposals`, `GET http://localhost:5174/project-proposals/{id}`
- ✅ **Update**: `PATCH http://localhost:5174/project-proposals/{id}` (Multiple roles)
- ✅ **Delete**: `DELETE http://localhost:5174/project-proposals/{id}` (Admin only)

### **Status Management**
- ✅ **Execution**: `POST http://localhost:5174/project-proposals/{id}/update-execution-status`
- ✅ **Media**: `POST http://localhost:5174/project-proposals/{id}/update-media-status`
- ✅ **Completion**: `POST http://localhost:5174/project-proposals/{id}/mark-as-completed`
- ✅ **Postponement**: `POST http://localhost:5174/project-proposals/{id}/postpone`
- ✅ **Resume**: `POST http://localhost:5174/project-proposals/{id}/resume`
- ✅ **Supply**: `POST http://localhost:5174/project-proposals/{id}/move-to-supply`, `POST http://localhost:5174/project-proposals/{id}/return-to-supply`

### **Assignment Management**
- ✅ **Researcher**: `POST http://localhost:5174/project-proposals/{id}/assign`
- ✅ **Photographer**: `POST http://localhost:5174/project-proposals/{id}/assign-photographer`, `POST http://localhost:5174/project-proposals/bulk-assign-photographer`
- ✅ **Montage Producer**: `POST http://localhost:5174/project-proposals/{id}/assign-montage-producer`, `POST http://localhost:5174/project-proposals/batch-assign-producer`

### **Data Operations**
- ✅ **Export**: `GET http://localhost:5174/project-proposals/export`
- ✅ **Timeline**: `GET http://localhost:5174/project-proposals/{id}/timeline`
- ✅ **Dashboard**: `GET http://localhost:5174/project-proposals-dashboard`, `GET http://localhost:5174/project-proposals/media-dashboard`
- ✅ **Reports**: `GET http://localhost:5174/project-proposals/media-reports`

### **Specialized Operations**
- ✅ **Currency**: `POST http://localhost:5174/project-proposals/{id}/convert-to-shekel`
- ✅ **Execution**: `POST http://localhost:5174/project-proposals/{id}/transfer-to-execution`
- ✅ **Shelter**: `POST http://localhost:5174/project-proposals/{id}/select-shelter`
- ✅ **Orphans**: `POST http://localhost:5174/project-proposals/{id}/orphans`, `GET http://localhost:5174/project-proposals/{id}/orphans`
- ✅ **Beneficiaries**: `PATCH http://localhost:5174/project-proposals/{id}/beneficiaries`

---

## 🔐 **Security & Rate Limiting**

### **Rate Limiters Applied**
- `throttle:project-proposals` - Applied to basic project routes
- `throttle:project-metadata` - Applied to project types and subcategories
- `throttle:notifications` - Applied to notification routes
- `throttle:warehouse` - Applied to warehouse/shopping cart routes

### **Authentication Required**
All routes require `auth:sanctum` middleware except for CORS preflight routes.

### **Role-Based Access**
Routes are organized by role hierarchy:
- **Admin**: Full access to all operations
- **Project Manager**: Project lifecycle management
- **Media Manager**: Media and photographer management
- **Executed Projects Coordinator**: Execution and shelter management
- **Orphan Sponsor Coordinator**: Orphan and sponsorship management
- **Montage Producer**: Own project management only
- **Supervision**: High-level reporting and oversight

---

## 📝 **Notes**

1. **Route Ordering**: Static routes are defined before dynamic `{id}` routes to prevent conflicts
2. **CORS Support**: All routes have proper CORS preflight handling
3. **Method Matching**: Some routes support both `PATCH` and `PUT` for frontend compatibility
4. **Bulk Operations**: Several routes support bulk operations for efficiency
5. **Rate Limiting**: Different rate limiters applied based on route type and usage patterns
6. **Middleware Stacking**: Multiple middleware can be applied to single route for complex permission requirements

---

## 📈 **Total Routes Count**

| Category | Route Count |
|-----------|--------------|
| **Public/Authenticated** | 8 |
| **Admin Only** | 4 |
| **Advanced Management** | 4 |
| **Project Manager** | 7 |
| **Media Manager** | 8 |
| **Executed Projects Coordinator** | 2 |
| **Orphan Sponsor Coordinator** | 5 |
| **Beneficiaries Management** | 7 |
| **Montage Producer** | 4 |
| **Supervision** | 8 |
| **CORS Preflight** | 2 |
| **Total** | **59 routes** |

---

*This documentation covers all ProjectProposalController routes as defined in the api.php file.*
