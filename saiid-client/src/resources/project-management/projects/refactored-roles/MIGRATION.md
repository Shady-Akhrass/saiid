# Migration Guide: Converting to Refactored Projects List

This guide explains how to migrate from the monolithic `ProjectsList.jsx` (~10,500 lines) to the new modular refactored structure.

## Progress Status

**Phase 1: Completed ✅**
- Created folder structure
- Implemented utility functions
- Created common components
- Created role-specific components
- Updated FilterBar with all filter options
- Updated ProjectsTable with 4 role-specific header layouts

**Phase 2: In Progress 🔄**
- Testing each role view
- Integrating with original API endpoints
- Adding missing modal functionality

**Phase 3: Pending ⏳**
- Full end-to-end testing
- Performance optimization

---

## Overview

The refactored code divides the projects list into role-specific components with a clear separation of concerns:

```
refactored-roles/
├── index.jsx                    # Main entry point with role routing
├── MIGRATION.md                 # This migration guide
├── utils/
│   └── projectUtils.js         # All helper functions (40+ exports)
├── hooks/
│   ├── useProjectsData.js       # Data fetching logic
│   ├── useProjectsCache.js      # Cache management
│   └── useRoleDetection.js      # Role detection
├── components/
│   ├── common/                  # Shared components
│   │   ├── StatusBadge.jsx
│   │   ├── FilterBar.jsx       # Full filter implementation
│   │   ├── Pagination.jsx
│   │   ├── ActionButtons.jsx
│   │   ├── ProjectsTable.jsx    # 4 role-specific headers
│   │   └── index.js
│   └── modals/                  # Modal components
│       ├── AssignProjectModal.jsx
│       ├── SelectShelterModal.jsx
│       ├── AddOrphansModal.jsx
│       ├── BeneficiariesModal.jsx
│       ├── ExecutionStatusModal.jsx
│       ├── ExportModal.jsx
│       └── index.js
└── roles/                       # Role-specific views
    ├── AdminProjectsList.jsx
    ├── ProjectManagerList.jsx
    ├── ExecutedCoordinatorList.jsx
    ├── OrphanSponsorList.jsx
    ├── MediaManagerList.jsx
    └── ExecutionHeadList.jsx
```

---

## Key Features Implemented

### FilterBar Components
- ✅ Status multi-select filter
- ✅ Project type multi-select filter
- ✅ Subcategory multi-select filter
- ✅ Researcher dropdown
- ✅ Photographer dropdown
- ✅ Producer dropdown (media manager only)
- ✅ Month number dropdown
- ✅ Phase day input
- ✅ Parent project dropdown
- ✅ Show delayed only toggle
- ✅ Show urgent only toggle
- ✅ Show sub-projects only toggle (project manager)
- ✅ Show divided parents only toggle (admin)

### ProjectsTable Headers (4 Layouts)
1. **Admin/Media Manager**: كود المشروع, الاسم, اسم المتبرع, الوصف, المبلغ قبل الخصم, المبلغ بعد التحويل, المبلغ الصافي, حالة المشروع, الأيام المتبقية, الخيارات
2. **Project Manager**: كود المشروع, الاسم, اليوم, اسم المتبرع, التفاصيل, المبلغ الصافي للتنفيذ, حالة المشروع, الأيام المتبقية, الإجراءات
3. **Executed Coordinator**: الكود, الوصف, الفريق المكلف, المصور, الحالة, الإجراءات
4. **Other (Orphan Sponsor)**: الكود, اسم المشروع, الوصف, اسم المتبرع, رقم الشهر, الحالة, المصور, تاريخ التسجيل, الإجراءات

### Utility Functions Added
- `getProjectCode()` - Get formatted project code
- `formatCurrency()` - Format currency amounts
- `getRemainingDays()` - Calculate remaining days
- `getRemainingDaysBadge()` - Get styled badge for remaining days
- `getDivisionTextColor()` - Get color based on project division
- `getProjectDescription()` - Get project description
- `getSubProjectParentName()` - Get parent project name
- `formatOriginalAmount()` - Format original amount
- `isLateForPM()` - Check if project is late for PM
- `isLateForMedia()` - Check if project is late for media
- `isOrphanSponsorshipProject()` - Check if orphan sponsorship
- `renderProjectBadges()` - Render project phase badges

---

## Step-by-Step Migration

### Step 1: Update Router Configuration

Find your router configuration file and update the import:

```jsx
// Before (original monolithic file)
import ProjectsList from './resources/project-management/projects/ProjectsList';

// After (refactored modular file)
import ProjectsList from './resources/project-management/projects/refactored-roles/index.jsx';
```

**Router file locations to check:**
- `src/App.jsx`
- `src/routes/index.jsx`
- `src/routes.jsx`
- `src/components/layout/Sidebar.jsx` (if navigation is defined there)

### Step 2: Verify Required Dependencies

Ensure these dependencies are available in your project:

```bash
# Required packages
npm install react-router-dom react-toastify exceljs lucide-react
```

### Step 3: Verify Existing Modal Components

The refactored code re-exports these modals from existing locations:

| Modal | Original Location | Re-exported In |
|-------|------------------|----------------|
| `AssignProjectModal` | `../../components/ProjectModals.jsx` | `components/modals/AssignProjectModal.jsx` |
| `SelectShelterModal` | `../../components/ProjectModals.jsx` | `components/modals/SelectShelterModal.jsx` |
| `AddOrphansModal` | `../../components/AddOrphansModal.jsx` | `components/modals/AddOrphansModal.jsx` |

**Important:** Do not delete these original modal files - they are still being used!

### Step 4: Run the Application

Start the development server to test:

```bash
cd saiid-client
npm run dev
```

### Step 5: Test Each Role

Test the application with each user role to ensure functionality:

| Role | Expected Behavior |
|------|-------------------|
| `admin` / `administrator` / `مدير` | Full CRUD access, all filters |
| `project_manager` / `مدير مشاريع` | Supply management, postponement features |
| `executed_projects_coordinator` / `منسق مشاريع منفذة` | Shelter selection enabled |
| `orphan_sponsor_coordinator` / `منسق الكفالات` | Sponsorship projects only |
| `media_manager` / `مدير الإعلام` | Media-specific filters |
| `execution_head` / `رئيس قسم التنفيذ` | Beneficiaries management |

---

## Key Changes in Refactored Code

### 1. Role Detection

Roles are now detected using `useMemo` hooks:

```jsx
const isAdmin = useMemo(() => {
  return user?.role === 'admin' || user?.role === 'administrator' || user?.role === 'مدير';
}, [user]);
```

### 2. Role-Based Rendering

The main entry point routes to the correct role component:

```jsx
const renderRoleBasedView = () => {
  if (isAdmin) {
    return <AdminProjectsList {...commonProps} />;
  }
  if (isProjectManager) {
    return <ProjectManagerList {...commonProps} />;
  }
  // ... other roles
};
```

### 3. Shared Components

Common UI elements are extracted to `components/common/`:

- `StatusBadge.jsx` - Status display with colors
- `FilterBar.jsx` - Search and filter controls
- `Pagination.jsx` - Pagination controls
- `ActionButtons.jsx` - Action buttons for each row
- `ProjectsTable.jsx` - Main table with conditional columns

### 4. Utility Functions

All helper functions are centralized in `utils/projectUtils.js`:

```js
export const normalizeProjectRecord = (project) => { /* ... */ };
export const getStatusColor = (status) => { /* ... */ };
export const isMonthlyPhaseProject = (project) => { /* ... */ };
export const getMonthNumber = (project) => { /* ... */ };
// ... and more
```

---

## Adding New Roles

To add a new role:

### 1. Create Role Component

Create `roles/NewRoleList.jsx`:

```jsx
import React from 'react';
import { FilterBar, ProjectsTable, Pagination } from '../components/common';

export const NewRoleList = ({
  projects,
  filters,
  pagination,
  onFilterChange,
  onClearFilters,
  onPageChange,
  onPerPageChange,
  // ... other props
}) => {
  return (
    <div className="space-y-6">
      <FilterBar
        filters={filters}
        onFilterChange={onFilterChange}
        onClearFilters={onClearFilters}
        // ... props
      />
      <ProjectsTable
        projects={projects}
        // ... props
      />
      <Pagination
        filters={filters}
        pagination={pagination}
        onPageChange={onPageChange}
        // ... props
      />
    </div>
  );
};
```

### 2. Update Index.jsx

Add the new role detection and routing:

```jsx
// Add role detection
const isNewRole = useMemo(() => {
  return user?.role === 'new_role_key' || user?.role === 'اسم الدور بالعربي';
}, [user]);

// Add to renderRoleBasedView
if (isNewRole) {
  return <NewRoleList {...commonProps} />;
}
```

---

## Adding New Modal Components

### 1. Create Modal File

Create `components/modals/NewModal.jsx`:

```jsx
import React from 'react';
import { X } from 'lucide-react';

export const NewModal = ({ isOpen, onClose, data, onSuccess }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        {/* Modal content */}
      </div>
    </div>
  );
};
```

### 2. Export from index.js

Update `components/modals/index.js`:

```js
export { NewModal } from './NewModal';
```

---

## Troubleshooting

### "Module not found" Errors

Check the import paths in `index.jsx`. The relative paths depend on the file location.

### Modals Not Opening

Ensure the original modal files still exist:
- `src/resources/project-management/components/ProjectModals.jsx`
- `src/resources/project-management/components/AddOrphansModal.jsx`

### Styles Not Applied

The refactored code uses Tailwind CSS classes. Ensure your project has Tailwind configured.

### Role-Based Features Not Working

Check the user's role in the database/auth context. The role should match one of:
- `admin`, `administrator`, `مدير`
- `project_manager`, `مدير مشاريع`
- `executed_projects_coordinator`, `منسق مشاريع منفذة`
- `orphan_sponsor_coordinator`, `منسق الكفالات`
- `media_manager`, `مدير الإعلام`
- `execution_head`, `رئيس قسم التنفيذ`

---

## Rollback Procedure

If you need to rollback to the original monolithic file:

1. Revert the router import in Step 1
2. Delete the `refactored-roles` folder (optional)
3. No other changes required

---

## File Reference

| Original File | Refactored Location |
|--------------|---------------------|
| `ProjectsList.jsx` (main component) | `refactored-roles/index.jsx` |
| Helper functions (inlined) | `refactored-roles/utils/projectUtils.js` |
| Role-specific rendering | `refactored-roles/roles/*.jsx` |
| Common UI components | `refactored-roles/components/common/*.jsx` |
| Modal components | `refactored-roles/components/modals/*.jsx` |

---

## Support

For issues or questions, refer to the original `ProjectsList.jsx` file to understand the expected behavior, then check the corresponding refactored component.
