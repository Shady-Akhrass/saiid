import { useState, useEffect, useRef } from "react";
import LogoImage from "../assets/images/logo.jpg";
import { UsersRound, Utensils, Baby, Building2, HandHeart, Home, HeartPulse, User, Handshake, House, Hospital } from 'lucide-react';
import apiClient from "../utils/axiosConfig";


// Custom Hooks
const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  return [ref, isIntersecting];
};

const useMousePosition = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return mousePosition;
};

// Components
const Logo = () => (
  <div className="flex items-center justify-center">
    <div className="relative group">
      <div className="absolute inset-0 bg-gradient-to-r from-sky-400 to-blue-400 rounded-full blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500 animate-pulse"></div>
      <img
        src={ LogoImage }
        alt="جمعية ساعد - Saiid Organization Logo"
        className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full object-cover shadow-2xl ring-4 ring-white/50 transform transition-transform duration-500 group-hover:scale-110"
      />
    </div>
  </div>
);

const AnimatedBackground = () => {
  const mousePosition = useMousePosition();

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Gradient Mesh Background */ }
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fed7aa" stopOpacity="0.2">
              <animate
                attributeName="stop-color"
                values="#fed7aa;#fbbf24;#fed7aa"
                dur="10s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.2">
              <animate
                attributeName="stop-color"
                values="#dbeafe;#60a5fa;#dbeafe"
                dur="10s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="20" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#gradient1)" />
        <circle
          cx={ mousePosition.x }
          cy={ mousePosition.y }
          r="150"
          fill="rgba(251, 191, 36, 0.1)"
          filter="url(#glow)"
          className="transition-all duration-1000 ease-out"
        />
      </svg>

      {/* Floating Particles */ }
      { [...Array(20)].map((_, i) => (
        <div
          key={ i }
          className="absolute animate-float"
          style={ {
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 10}s`,
            animationDuration: `${10 + Math.random() * 20}s`,
          } }
        >
          <div
            className={ `w-${Math.random() > 0.5 ? "2" : "3"} h-${Math.random() > 0.5 ? "2" : "3"
              } bg-gradient-to-br from-orange-300 to-sky-300 rounded-full opacity-40 blur-sm` }
          ></div>
        </div>
      )) }
    </div>
  );
};

const StatCounter = ({ end, duration = 2000, suffix = "" }) => {
  const [count, setCount] = useState(0);
  const [ref, isIntersecting] = useIntersectionObserver({ threshold: 0.5 });

  useEffect(() => {
    if (isIntersecting) {
      let start = 0;
      const increment = end / (duration / 16);
      const timer = setInterval(() => {
        start += increment;
        if (start > end) {
          setCount(end);
          clearInterval(timer);
        } else {
          setCount(Math.floor(start));
        }
      }, 16);
      return () => clearInterval(timer);
    }
  }, [isIntersecting, end, duration]);

  return (
    <span
      ref={ ref }
      className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-sky-600"
    >
      { count.toLocaleString("ar-EG") }
      { suffix }
    </span>
  );
};

const ServiceCard = ({ form, index, isVisible }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [ref, isIntersecting] = useIntersectionObserver({ threshold: 0.3 });
  const cardRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    cardRef.current.style.setProperty("--mouse-x", `${x}px`);
    cardRef.current.style.setProperty("--mouse-y", `${y}px`);
  };

  return (
    <div
      ref={ ref }
      onClick={ () => (window.location.href = form.path) }
      className={ `group block transition-all duration-700 cursor-pointer transform ${isIntersecting
        ? "opacity-100 translate-y-0 rotate-0"
        : "opacity-0 translate-y-8 rotate-1"
        }` }
      style={ { transitionDelay: `${index * 100}ms` } }
      onMouseEnter={ () => setIsHovered(true) }
      onMouseLeave={ () => setIsHovered(false) }
      onMouseMove={ handleMouseMove }
    >
      <div
        ref={ cardRef }
        className="relative bg-white/90 backdrop-blur-xl rounded-3xl border border-sky-200/50 h-[450px] transition-all duration-500 hover:scale-105 hover:shadow-2xl shadow-lg hover:shadow-sky-300/50 flex flex-col group-hover:border-sky-300/70"
        style={ {
          background: isHovered
            ? `radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(14, 165, 233, 0.05), transparent 40%)`
            : "",
        } }
      >
        {/* Animated Border Gradient */ }
        <div className="absolute inset-0 rounded-3xl p-[1px] bg-gradient-to-r from-transparent via-sky-400/0 to-transparent group-hover:via-sky-400/50 transition-all duration-700"></div>

        {/* Card Header with Parallax Effect */ }
        <div
          className={ `relative bg-gradient-to-br ${form.gradient} h-[180px] p-6 text-white text-center flex flex-col justify-center rounded-t-3xl` }
        >
          {/* Animated Background Shapes */ }
          <div className="absolute inset-0">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-pulse"></div>
            <div
              className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-2xl animate-pulse"
              style={ { animationDelay: "1s" } }
            ></div>
            <div
              className={ `absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-t from-black/20 to-transparent` }
            ></div>
          </div>

          {/* Icon with Advanced Animation */ }
          <div className="relative z-10">
            <div
              className={ `text-5xl mb-3 transform transition-all duration-500 ${isHovered ? "scale-125 rotate-12 translate-y-[-5px]" : ""
                }` }
            >
              <span
                className="inline-block animate-bounce"
                style={ { animationDelay: `${index * 200}ms` } }
              >
                { form.icon }
              </span>
            </div>
            <h3 className="text-lg font-bold mb-1 px-2 transform transition-all duration-300 group-hover:scale-105">
              { form.title }
            </h3>
            <h4 className="text-sm opacity-90 font-medium px-2 transform transition-all duration-300 group-hover:translate-y-[-2px]">
              { form.titleEn }
            </h4>
          </div>

          {/* Sparkle Effects */ }
          { isHovered && (
            <>
              <div className="absolute top-4 right-4 w-1 h-1 bg-white rounded-full animate-ping"></div>
              <div
                className="absolute bottom-8 left-8 w-1 h-1 bg-white rounded-full animate-ping"
                style={ { animationDelay: "0.5s" } }
              ></div>
            </>
          ) }
        </div>

        {/* Card Body */ }
        <div className="relative px-6 py-6 flex-1 flex flex-col justify-between">
          {/* Description with Fade Animation */ }
          <div className="text-center min-h-[100px] flex flex-col justify-center transform transition-all duration-500 group-hover:translate-y-[-4px]">
            <p className="text-sky-700 font-medium text-sm leading-relaxed mb-2">
              { form.description }
            </p>
            <p className="text-sky-600/70 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              { form.descriptionEn }
            </p>
          </div>

          {/* Animated Stats Badge */ }
          <div className="flex justify-center h-[40px] items-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-orange-500 rounded-full blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500"></div>
              <div className="relative bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 px-4 py-2 rounded-full text-xs font-medium border border-orange-200 transform transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                  { form.stats }
                </span>
              </div>
            </div>
          </div>

          {/* Premium CTA Button */ }
          <div className="flex justify-center w-full h-[50px] items-center">
            <button className="relative group/btn overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-sky-600 to-blue-600 rounded-2xl transition-transform duration-500 group-hover/btn:scale-110"></div>
              <div
                className={ `relative inline-flex items-center px-6 py-3 bg-gradient-to-r ${form.gradient} text-white rounded-2xl font-medium shadow-lg transform transition-all duration-500 group-hover:shadow-2xl` }
              >
                <span className="relative z-10">ابدأ الآن</span>
                <svg
                  className="w-4 h-4 mr-2 transform transition-all duration-300 group-hover:translate-x-2 group-hover:scale-110"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={ 2 }
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500 bg-gradient-to-t from-white/20 to-transparent"></div>
              </div>
            </button>
          </div>
        </div>

        {/* Hover Glow Effect */ }
        <div
          className={ `absolute inset-0 rounded-3xl transition-opacity duration-500 pointer-events-none ${isHovered ? "opacity-100" : "opacity-0"
            }` }
        >
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-sky-400/10 via-transparent to-blue-400/10"></div>
        </div>
      </div>
    </div>
  );
};

function Index() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const mousePosition = useMousePosition();

  useEffect(() => {
    setIsVisible(true);

    // Add smooth scroll behavior
    document.documentElement.style.scrollBehavior = "smooth";

    return () => {
      document.documentElement.style.scrollBehavior = "auto";
    };
  }, []);

  const [stats, setStats] = useState({
    orphans: 0,
    aids: 0,
    shelters: 0,
    patients: 0,
  });

  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingStats(true);
      try {
        // ✅ استخدام apiClient ليمر الطلب عبر الـ proxy في التطوير (يتجنب CORS)
        const response = await apiClient.get('/statistics');

        // Handle 429 (Too Many Requests) - silently fail for stats
        if (response.status === 429) {
          console.warn('Rate limited when fetching statistics');
          setIsLoadingStats(false);
          return;
        }

        if (response.status < 200 || response.status >= 300) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = response.data;

        // Check if the response was successful
        if (result.success && result.data) {
          // Extract only the counts we need from the statistics
          setStats({
            orphans: result.data.orphans || 0,
            aids: result.data.aids || 0,
            shelters: result.data.shelters || 0,
            patients: result.data.patients || 0,
          });

          console.log("Statistics fetched successfully:", {
            orphans: result.data.orphans,
            aids: result.data.aids,
            shelters: result.data.shelters,
            patients: result.data.patients,
          });
        } else {
          throw new Error("Invalid response format");
        }
      } catch (error) {
        if (error.response?.status === 429) {
          console.warn('Rate limited when fetching statistics');
        } else {
          console.error("Error fetching statistics:", error);
        }
        setStats({
          orphans: 0,
          aids: 0,
          shelters: 0,
          patients: 0,
        });
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchData();
  }, []);

  // Forms array with proper stats display
  const forms = [
    {
      title: "نموذج الأيتام",
      titleEn: "Orphan Form",
      description: "تسجيل بيانات الأيتام ",
      descriptionEn: "Register orphan information and guardians",
      path: "/orphan-form",
      icon: <User className="w-12 h-12" />,
      gradient: "from-sky-400 via-sky-500 to-blue-600",
      shadow: "shadow-sky-500/30",
      stats: isLoadingStats ? (
        <span className="inline-flex items-center">
          <svg className="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            ></path>
          </svg>
          جاري التحميل...
        </span>
      ) : (
        `${stats.orphans.toLocaleString("ar-EG")} طفل مسجل`
      ),
      bgPattern: "from-sky-50 to-blue-50",
    },
    {
      title: "نموذج المساعدات",
      titleEn: "Aid Form",
      description: "تسجيل طلبات المساعدات المختلفة",
      descriptionEn: "Register various aid requests",
      path: "/aid-form",
      icon: <Handshake className="w-12 h-12" />,
      gradient: "from-cyan-400 via-cyan-500 to-teal-600",
      shadow: "shadow-cyan-500/30",
      stats: isLoadingStats ? (
        <span className="inline-flex items-center">
          <svg className="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            ></path>
          </svg>
          جاري التحميل...
        </span>
      ) : (
        `${stats.aids.toLocaleString("ar-EG")} طلب مساعدة`
      ),
      bgPattern: "from-cyan-50 to-teal-50",
    },
    {
      title: "نموذج مراكز النزوح",
      titleEn: "Shelter Form",
      description: "تسجيل بيانات مراكز النزوح",
      descriptionEn: "Register shelter information",
      path: "/shelter-form",
      icon: <House className="w-12 h-12" />,
      gradient: "from-blue-400 via-blue-500 to-indigo-600",
      shadow: "shadow-blue-500/30",
      stats: isLoadingStats ? (
        <span className="inline-flex items-center">
          <svg className="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            ></path>
          </svg>
          جاري التحميل...
        </span>
      ) : (
        `${stats.shelters.toLocaleString("ar-EG")} مركز نزوح`
      ),
      bgPattern: "from-blue-50 to-indigo-50",
    },
    {
      title: "مساعدات كبار السن المرضى",
      titleEn: "Elderly Patient Aid",
      description: "تسجيل بيانات المرضى من كبار السن",
      descriptionEn: "Register elderly patient information",
      path: "/patient-form",
      icon: <Hospital className="w-12 h-12" />,
      gradient: "from-teal-400 via-teal-500 to-emerald-600",
      shadow: "shadow-teal-500/30",
      stats: isLoadingStats ? (
        <span className="inline-flex items-center">
          <svg className="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            ></path>
          </svg>
          جاري التحميل...
        </span>
      ) : (
        `${stats.patients.toLocaleString("ar-EG")} مريض مسن`
      ),
      bgPattern: "from-teal-50 to-emerald-50",
    },
  ];

  const impactStats = [
    {
      number: 174038,
      label: "عائلة مستفيدة",
      labelEn: "Families Helped",
      icon: UsersRound,
      gradient: "from-blue-500 to-blue-600",
      bgGradient: "from-blue-50 to-blue-100",
      iconBg: "bg-blue-100",
      textColor: "text-blue-600",
    },
    {
      number: 70500,
      label: "وجبة موزعة",
      labelEn: "Meals Distributed",
      icon: Utensils,
      gradient: "from-green-500 to-green-600",
      bgGradient: "from-green-50 to-green-100",
      iconBg: "bg-green-100",
      textColor: "text-green-600",
    },
    {
      number: 27847,
      label: "طفل مدعوم",
      labelEn: "Children Supported",
      icon: Baby,
      gradient: "from-pink-500 to-pink-600",
      bgGradient: "from-pink-50 to-pink-100",
      iconBg: "bg-pink-100",
      textColor: "text-pink-600",
    },
    {
      number: 2430,
      label: "مشروع إيواء نشط",
      labelEn: "Active Shelter Projects",
      icon: Building2,
      gradient: "from-purple-500 to-purple-600",
      bgGradient: "from-purple-50 to-purple-100",
      iconBg: "bg-purple-100",
      textColor: "text-purple-600",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-sky-50 relative">
      {/* Advanced Animated Background */ }
      <AnimatedBackground />

      {/* Custom CSS for Animations */ }
      <style>{ `
        @keyframes float {
          0%,
          100% {
            transform: translateY(0) rotate(0deg);
          }
          25% {
            transform: translateY(-20px) rotate(5deg);
          }
          75% {
            transform: translateY(20px) rotate(-5deg);
          }
        }

        @keyframes gradient-shift {
          0%,
          100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        .animate-float {
          animation: float linear infinite;
        }

        .gradient-animate {
          background-size: 200% 200%;
          animation: gradient-shift 15s ease infinite;
        }
      `}</style>

      {/* Hero Section with Parallax */ }
      <div className="relative">
        {/* Premium Glass Header */ }
        <div className="relative bg-gradient-to-b from-white/90 via-sky-50/70 to-transparent backdrop-blur-3xl">
          {/* Subtle animated gradient overlay */ }
          <div className="absolute inset-0 bg-gradient-to-r from-sky-400/5 via-blue-400/5 to-cyan-400/5 gradient-animate"></div>

          {/* Animated Mesh Pattern - Made more subtle */ }
          <div className="absolute inset-0 opacity-[0.03]">
            <svg className="w-full h-full">
              <pattern
                id="mesh"
                x="0"
                y="0"
                width="60"
                height="60"
                patternUnits="userSpaceOnUse"
              >
                <circle
                  cx="30"
                  cy="30"
                  r="1"
                  fill="currentColor"
                  className="text-sky-600"
                >
                  <animate
                    attributeName="r"
                    values="1;1.5;1"
                    dur="3s"
                    repeatCount="indefinite"
                  />
                </circle>
              </pattern>
              <rect width="100%" height="100%" fill="url(#mesh)" />
            </svg>
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
            <div
              className={ `text-center transition-all duration-1000 ${isVisible
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
                }` }
            >
              {/* Animated Logo Section - Improved spacing */ }
              <div className="mb-8 sm:mb-10 flex justify-center">
                <div className="relative group">
                  <div className="absolute -inset-6 sm:-inset-8 bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-400 rounded-full blur-2xl opacity-20 group-hover:opacity-30 transition-all duration-700 animate-pulse"></div>
                  <div className="relative transform transition-transform duration-500 group-hover:scale-105">
                    <Logo />
                  </div>
                </div>
              </div>

              {/* Organization Branding - Better hierarchy */ }
              <div className="mb-6 sm:mb-8 space-y-3">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-blue-600 to-sky-600 gradient-animate transform hover:scale-105 transition-transform duration-300 leading-normal py-1">
                  جمعية ساعد
                </h1>
                <a
                  href="https://saiid.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center relative group px-4 py-2 rounded-full hover:bg-orange-50 transition-colors duration-300"
                  title="زيارة الموقع الرسمي لجمعية ساعد"
                >
                  <span className="text-orange-500 hover:text-orange-600 transition-all duration-300 text-base sm:text-lg font-semibold">
                    <span className="relative">
                      saiid.org
                      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-orange-500 group-hover:w-full transition-all duration-300"></span>
                    </span>
                  </span>
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 ml-2 text-orange-500 transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={ 2 }
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>

              {/* Main Title - Improved spacing and responsiveness */ }
              <div className="space-y-4 sm:space-y-6 mb-8 sm:mb-10 lg:mb-12">
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black leading-tight">
                  <span className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-sky-700 via-blue-600 to-sky-700 gradient-animate transform hover:scale-105 transition-transform duration-500 py-2 sm:py-3 lg:py-4 leading-normal">
                    مركز المساعدات
                  </span>
                </h1>
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-blue-500 to-cyan-600 opacity-90 py-1 sm:py-2">
                  Assistance Center
                </h2>
              </div>

              {/* Description - Better readability */ }
              <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4 mb-8 sm:mb-10 lg:mb-12 px-4">
                <p className="text-base sm:text-lg lg:text-xl text-sky-700 leading-relaxed font-semibold animate-fade-in">
                  منصة شاملة وحديثة لتقديم المساعدات والدعم للمحتاجين والمتضررين
                  من الحرب
                </p>
                <p
                  className="text-sm sm:text-base lg:text-lg text-sky-600/70 leading-relaxed animate-fade-in"
                  style={ { animationDelay: "0.2s" } }
                >
                  A comprehensive modern platform providing aid and support to
                  those in need and war victims
                </p>
              </div>

              {/* Interactive Divider - Enhanced */ }
              <div className="flex items-center justify-center py-4 sm:py-6">
                <div className="flex items-center gap-3 sm:gap-4 lg:gap-6">
                  { [...Array(5)].map((_, i) => (
                    <div key={ i } className="relative group">
                      <div
                        className="w-2 h-2 sm:w-3 sm:h-3 bg-gradient-to-r from-sky-400 to-blue-400 rounded-full animate-pulse transform transition-transform duration-300 group-hover:scale-150"
                        style={ {
                          animationDelay: `${i * 0.2}s`,
                          animationDuration: "2s",
                        } }
                      ></div>
                      {/* Glow effect on hover */ }
                      <div className="absolute inset-0 bg-sky-400 rounded-full blur-md opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>
                    </div>
                  )) }
                </div>
              </div>

            </div>
          </div>

          {/* Subtle bottom border gradient */ }
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-200 to-transparent"></div>
        </div>
      </div>

      {/* Impact Statistics Section */ }
      <div className="relative max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          { impactStats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div
                key={ index }
                className={ `group text-center transform transition-all duration-700 hover:scale-110 ${isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-8"
                  }` }
                style={ { transitionDelay: `${index * 100}ms` } }
              >
                {/* Icon Container with Gradient */ }
                <div className="relative inline-flex mb-4">
                  {/* Animated background glow */ }
                  <div className={ `absolute inset-0 bg-gradient-to-br ${stat.gradient} rounded-2xl blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-500` }></div>

                  {/* Icon */ }
                  <div className={ `relative p-4 rounded-2xl bg-gradient-to-br ${stat.gradient} transform group-hover:rotate-6 transition-all duration-300` }>
                    <IconComponent className="w-8 h-8 text-white" strokeWidth={ 2.5 } />
                  </div>
                </div>

                {/* Number with Gradient */ }
                <div className={ `text-4xl font-bold mb-2 bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent` }>
                  <StatCounter end={ stat.number } suffix="+" />
                </div>

                {/* Labels */ }
                <div className="text-sm font-semibold text-sky-800">
                  { stat.label }
                </div>
                <div className="text-xs text-sky-600/70 mt-1">
                  { stat.labelEn }
                </div>
              </div>
            );
          }) }
        </div>
      </div>

      {/* Main Services Section - FIXED */ }
      <div className="relative max-w-7xl mx-auto px-6 py-20">
        {/* Animated Section Header - FIXED */ }
        <div
          className={ `text-center mb-16 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
            }` }
        >
          <div className="inline-flex items-center bg-gradient-to-r from-sky-100 to-blue-100 backdrop-blur-xl border border-sky-300/50 text-sky-700 px-8 py-3 rounded-full text-sm font-semibold mb-8 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <span className="mr-3 text-lg animate-pulse">📄</span>
            <span className="mx-2">النماذج المتاحة</span>
            <span className="border-l border-sky-300/50 pl-3 ml-3">
              Available Forms
            </span>
          </div>
          <h3 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-800 via-blue-700 to-sky-800 mb-6 gradient-animate py-4 leading-normal">
            اختر نوع المساعدة
          </h3>
          <h4 className="text-2xl md:text-3xl font-bold text-sky-600 mb-8">
            Choose Your Aid Type
          </h4>
          <p className="text-lg text-sky-700/80 max-w-3xl mx-auto leading-relaxed">
            نحن هنا لمساعدتك. سجل في النموذج الذي يناسبك
          </p>
        </div>

        {/* Premium Service Cards Grid */ }
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          { forms.map((form, index) => (
            <ServiceCard
              key={ index }
              form={ form }
              index={ index }
              isVisible={ isVisible }
            />
          )) }
        </div>

        {/* Quick Access Links Section */ }
        <div className="mt-12 opacity-100 translate-y-0">
          <div className="text-center mb-8">
            <h3 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-700 to-pink-700 mb-2">
              رابط سريع للتسجيل
            </h3>
            <p className="text-lg text-rose-600/80">
              نموذج العلاج الطبي للأيتام المرضى
            </p>
          </div>

          <div className="flex justify-center max-w-2xl mx-auto">
            {/* Medical Treatment Form Quick Link */ }
            <a
              href="/medical-treatment-form"
              className="group block bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-rose-200/50 p-8 hover:shadow-2xl hover:border-rose-400/70 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 w-full"
            >
              <div className="flex flex-col items-center text-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-rose-400 to-pink-500 rounded-2xl blur-xl opacity-50 group-hover:opacity-70 transition-opacity duration-300"></div>
                  <div className="relative p-5 bg-gradient-to-br from-rose-400 to-pink-500 rounded-2xl shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-white">
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
                      <path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08v0c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"></path>
                      <path d="M18 15v4"></path>
                      <path d="M16 17h4"></path>
                    </svg>
                  </div>
                </div>
                <div>
                  <h4 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent mb-2">
                    طلب تسجيل الأيتام للعلاج الطبي
                  </h4>
                  <p className="text-rose-600/70 text-sm mb-3">
                    تسجيل بيانات الأطفال الأيتام المحتاجين للعلاج الطبي والرعاية الصحية
                  </p>
                  <div className="inline-flex items-center gap-2 text-rose-600 font-medium group-hover:text-rose-700 transition-colors">
                    <span>انتقل إلى النموذج</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 transform group-hover:translate-x-1 transition-transform">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
            </a>
          </div>
        </div>

        {/* Premium Footer Section */ }
        <div
          className={ `mt-24 transition-all duration-1000 ${isVisible ? "opacity-100" : "opacity-0"
            }` }
        >
          <div className="relative bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 backdrop-blur-2xl rounded-3xl p-12 border border-sky-200/50 shadow-2xl">
            {/* Animated Background Pattern */ }
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-sky-300 to-blue-300 rounded-full blur-3xl animate-pulse"></div>
              <div
                className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-br from-cyan-300 to-teal-300 rounded-full blur-3xl animate-pulse"
                style={ { animationDelay: "2s" } }
              ></div>
            </div>

            <div className="relative text-center">
              {/* Animated Heart Icon */ }
              <div className="flex items-center justify-center mb-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-pink-400 rounded-full blur-xl opacity-40 animate-pulse"></div>
                  <div className="relative text-5xl animate-bounce">💙</div>
                </div>
              </div>

              <h3 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-700 to-blue-700 mb-4">
                نحن معك في كل خطوة
              </h3>
              <p className="text-xl text-sky-600 mb-2">
                We&apos;re with you every step of the way
              </p>
              <p className="text-lg text-sky-600/80 mb-8">
                للمساعدة أو الاستفسارات، تواصل مع فريق الدعم
              </p>

              {/* Contact Cards */ }
              <div className="flex flex-wrap justify-center gap-4">
                { [
                  {
                    icon: "📧",
                    text: "info@saiid.org",
                    href: "mailto:info@saiid.org",
                  },
                  {
                    icon: "📱",
                    text: "+972 56-769-7164",
                    href: "tel:+972567697164",
                  },
                  { icon: "🌐", text: "saiid.org", href: "https://saiid.org" },
                ].map((contact, index) => (
                  <a
                    key={ index }
                    href={ contact.href }
                    className="group px-6 py-3 bg-white/80 backdrop-blur-sm rounded-full text-sky-700 text-sm font-medium border border-sky-200 hover:bg-gradient-to-r hover:from-sky-50 hover:to-blue-50 hover:border-sky-300 hover:shadow-lg transform hover:scale-105 transition-all duration-300"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-lg group-hover:animate-bounce">
                        { contact.icon }
                      </span>
                      <span>{ contact.text }</span>
                    </span>
                  </a>
                )) }
              </div>

              {/* Trust Badges */ }
              <div className="mt-10 flex justify-center items-center gap-8 flex-wrap">
                { ["توثيق رسمي", "دعم 24/7", "خصوصية تامة"].map(
                  (badge, index) => (
                    <div
                      key={ index }
                      className="flex items-center gap-2 text-sky-600 text-sm font-medium opacity-80"
                    >
                      <svg
                        className="w-5 h-5 text-green-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>{ badge }</span>
                    </div>
                  )
                ) }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll to Top Button */ }
      <button
        onClick={ () => window.scrollTo({ top: 0, behavior: "smooth" }) }
        className="fixed bottom-8 right-8 p-4 bg-gradient-to-r from-sky-500 to-blue-500 text-white rounded-full shadow-2xl hover:shadow-sky-500/50 transform hover:scale-110 transition-all duration-300 z-50 group"
        style={ { display: isVisible ? "block" : "none" } }
      >
        <svg
          className="w-6 h-6 group-hover:animate-bounce"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={ 2 }
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      </button>
    </div>
  );
}

export default Index;
