// import React, { useState, useEffect, useRef } from 'react';
// import axios from 'axios';
// import { Bar } from 'react-chartjs-2';
// import {
//     Chart as ChartJS,
//     CategoryScale,
//     LinearScale,
//     BarElement,
//     Title,
//     Tooltip,
//     Legend,
// } from 'chart.js';

// ChartJS.register(
//     CategoryScale,
//     LinearScale,
//     BarElement,
//     Title,
//     Tooltip,
//     Legend
// );

// const Dashboard = () => {
//     const [data, setData] = useState({
//         students: {
//             totalStudents: 0,
//             totalVisitors: 0,
//             genderCounts: {},
//             academicStageCounts: {},
//             studentAgeGroups: {},
//         },
//         teachers: {
//             totalTeachers: 0,
//             totalVisitors: 0,
//             maritalStatusCounts: {},
//             universityMajorCounts: {},
//             teacherAgeGroups: {},
//         },
//     });
//     const [isLoading, setIsLoading] = useState(true);

//     const chartRef = useRef(null);

//     useEffect(() => {
//         const fetchDashboardData = async () => {
//             setIsLoading(true);
//             try {
//                 const token = localStorage.getItem('token') || sessionStorage.getItem('token');
//                 const headers = { 'Authorization': `Bearer ${token}` };

//                 const studentsResponse = await axios.get('https://forms-api.saiid.org/api/students/dashboard', { headers });
//                 const teachersResponse = await axios.get('https://forms-api.saiid.org/api/teachers/dashboard', { headers });

//                 const studentsData = studentsResponse.data;
//                 const teachersData = teachersResponse.data;

//                 setData({ students: studentsData, teachers: teachersData });
//             } catch (error) {
//                 console.error('Error fetching dashboard data:', error);
//             } finally {
//                 setIsLoading(false);
//             }
//         };

//         fetchDashboardData();
//     }, []);

//     const createGradient = (context, color1, color2) => {
//         const chart = context.chart;
//         const { ctx, chartArea } = chart;
//         if (!chartArea) return color1;
//         const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
//         gradient.addColorStop(0, color1);
//         gradient.addColorStop(1, color2);
//         return gradient;
//     };

//     const generateChartData = (label, data, colorFunction) => ({
//         labels: Object.keys(data),
//         datasets: [{
//             label,
//             data: Object.values(data),
//             backgroundColor: (context) => {
//                 return Object.keys(data).map((_, i) =>
//                     createGradient(context, colorFunction(i)[0], colorFunction(i)[1])
//                 );
//             },
//             borderColor: '#fff',
//             borderWidth: 2,
//             borderRadius: 5,
//             borderSkipped: false,
//         }],
//     });

//     const chartOptions = {
//         responsive: true,
//         plugins: {
//             legend: { position: 'top' },
//         },
//     };

//     const colorFunctions = {
//         gender: (i) => i === 0 ? ['#FF6384', '#FFA1B4'] : ['#36A2EB', '#7DC4FF'],
//         academicStage: (i) => [`hsl(${0 + i * 45}, 70%, 60%)`, `hsl(${0 + i * 45}, 70%, 40%)`],
//         ageGroup: (i) => [`hsl(${120 + i * 30}, 70%, 60%)`, `hsl(${120 + i * 30}, 70%, 40%)`],
//         maritalStatus: (i) => [`hsl(${270 + i * 45}, 70%, 60%)`, `hsl(${270 + i * 45}, 70%, 40%)`],
//         universityMajor: (i) => [`hsl(${30 + i * 40}, 70%, 60%)`, `hsl(${30 + i * 40}, 70%, 40%)`],
//     };

//     return (
//         <div className="p-6 bg-gray-100 min-h-screen" dir="rtl">
//             <h1 className="text-4xl font-bold mb-8 text-gray-800 text-center">احصائيات المدرسة</h1>
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
//                 <div className="bg-white shadow-lg rounded-lg p-6 flex items-center justify-between">
//                     <div>
//                         <h2 className="text-2xl font-semibold text-gray-800 mb-2">إجمالي الطلاب</h2>
//                         {isLoading ? (
//                             <div className="h-10 w-24 bg-gray-300 animate-pulse rounded"></div>
//                         ) : (
//                             <p className="text-5xl font-bold text-blue-600">{data.students.totalStudents}</p>
//                         )}
//                     </div>
//                     <div className="text-6xl text-blue-200">👩‍🎓</div>
//                 </div>
//                 <div className="bg-white shadow-lg rounded-lg p-6 flex items-center justify-between">
//                     <div>
//                         <h2 className="text-2xl font-semibold text-gray-800 mb-2">زوار الطلاب</h2>
//                         {isLoading ? (
//                             <div className="h-10 w-24 bg-gray-300 animate-pulse rounded"></div>
//                         ) : (
//                             <p className="text-5xl font-bold text-green-600">{data.students.totalVisitors}</p>
//                         )}
//                     </div>
//                     <div className="text-6xl text-green-200">👥</div>
//                 </div>

//                 <div className="bg-white shadow-lg rounded-lg p-6 flex items-center justify-between">
//                     <div>
//                         <h2 className="text-2xl font-semibold text-gray-800 mb-2">إجمالي المعلمين</h2>
//                         {isLoading ? (
//                             <div className="h-10 w-24 bg-gray-300 animate-pulse rounded"></div>
//                         ) : (
//                             <p className="text-5xl font-bold text-blue-600">{data.teachers.totalTeachers}</p>
//                         )}
//                     </div>
//                     <div className="text-6xl text-blue-200">👨‍🏫</div>
//                 </div>
//                 <div className="bg-white shadow-lg rounded-lg p-6 flex items-center justify-between">
//                     <div>
//                         <h2 className="text-2xl font-semibold text-gray-800 mb-2">زوار المعلمين</h2>
//                         {isLoading ? (
//                             <div className="h-10 w-24 bg-gray-300 animate-pulse rounded"></div>
//                         ) : (
//                             <p className="text-5xl font-bold text-green-600">{data.teachers.totalVisitors}</p>
//                         )}
//                     </div>
//                     <div className="text-6xl text-green-200">👥</div>
//                 </div>
//             </div>

//             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//                 {isLoading ? (
//                     Array.from({ length: 6 }).map((_, i) => (
//                         <div key={i} className="bg-white shadow-lg rounded-lg p-4 h-96 animate-pulse">
//                             <div className="h-full w-full bg-gray-300 rounded"></div>
//                         </div>
//                     ))
//                 ) : (
//                     <>
//                         <div className="bg-white shadow-lg rounded-lg p-6">
//                             <h2 className="text-xl font-semibold mb-4 text-gray-800">جنس الطلاب</h2>
//                             <div className="h-80">
//                                 <Bar data={generateChartData('عدد الطلاب', data.students.genderCounts, colorFunctions.gender)} options={chartOptions} />
//                             </div>
//                         </div>

//                         <div className="bg-white shadow-lg rounded-lg p-6">
//                             <h2 className="text-xl font-semibold mb-4 text-gray-800">المراحل الدراسية</h2>
//                             <div className="h-80">
//                                 <Bar data={generateChartData('عدد الطلاب', data.students.academicStageCounts, colorFunctions.academicStage)} options={chartOptions} />
//                             </div>
//                         </div>

//                         <div className="bg-white shadow-lg rounded-lg p-6">
//                             <h2 className="text-xl font-semibold mb-4 text-gray-800">مجموعات أعمار الطلاب</h2>
//                             <div className="h-80">
//                                 <Bar data={generateChartData('عدد الطلاب', data.students.studentAgeGroups, colorFunctions.ageGroup)} options={chartOptions} />
//                             </div>
//                         </div>

//                         <div className="bg-white shadow-lg rounded-lg p-6">
//                             <h2 className="text-xl font-semibold mb-4 text-gray-800">الحالة الاجتماعية للمعلمين</h2>
//                             <div className="h-80">
//                                 <Bar data={generateChartData('عدد المعلمين', data.teachers.maritalStatusCounts, colorFunctions.maritalStatus)} options={chartOptions} />
//                             </div>
//                         </div>

//                         <div className="bg-white shadow-lg rounded-lg p-6">
//                             <h2 className="text-xl font-semibold mb-4 text-gray-800">تخصصات المعلمين الجامعية</h2>
//                             <div className="h-80">
//                                 <Bar data={generateChartData('عدد المعلمين', data.teachers.universityMajorCounts, colorFunctions.universityMajor)} options={chartOptions} />
//                             </div>
//                         </div>

//                         <div className="bg-white shadow-lg rounded-lg p-6">
//                             <h2 className="text-xl font-semibold mb-4 text-gray-800">مجموعات أعمار المعلمين</h2>
//                             <div className="h-80">
//                                 <Bar data={generateChartData('عدد المعلمين', data.teachers.teacherAgeGroups, colorFunctions.ageGroup)} options={chartOptions} />
//                             </div>
//                         </div>
//                     </>
//                 )}
//             </div>
//         </div>
//     );
// };

// export default Dashboard;
