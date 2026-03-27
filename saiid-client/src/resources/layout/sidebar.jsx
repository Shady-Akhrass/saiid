// Sidebar.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { X, LayoutDashboard, Plus, FolderKanban, FileText, Coins, Users, UsersRound, Bell, BarChart3, Heart, Stethoscope, Home, DollarSign, Package, Tag, CheckCircle, Settings, Archive, FolderOpen } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../utils/axiosConfig";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { user } = useAuth();
  const [activeItem, setActiveItem] = useState(null);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isProjectManagementOpen, setIsProjectManagementOpen] = useState(false);
  const [isWarehouseOpen, setIsWarehouseOpen] = useState(false);
  const [isSurplusOpen, setIsSurplusOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const location = useLocation();
  // ✅ Track if fetchUnreadCount is already running to prevent duplicate calls
  const fetchingUnreadCountRef = useRef(false);

  const sidebarItems = [
    {
      name: "statistics",
      label: "الاحصائيات",
      route: "statistics",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
    {
      name: "project-management",
      label: "نظام إدارة المشاريع",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
      ),
      subItems: [
        {
          route: "dashboard",
          name: "pmDashboard",
          label: "لوحة التحكم",
        },
        {
          route: "projects/new",
          name: "pmNewProject",
          label: "إضافة مشروع",
        },
        {
          route: "projects",
          name: "pmProjects",
          label: "المشاريع",
        },
        {
          route: "beneficiaries",
          name: "pmBeneficiariesManagement",
          label: "إدارة المستفيدين",
        },
        {
          route: "reports",
          name: "pmReports",
          label: "التقارير",
        },
        {
          route: "teams",
          name: "pmTeams",
          label: "الفرق",
        },
        {
          route: "users",
          name: "pmUsers",
          label: "المستخدمين",
        },
        {
          route: "currencies",
          name: "pmCurrencies",
          label: "العملات",
        },
        {
          route: "beneficiaries/statistics",
          name: "pmBeneficiariesStatistics",
          label: "إحصائيات المستفيدين",
          adminOnly: true,
        },
      ],
    },
    {
      name: "forms-control",
      label: "إدارة النماذج",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h18M3 12h18M3 17h18" /></svg>
      ),
    },
    {
      name: "orphans",
      label: "الايتام",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
    },
    {
      name: "orphan-groupings",
      label: "مجموعات الأيتام",
      route: "orphan-groupings",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
    {
      name: "aids",
      label: "المساعدات",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      ),
    },
    // {
    //   name: "teachers",
    //   label: "المعلمين",
    //   icon: (
    //     <svg
    //       className="w-5 h-5"
    //       fill="none"
    //       stroke="currentColor"
    //       viewBox="0 0 24 24"
    //     >
    //       <path
    //         strokeLinecap="round"
    //         strokeLinejoin="round"
    //         strokeWidth="2"
    //         d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
    //       />
    //     </svg>
    //   ),
    // },
    // {
    //   name: "students",
    //   label: "الطلاب",
    //   icon: (
    //     <svg
    //       className="w-5 h-5"
    //       fill="none"
    //       stroke="currentColor"
    //       viewBox="0 0 24 24"
    //     >
    //       <path
    //         strokeLinecap="round"
    //         strokeLinejoin="round"
    //         strokeWidth="2"
    //         d="M12 14l9-5-9-5-9 5 9 5z"
    //       />
    //       <path
    //         strokeLinecap="round"
    //         strokeLinejoin="round"
    //         strokeWidth="2"
    //         d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
    //       />
    //       <path
    //         strokeLinecap="round"
    //         strokeLinejoin="round"
    //         strokeWidth="2"
    //         d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
    //       />
    //     </svg>
    //   ),
    // },
    {
      name: "employments",
      label: "المقدمين للوظائف",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      name: "shelters",
      label: "مراكز النزوح",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
    },
    {
      name: "patients",
      label: "المرضى",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      ),
    },
    {
      name: "projects",
      label: "المشاريع المنفذة",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      ),
    },
  ];

  // فلترة العناصر بناءً على دور المستخدم - استخدام useMemo لتحسين الأداء
  const filteredSidebarItems = useMemo(() => {
    const userRole = user?.role?.toLowerCase?.() ||
      user?.userRole?.toLowerCase?.() ||
      user?.user_role?.toLowerCase?.() ||
      user?.role_name?.toLowerCase?.() ||
      user?.role || '';

    const isAdmin = userRole === 'admin' ||
      userRole === 'administrator' ||
      userRole === 'مدير' ||
      userRole === 'مدير عام';

    const isExecutedCoordinator = userRole === 'executed_projects_coordinator' ||
      userRole === 'executedprojectscoordinator' ||
      userRole === 'منسق مشاريع منفذة';

    const isMediaManager = userRole === 'media_manager' ||
      userRole === 'mediamanager' ||
      userRole === 'مدير إعلام';

    const isMontageProducer = userRole === 'montage_producer' ||
      userRole === 'montageproducer' ||
      userRole === 'ممنتج مونتاج';

    const isProjectManager = userRole === 'project_manager' ||
      userRole === 'projectmanager' ||
      userRole === 'مدير مشاريع';

    const isWarehouseManager = userRole === 'warehouse_manager' ||
      userRole === 'warehousemanager' ||
      userRole === 'مدير مخزن' ||
      userRole === 'مدير المخزن';

    const isOrphanCoordinator = userRole === 'orphan_sponsor_coordinator' ||
      userRole === 'منسق كفالة الأيتام' ||
      userRole === 'منسق مشاريع كفالة الأيتام' ||
      userRole === 'منسق الكفالات';

    const isSupervision = userRole === 'supervision' ||
      userRole === 'إشراف' ||
      userRole === 'supervision_manager';

    const canManageWarehouse = isAdmin || isWarehouseManager;

    // ✅ إرجاع عناصر قسم الإشراف (الإدارة العليا)
    if (isSupervision) {
      return [
        {
          name: 'supervisionDashboard',
          label: 'لوحة التحكم',
          route: 'dashboard',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
        },
        {
          name: 'supervisionProjects',
          label: 'تقرير المشاريع',
          route: 'projects',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
        {
          name: 'supervisionFinancial',
          label: 'التقارير المالية',
          route: 'financial',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          name: 'supervisionMontageProducers',
          label: 'إحصائيات الممنتجين',
          route: 'montage-producers',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ),
        },
        {
          name: 'supervisionPhotographers',
          label: 'إحصائيات المصورين',
          route: 'photographers',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
        {
          name: "surplus",
          label: "الفائض",
          route: "",
          icon: <DollarSign className="w-5 h-5" />,
          subItems: [
            {
              route: "surplus/dashboard",
              name: "surplusDashboard",
              label: "لوحة التحكم",
            },
            {
              route: "surplus/report",
              name: "surplusReport",
              label: "التقارير",
            },
            {
              route: "surplus/categories",
              name: "surplusCategories",
              label: "إدارة الأقسام",
            },
          ],
        },
      ];
    }

    // ✅ إرجاع عناصر قسم الإعلام (بدون قائمة منسدلة)
    if (isMediaManager) {
      return [
        {
          name: 'mediaDashboard',
          label: 'لوحة التحكم',
          route: 'dashboard',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
        },
        {
          name: 'mediaNewProjects',
          label: 'المشاريع الجديدة',
          route: 'new-projects',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          ),
        },
        {
          name: 'mediaProjects',
          label: 'المشاريع',
          route: 'projects',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          ),
        },
        {
          name: 'mediaProducers',
          label: 'الممنتجين',
          route: 'producers',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
        },
        {
          name: 'mediaPhotographersStats',
          label: 'تقارير المصورين',
          route: 'photographers-stats',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            </svg>
          ),
        },
        {
          name: 'mediaProducersStats',
          label: 'تقارير الممنتجين',
          route: 'producers-stats',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ),
        },
        {
          name: 'mediaReports',
          label: 'التقارير',
          route: 'reports',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
        },
        {
          name: 'mediaNotifications',
          label: 'الإشعارات',
          route: 'notifications',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          ),
        },
        {
          name: 'mediaArchives',
          label: 'أرشيف المواد',
          route: 'archives',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          ),
        },
      ];
    }

    // ✅ إرجاع عناصر ممنتج المونتاج
    if (isMontageProducer) {
      return [
        {
          name: 'myMontageProjects',
          label: 'مشاريعي',
          route: 'my-projects',
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ),
        },
      ];
    }

    // ✅ في قسم مدير المخزن: إظهار فقط مهام المخزن
    if (isWarehouseManager && !isAdmin) {
      return [
        {
          name: "warehouse",
          label: "المخزن",
          route: "",
          icon: <Package className="w-5 h-5" />,
          subItems: [
            {
              route: "warehouse/dashboard",
              name: "warehouseDashboard",
              label: "لوحة التحكم",
            },
            {
              route: "warehouse/list",
              name: "warehouseList",
              label: "قائمة الأصناف",
            },
            {
              route: "warehouse/create",
              name: "warehouseCreate",
              label: "إضافة صنف",
            },
          ],
        },
        {
          name: "pmNotifications",
          label: "الإشعارات",
          route: "notifications",
          icon: (
            <div className="relative">
              <Bell className="w-5 h-5" />
              { unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  { unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount }
                </span>
              ) }
            </div>
          ),
        },
      ];
    }

    // ✅ في قسم الإدارة: إظهار كل عنصر منفصل (بدون قائمة منسدلة)
    const isOrphanSection = location.pathname.startsWith('/orphans') || location.pathname.startsWith('/orphan-groupings');

    if (isAdmin) {
      return [
        {
          name: "pmDashboard",
          label: "لوحة التحكم",
          route: "dashboard",
          icon: <LayoutDashboard className="w-5 h-5" />,
        },
        {
          name: "pmProjects",
          label: "عرض المشاريع",
          route: "projects",
          icon: <FolderKanban className="w-5 h-5" />,
        },

        {
          name: "pmFinishedProjects",
          label: "المشاريع المنتهية",
          route: "projects/finished",
          icon: <Archive className="w-5 h-5" />,
        },
        {
          name: "pmNewProject",
          label: "إضافة مشروع",
          route: "projects/new",
          icon: <Plus className="w-5 h-5" />,
        },
        {
          name: "pmReports",
          label: "التقارير",
          route: "reports",
          icon: <FileText className="w-5 h-5" />,
        },

        {
          name: "warehouse",
          label: "المخزن",
          route: "",
          icon: <Package className="w-5 h-5" />,
          subItems: [
            {
              route: "warehouse/dashboard",
              name: "warehouseDashboard",
              label: "لوحة التحكم",
            },
            {
              route: "warehouse/list",
              name: "warehouseList",
              label: "قائمة الأصناف",
            },
            {
              route: "warehouse/create",
              name: "warehouseCreate",
              label: "إضافة صنف",
            },
          ],
        },
        {
          name: "surplus",
          label: "الفائض",
          route: "",
          icon: <DollarSign className="w-5 h-5" />,
          subItems: [
            {
              route: "surplus/dashboard",
              name: "surplusDashboard",
              label: "لوحة التحكم",
            },
            {
              route: "surplus/report",
              name: "surplusReport",
              label: "التقارير",
            },
            {
              route: "surplus/categories",
              name: "surplusCategories",
              label: "إدارة الأقسام",
            },
          ],
        },
        {
          name: "pmUsers",
          label: "المستخدمين",
          route: "users",
          icon: <Users className="w-5 h-5" />,
        },
        {
          name: "pmCurrencies",
          label: "العملات",
          route: "currencies",
          icon: <Coins className="w-5 h-5" />,
        },
        {
          name: "pmSubcategories",
          label: "التفريعات",
          route: "subcategories",
          icon: <Tag className="w-5 h-5" />,
        },
        {
          name: "pmProjectTypes",
          label: "أنواع المشاريع",
          route: "project-types",
          icon: <FolderKanban className="w-5 h-5" />,
        },
        {
          name: "pmNotifications",
          label: "الإشعارات",
          route: "notifications",
          icon: (
            <div className="relative">
              <Bell className="w-5 h-5" />
              { unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  { unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount }
                </span>
              ) }
            </div>
          ),
        }, {
          name: "statistics",
          label: "الاحصائيات",
          route: "statistics",
          icon: (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          ),
        },
        {
          name: "pmAdvancedProjects",
          label: "الإدارة المتقدمة للمشاريع",
          route: "projects/advanced",
          icon: <Settings className="w-5 h-5" />,
        },

        {
          name: "pmSponsorshipGroups",
          label: "مجموعات الكفالات",
          route: "sponsorship-groups",
          icon: <FolderOpen className="w-5 h-5" />,
        },
        {
          name: "forms-control",
          label: "إدارة النماذج",
          route: "forms-control",
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h18M3 12h18M3 17h18" /></svg>
          ),
        }
      ];
    }

    // ✅ في دور مدير المشاريع: إظهار كل عنصر منفصل (بدون قائمة منسدلة)
    if (isProjectManager) {
      return [
        {
          name: "pmDashboard",
          label: "لوحة التحكم",
          route: "dashboard",
          icon: <LayoutDashboard className="w-5 h-5" />,
        },
        {
          name: "pmProjects",
          label: "المشاريع",
          route: "projects",
          icon: <FolderKanban className="w-5 h-5" />,
        },
        {
          name: "pmDetailedProjects",
          label: "تقرير المشاريع المفصل",
          route: "detailed-projects",
          icon: <FileText className="w-5 h-5" />,
        },
        {
          name: "pmAdvancedProjects",
          label: "الإدارة المتقدمة للمشاريع",
          route: "projects/advanced",
          icon: <Settings className="w-5 h-5" />,
        },
        {
          name: "pmReports",
          label: "التقارير",
          route: "reports",
          icon: <FileText className="w-5 h-5" />,
        },
        {
          name: "pmTeams",
          label: "الفرق",
          route: "teams",
          icon: <UsersRound className="w-5 h-5" />,
        },
        {
          name: "surplus",
          label: "الفائض",
          route: "",
          icon: <DollarSign className="w-5 h-5" />,
          subItems: [
            {
              route: "surplus/dashboard",
              name: "surplusDashboard",
              label: "لوحة التحكم",
            },
            {
              route: "surplus/report",
              name: "surplusReport",
              label: "التقارير",
            },
            {
              route: "surplus/categories",
              name: "surplusCategories",
              label: "إدارة الأقسام",
            },
          ],
        },
        {
          name: "pmNotifications",
          label: "الإشعارات",
          route: "notifications",
          icon: <Bell className="w-5 h-5" />,
        },

      ];
    }

    // ✅ قائمة مخصصة لمنسق المشاريع المنفذة - مع الحفاظ على جميع العناصر القديمة
    if (isExecutedCoordinator) {
      // الحصول على العناصر الأساسية القديمة من sidebarItems
      const oldItems = sidebarItems.filter(item =>
        item.name !== 'project-management' &&
        item.name !== 'orphan-groupings' &&
        ['statistics', 'forms-control', 'orphans', 'aids', 'employments', 'shelters', 'patients', 'projects'].includes(item.name)
      );

      // إضافة العناصر الجديدة لإدارة المستفيدين
      return [
        ...oldItems,
        {
          name: "pmBeneficiariesManagement",
          label: "إدارة المستفيدين",
          route: "beneficiaries",
          icon: <Users className="w-5 h-5" />,
        },
        {
          name: "pmNotifications",
          label: "الإشعارات",
          route: "notifications",
          icon: (
            <div className="relative">
              <Bell className="w-5 h-5" />
              { unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  { unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount }
                </span>
              ) }
            </div>
          ),
        },
      ];
    }

    // ✅ قائمة مخصصة لمنسق كفالة الأيتام (عناصر منفصلة بدون قائمة منسدلة)
    if (isOrphanCoordinator) {
      return [
        {
          name: "pmProjects",
          label: "المشاريع",
          route: "projects",
          icon: <FolderKanban className="w-5 h-5" />,
        },
        {
          name: "statistics",
          label: "الاحصائيات",
          route: "statistics",
          icon: (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          ),
        },
        {
          name: "forms-control",
          label: "إدارة النماذج",
          route: "forms-control",
          icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h18M3 12h18M3 17h18" /></svg>
          ),
        },
        {
          name: "orphans",
          label: "الايتام",
          route: "orphans",
          icon: (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          ),
        },
        // ✅ مجموعات الأيتام لمنسق الأيتام تظهر دائماً في لوحة التحكم وغيرها
        {
          name: "orphan-groupings",
          label: "مجموعات الأيتام",
          route: "orphan-groupings",
          icon: (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          ),
        },
        {
          name: "pmNotifications",
          label: "الإشعارات",
          route: "notifications",
          icon: (
            <div className="relative">
              <Bell className="w-5 h-5" />
              { unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  { unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount }
                </span>
              ) }
            </div>
          ),
        },
      ];
    }

    return sidebarItems.filter(item => item.name !== 'orphan-groupings');
  }, [user?.role, user?.userRole, user?.user_role, user?.role_name, unreadNotificationsCount, location.pathname, sidebarItems]);

  // جلب عدد الإشعارات غير المقروءة
  useEffect(() => {
    const fetchUnreadCount = async () => {
      // ✅ Prevent duplicate calls
      if (fetchingUnreadCountRef.current) {
        return;
      }

      try {
        fetchingUnreadCountRef.current = true;

        const response = await apiClient.get('/notifications/unread-count', {
          timeout: 5000, // ✅ timeout 5 ثواني
        });

        if (response.data.success) {
          // استخدام ?? بدلاً من || لأن 0 هو falsy value
          setUnreadNotificationsCount(
            response.data.unread_count ??
            response.data.count ??
            response.data.data?.count ??
            0
          );
        }
      } catch (error) {
        // ✅ تجاهل جميع أخطاء الاتصال والـ timeout و CORS بصمت
        if (error.isConnectionError || error.isTimeoutError || error.isCorsError ||
          error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
          setUnreadNotificationsCount(0);
          return;
        }

        // ✅ تجاهل أخطاء معينة (401, 403, 404, 500) بصمت
        if (error.response?.status === 401 ||
          error.response?.status === 403 ||
          error.response?.status === 404 ||
          error.response?.status === 500) {
          // المستخدم قد لا يملك صلاحيات أو الـ endpoint غير موجود أو مشكلة في Backend
          setUnreadNotificationsCount(0);
          return;
        }

        // ✅ تسجيل الأخطاء الأخرى فقط في development
        if (import.meta.env.DEV &&
          !error.isConnectionError &&
          !error.isTimeoutError &&
          !error.isCorsError &&
          error.response?.status !== 500) {
          console.error('Error fetching unread notifications count:', {
            error,
            status: error.response?.status,
            message: error.message,
          });
        }

        // في حالة الخطأ، لا نعرض أي شيء
        setUnreadNotificationsCount(0);
      }
    };

    // ✅ جلب العدد فقط إذا كان المستخدم مسجل دخول
    if (user) {
      // جلب العدد عند تحميل الصفحة
      fetchUnreadCount();

      // ✅ تحديث العدد كل 60 ثانية (تقليل عدد الطلبات لتجنب 429 errors)
      const interval = setInterval(fetchUnreadCount, 60000); // ✅ زيادة من 30 إلى 60 ثانية

      return () => clearInterval(interval);
    }
  }, [user]);

  // ✅ تحميل الإشعارات يتم الآن في AuthContext مباشرة بعد تسجيل الدخول
  // لا حاجة لتحميلها هنا مرة أخرى - تم نقلها إلى AuthContext لتحميل أسرع

  useEffect(() => {
    const pathname = location.pathname;
    const pathParts = pathname.split("/").filter(Boolean);
    const itemName = pathParts[0];
    const subItemName = pathParts[1];
    const thirdPart = pathParts[2];

    // التعامل مع supervision (المسار يكون /supervision أو /supervision/dashboard)
    if (itemName === "supervision" && subItemName) {
      const supervisionItem = filteredSidebarItems.find(
        (item) => item.route === subItemName && item.name?.startsWith('supervision')
      );
      if (supervisionItem) {
        setActiveItem(supervisionItem.name);
        setIsProjectManagementOpen(false);
        setIsDashboardOpen(false);
        setIsWarehouseOpen(false);
        setIsSurplusOpen(false);
        document.title = supervisionItem.label;
        return;
      }
    }

    // التعامل مع warehouse و surplus (المسار يكون /warehouse أو /warehouse/dashboard)
    if (itemName === "warehouse") {
      setIsWarehouseOpen(true);
      setIsSurplusOpen(false);
      setIsDashboardOpen(false);
      setIsProjectManagementOpen(false);
      if (subItemName) {
        setActiveItem(`warehouse/${subItemName}`);
      } else {
        setActiveItem("warehouse");
      }
      return;
    }

    if (itemName === "surplus") {
      setIsSurplusOpen(true);
      setIsWarehouseOpen(false);
      setIsDashboardOpen(false);
      setIsProjectManagementOpen(false);
      if (subItemName) {
        setActiveItem(`surplus/${subItemName}`);
      } else {
        setActiveItem("surplus");
      }
      return;
    }

    // التحقق من العناصر المنفصلة في دور الإدارة (pmDashboard, pmNewProject, etc.)
    if (itemName === "project-management" && subItemName) {
      // البحث عن العنصر المنفصل الذي يطابق المسار
      const adminItem = filteredSidebarItems.find(
        (item) => item.route === subItemName && item.name?.startsWith('pm')
      );
      if (adminItem) {
        setActiveItem(adminItem.name);
        setIsProjectManagementOpen(false);
        setIsDashboardOpen(false);
        document.title = adminItem.label;
        return;
      }
      // إذا لم يكن عنصر منفصل، استخدم المنطق القديم
      setActiveItem(`project-management/${subItemName}`);
      setIsProjectManagementOpen(true);
      setIsDashboardOpen(false);
    } else if (itemName === "projects" && subItemName === "advanced") {
      // التعامل مع الإدارة المتقدمة للمشاريع
      const advancedItem = filteredSidebarItems.find(
        (item) => item.name === 'pmAdvancedProjects'
      );
      if (advancedItem) {
        setActiveItem('pmAdvancedProjects');
        setIsProjectManagementOpen(false);
        setIsDashboardOpen(false);
        document.title = advancedItem.label;
        return;
      }
    } else if (itemName === "media-management" && subItemName) {
      // ✅ البحث عن العنصر المنفصل الذي يطابق المسار لصفحات الإعلام
      const mediaItem = filteredSidebarItems.find(
        (item) => item.route === subItemName && item.name?.startsWith('media')
      );
      if (mediaItem) {
        setActiveItem(mediaItem.name);
        setIsProjectManagementOpen(true);
        setIsDashboardOpen(false);
        document.title = mediaItem.label;
        return;
      }
      // إذا لم يكن عنصر منفصل، استخدم المنطق القديم
      setActiveItem(`media-management/${subItemName}`);
      setIsProjectManagementOpen(true);
      setIsDashboardOpen(false);
    } else {
      // ✅ إذا كان العنصر له route مباشر (مثل project-management مع route: 'dashboard')
      const currentItem = filteredSidebarItems.find((item) => item.name === itemName);
      if (currentItem && currentItem.route && !subItemName) {
        // للعناصر المنفصلة مثل orphan-groupings, statistics, orphans
        if (itemName === 'orphan-groupings' || itemName === 'statistics' || itemName === 'orphans' || itemName === 'myMontageProjects') {
          setActiveItem(itemName);
        } else {
          setActiveItem(`${itemName}/${currentItem.route}`);
        }
      } else {
        setActiveItem(itemName);
      }
      setIsProjectManagementOpen(itemName === "project-management" || itemName === "media-management");
      setIsWarehouseOpen(false);
      setIsSurplusOpen(false);
    }

    // ✅ تحديث العنوان للصفحات التي لم يتم التعامل معها في الشروط السابقة
    const currentItem = filteredSidebarItems.find((item) => item.name === itemName);
    if (currentItem) {
      if (subItemName) {
        // ✅ للصفحات التي لها عناصر منفصلة (مثل media-management)، ابحث عن العنصر مباشرة
        if (itemName === "media-management") {
          const mediaItem = filteredSidebarItems.find(
            (item) => item.route === subItemName && item.name?.startsWith('media')
          );
          if (mediaItem) {
            document.title = mediaItem.label;
          } else {
            document.title = currentItem.label;
          }
        } else {
          // ✅ للصفحات التي لها subItems (مثل project-management)
          const subItem = currentItem.subItems?.find(
            (sub) => sub.route === subItemName
          );
          document.title = subItem ? subItem.label : currentItem.label;
        }
      } else {
        document.title = currentItem.label;
      }
    }
  }, [location.pathname, filteredSidebarItems]);

  const handleClick = (itemName, subItemName = null) => {
    if (itemName === "project-management") {
      setIsProjectManagementOpen(!isProjectManagementOpen);
      setIsDashboardOpen(false);
      if (subItemName) {
        setActiveItem(`project-management/${subItemName}`);
      } else {
        setActiveItem("project-management");
      }
    } else if (itemName === "media-management") {
      setIsProjectManagementOpen(!isProjectManagementOpen);
      setIsDashboardOpen(false);
      if (subItemName) {
        setActiveItem(`media-management/${subItemName}`);
        // ✅ البحث عن العنصر المنفصل الذي يطابق المسار لصفحات الإعلام
        const mediaItem = filteredSidebarItems.find(
          (item) => item.route === subItemName && item.name?.startsWith('media')
        );
        if (mediaItem) {
          document.title = mediaItem.label;
        }
      } else {
        setActiveItem("media-management");
      }
    } else if (itemName === "warehouse") {
      setIsWarehouseOpen(!isWarehouseOpen);
      setIsSurplusOpen(false);
      setIsDashboardOpen(false);
      setIsProjectManagementOpen(false);
      if (subItemName) {
        setActiveItem(`warehouse/${subItemName}`);
      } else {
        setActiveItem("warehouse");
      }
    } else if (itemName === "surplus") {
      setIsSurplusOpen(!isSurplusOpen);
      setIsWarehouseOpen(false);
      setIsDashboardOpen(false);
      setIsProjectManagementOpen(false);
      if (subItemName) {
        setActiveItem(`surplus/${subItemName}`);
      } else {
        setActiveItem("surplus");
      }
    } else {
      setActiveItem(itemName);
      setIsDashboardOpen(false);
      setIsProjectManagementOpen(false);
      setIsWarehouseOpen(false);
      setIsSurplusOpen(false);
    }

    const item = filteredSidebarItems.find((item) => item.name === itemName);
    if (subItemName) {
      // ✅ للصفحات التي لها عناصر منفصلة (مثل media-management)، ابحث عن العنصر مباشرة
      if (itemName === "media-management") {
        const mediaItem = filteredSidebarItems.find(
          (item) => item.route === subItemName && item.name?.startsWith('media')
        );
        if (mediaItem) {
          document.title = mediaItem.label;
        } else if (item) {
          document.title = item.label;
        }
      } else {
        // ✅ للصفحات التي لها subItems (مثل project-management)
        const subItem = item?.subItems?.find((sub) => sub.route === subItemName);
        document.title = subItem ? subItem.label : item?.label || '';
      }
    } else {
      document.title = item?.label || '';
    }
  };

  return (
    <>
      {/* Overlay for mobile */ }
      { isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300"
          onClick={ toggleSidebar }
        />
      ) }

      <aside
        className={ `fixed top-0 right-0 z-40 h-screen w-72 transition-all duration-300 transform ${isOpen ? "translate-x-0" : "translate-x-full"
          }` }
      >
        <div className="h-full bg-white/95 backdrop-blur-xl border-l border-sky-100 shadow-2xl">
          <div className=" p-6 relative overflow-hidden">
            {/* Animated background circles */ }
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-xl animate-pulse"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-orange-300/20 rounded-full blur-xl animate-pulse animation-delay-1000"></div>

            <div className="relative flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                القائمة الرئيسية
              </h2>
              <button
                onClick={ toggleSidebar }
                className="lg:hidden p-2 rounded-xl bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all duration-300 group"
              >
                <X className="w-5 h-5 text-white group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>
          </div>

          {/* Menu Items */ }
          <div className="p-4 overflow-y-auto h-[calc(100%-120px)]">
            { filteredSidebarItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <p className="text-lg font-medium">قسم الإعلام</p>
                <p className="text-sm mt-2">سيتم إضافة الأقسام قريباً</p>
              </div>
            ) : (
              <ul className="space-y-2">
                { filteredSidebarItems.map((item) => {
                  // إذا كان العنصر يحتوي على subItems، نعرضه كقائمة منسدلة
                  if (item.subItems) {
                    const isOpen = item.name === "warehouse" ? isWarehouseOpen :
                      item.name === "surplus" ? isSurplusOpen :
                        item.name === "project-management" ? isProjectManagementOpen :
                          item.name === "media-management" ? isProjectManagementOpen :
                            false;

                    return (
                      <li key={ item.name }>
                        {/* عنوان القسم الرئيسي - قابل للنقر */ }
                        <button
                          onClick={ () => handleClick(item.name) }
                          className={ `w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-300
                            ${isOpen || activeItem === item.name
                              ? "bg-gradient-to-r from-sky-400 to-sky-500 text-white shadow-lg"
                              : "text-gray-700 hover:bg-sky-50 hover:text-sky-600"
                            }` }
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={ `p-2 rounded-xl transition-all duration-300
                                ${isOpen || activeItem === item.name
                                  ? "bg-white/20"
                                  : "bg-gray-100"
                                }` }
                            >
                              { item.icon }
                            </div>
                            <span className="font-semibold">{ item.label }</span>
                          </div>
                          {/* سهم الفتح/الإغلاق */ }
                          <svg
                            className={ `w-5 h-5 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}` }
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* القائمة المنسدلة */ }
                        { isOpen && (
                          <ul className="mt-2 mr-4 space-y-1">
                            { item.subItems.map((subItem) => {
                              // التحقق من الصلاحيات - إخفاء العناصر المخصصة للمدير فقط
                              const userRole = user?.role?.toLowerCase?.() ||
                                user?.userRole?.toLowerCase?.() ||
                                user?.user_role?.toLowerCase?.() ||
                                user?.role_name?.toLowerCase?.() ||
                                user?.role || '';

                              const isAdmin = userRole === 'admin' ||
                                userRole === 'administrator' ||
                                userRole === 'مدير' ||
                                userRole === 'مدير عام';

                              // إخفاء العناصر المخصصة للمدير فقط إذا لم يكن المستخدم مدير
                              if (subItem.adminOnly && !isAdmin) {
                                return null;
                              }

                              // بناء المسار بشكل صحيح
                              const getRoute = () => {
                                if (item.name === "warehouse" || item.name === "surplus") {
                                  return `/${subItem.route}`;
                                }
                                return `/${item.name}/${subItem.route}`;
                              };

                              const routePath = getRoute();
                              const activePath = item.name === "warehouse" || item.name === "surplus"
                                ? subItem.route
                                : `${item.name}/${subItem.route}`;

                              return (
                                <li key={ subItem.name }>
                                  <Link
                                    to={ routePath }
                                    className={ `relative flex items-center p-2.5 rounded-xl transition-all duration-300 group
                                      ${activeItem === activePath || location.pathname === routePath
                                        ? "bg-sky-100 text-sky-700 font-medium"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                                      }` }
                                    onClick={ () => handleClick(item.name, subItem.route) }
                                  >
                                    <div className="w-2 h-2 rounded-full bg-current mr-3"></div>
                                    <span className="text-sm">{ subItem.label }</span>
                                  </Link>
                                </li>
                              );
                            }) }
                          </ul>
                        ) }
                      </li>
                    );
                  }

                  // العناصر بدون subItems تظهر بشكل عادي
                  return (
                    <li
                      key={ item.name }
                      onMouseEnter={ () => setHoveredItem(item.name) }
                      onMouseLeave={ () => setHoveredItem(null) }
                      className="relative"
                    >
                      <Link
                        to={ item.route
                          ? (item.name?.startsWith('pm')
                            ? `/project-management/${item.route}`
                            : item.name?.startsWith('media') || item.name === 'myMontageProjects'
                              ? `/media-management/${item.route}`
                              : item.name?.startsWith('supervision')
                                ? `/supervision/${item.route}`
                                : item.name?.startsWith('surplus')
                                  ? `/surplus/${item.route}`
                                  : item.name === 'statistics' || item.name === 'orphans' || item.name === 'orphan-groupings' || item.name === 'forms-control'
                                    ? `/${item.route}`
                                    : item.name?.endsWith('Statistics')
                                      ? `/statistics/${item.route}`
                                      : `/${item.name}/${item.route}`)
                          : `/${item.name}`
                        }
                        className={ `relative flex items-center p-3 rounded-2xl transition-all duration-300 group
                          ${activeItem === item.name || (item.route && activeItem === `${item.name}/${item.route}`) || location.pathname === (item.name?.startsWith('media') || item.name === 'myMontageProjects' ? `/media-management/${item.route}` : item.name?.startsWith('supervision') ? `/supervision/${item.route}` : item.name === 'statistics' || item.name === 'orphans' || item.name === 'orphan-groupings' || item.name === 'forms-control' ? `/${item.route}` : item.route ? (item.name?.startsWith('pm') ? `/project-management/${item.route}` : `/${item.name}/${item.route}`) : `/${item.name}`)
                            ? "bg-gradient-to-r from-sky-400 to-sky-500 text-white shadow-lg shadow-sky-200 transform scale-105"
                            : hoveredItem === item.name
                              ? "bg-sky-50 text-sky-600 transform scale-102"
                              : "text-gray-700 hover:bg-gray-50"
                          }` }
                        onClick={ () => {
                          if (item.name?.startsWith('pm') || item.name?.startsWith('media') || item.name?.startsWith('supervision') || item.name === 'statistics' || item.name === 'orphans' || item.name === 'orphan-groupings' || item.name === 'myMontageProjects' || item.name === 'pmAdvancedProjects') {
                            // للعناصر المنفصلة في دور الإدارة والإعلام والإشراف والإحصائيات والأيتام
                            setActiveItem(item.name);
                            setIsProjectManagementOpen(false);
                            setIsDashboardOpen(false);
                          } else {
                            handleClick(item.name, item.route);
                          }
                        } }
                      >
                        <div
                          className={ `p-2 rounded-xl transition-all duration-300
                            ${activeItem === item.name
                              ? "bg-white/20"
                              : hoveredItem === item.name
                                ? "bg-sky-100"
                                : "bg-gray-100"
                            }` }
                        >
                          { item.icon }
                        </div>
                        <span className="mr-3 font-medium">{ item.label }</span>

                        {/* Hover indicator */ }
                        { hoveredItem === item.name &&
                          activeItem !== item.name && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-sky-400 to-orange-400 rounded-r-full transition-all duration-300"></div>
                          ) }
                      </Link>
                    </li>
                  );
                }) }
              </ul>
            ) }
          </div>
        </div>
      </aside>
    </>
  );
};

export default React.memo(Sidebar);
