import { r as s, j as e } from "./index-BdVT2AVB.js";
import { a as b } from "./axios-BimPEqV4.js";
import { S as j, C as f, a as N } from "./search-X_3ViG56.js";
import "./createLucideIcon-BGhf1d7L.js";
const z = () => {
    const [d, l] = s.useState([]),
        [n, g] = s.useState(""),
        [i, S] = s.useState(10),
        [a, c] = s.useState(1),
        [v, x] = s.useState(0),
        [o, m] = s.useState(0);
    s.useState({ key: "", direction: "" });
    const [w, p] = s.useState({ message: "", type: "", isVisible: !1 }),
        [u, h] = s.useState(!1),
        y = async () => {
            h(!0);
            try {
                const t =
                        localStorage.getItem("token") ||
                        sessionStorage.getItem("token"),
                    r = await b.get(
                        "https://forms-api.saiid.org/api/shelters",
                        {
                            headers: { Authorization: `Bearer ${t}` },
                            params: { searchQuery: n, perPage: i, page: a },
                        }
                    );
                Array.isArray(r.data.shelters)
                    ? (l(r.data.shelters),
                      x(r.data.totalShelters),
                      m(r.data.totalPages))
                    : (l([]), x(0), m(0));
            } catch (t) {
                console.error("Error fetching shelters:", t),
                    p({
                        message:
                            "خطأ في جلب بيانات مراكز النزوح، يرجى المحاولة مرة أخرى.",
                        type: "error",
                        isVisible: !0,
                    }),
                    l([]);
            } finally {
                h(!1);
            }
        };
    return (
        s.useEffect(() => {
            y();
        }, [n, i, a]),
        e.jsx("div", {
            className: "flex justify-center w-full px-4 sm:px-6 lg:px-8",
            children: e.jsxs("div", {
                className:
                    "container bg-white shadow-lg rounded-xl mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 mt-16 mb-20",
                style: { direction: "rtl" },
                children: [
                    e.jsx("div", {
                        className:
                            "card-header flex flex-col sm:flex-row justify-between items-center mb-6 px-2 sm:px-5",
                        children: e.jsx("h2", {
                            className:
                                "card-title font-bold text-2xl sm:text-3xl mb-4 sm:mb-0 text-gray-800",
                            children: "بيانات مراكز النزوح",
                        }),
                    }),
                    e.jsx("div", {
                        className: "bg-gray-100 p-4 rounded-lg mb-6",
                        children: e.jsxs("div", {
                            className: "relative",
                            children: [
                                e.jsx("input", {
                                    type: "text",
                                    className:
                                        "w-full p-2 pr-10 border border-gray-300 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-blue-500",
                                    placeholder: "البحث عن مركز نزوح",
                                    value: n,
                                    onChange: (t) => {
                                        g(t.target.value), c(1);
                                    },
                                }),
                                e.jsx(j, {
                                    className:
                                        "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400",
                                    size: 20,
                                }),
                            ],
                        }),
                    }),
                    e.jsx("div", {
                        className:
                            "card-body overflow-x-auto bg-white rounded-lg shadow",
                        children: e.jsxs("table", {
                            className: "table-auto w-full border-collapse",
                            children: [
                                e.jsx("thead", {
                                    children: e.jsxs("tr", {
                                        className: "bg-gray-50 text-center",
                                        children: [
                                            e.jsx("th", {
                                                className:
                                                    "p-3 text-sm font-semibold text-gray-600",
                                                children: "اسم المركز نزوح",
                                            }),
                                            e.jsx("th", {
                                                className:
                                                    "p-3 text-sm font-semibold text-gray-600",
                                                children: "الموقع",
                                            }),
                                            e.jsx("th", {
                                                className:
                                                    "p-3 text-sm font-semibold text-gray-600",
                                                children: "عدد النازحين",
                                            }),
                                            e.jsx("th", {
                                                className:
                                                    "p-3 text-sm font-semibold text-gray-600",
                                                children: "عدد الخيام",
                                            }),
                                            e.jsx("th", {
                                                className:
                                                    "p-3 text-sm font-semibold text-gray-600",
                                                children: " اسم مدير المخيم",
                                            }),
                                            e.jsx("th", {
                                                className:
                                                    "p-3 text-sm font-semibold text-gray-600",
                                                children: " رقم مدير المخيم ",
                                            }),
                                            e.jsx("th", {
                                                className:
                                                    "p-3 text-sm font-semibold text-gray-600",
                                                children:
                                                    "  اسم نائب مديرالمخيم",
                                            }),
                                            e.jsx("th", {
                                                className:
                                                    "p-3 text-sm font-semibold text-gray-600",
                                                children:
                                                    " رقم نائب مديرالمخيم",
                                            }),
                                            e.jsx("th", {
                                                className:
                                                    "p-3 text-sm font-semibold text-gray-600",
                                                children: "ملف الاكسيل",
                                            }),
                                        ],
                                    }),
                                }),
                                e.jsx("tbody", {
                                    children: u
                                        ? e.jsx("tr", {
                                              children: e.jsx("td", {
                                                  colSpan: "3",
                                                  className: "text-center p-4",
                                                  children:
                                                      "جارٍ تحميل البيانات...",
                                              }),
                                          })
                                        : d.length === 0
                                        ? e.jsx("tr", {
                                              children: e.jsx("td", {
                                                  colSpan: "3",
                                                  className: "text-center p-4",
                                                  children:
                                                      "لا توجد بيانات متاحة",
                                              }),
                                          })
                                        : d.map((t) =>
                                              e.jsxs(
                                                  "tr",
                                                  {
                                                      className:
                                                          "text-center border-b hover:bg-gray-50",
                                                      children: [
                                                          e.jsx("td", {
                                                              className:
                                                                  "p-3 text-sm text-gray-700",
                                                              children:
                                                                  t.camp_name,
                                                          }),
                                                          e.jsx("td", {
                                                              className:
                                                                  "p-3 text-sm text-gray-700",
                                                              children:
                                                                  t.detailed_address,
                                                          }),
                                                          e.jsx("td", {
                                                              className:
                                                                  "p-3 text-sm text-gray-700",
                                                              children:
                                                                  t.families_count,
                                                          }),
                                                          e.jsx("td", {
                                                              className:
                                                                  "p-3 text-sm text-gray-700",
                                                              children:
                                                                  t.tents_count,
                                                          }),
                                                          e.jsx("td", {
                                                              className:
                                                                  "p-3 text-sm text-gray-700",
                                                              children:
                                                                  t.manager_name,
                                                          }),
                                                          e.jsx("td", {
                                                              className:
                                                                  "p-3 text-sm text-gray-700",
                                                              children:
                                                                  t.manager_phone,
                                                          }),
                                                          e.jsx("td", {
                                                              className:
                                                                  "p-3 text-sm text-gray-700",
                                                              children:
                                                                  t.deputy_manager_name,
                                                          }),
                                                          e.jsx("td", {
                                                              className:
                                                                  "p-3 text-sm text-gray-700",
                                                              children:
                                                                  t.deputy_manager_phone,
                                                          }),
                                                          e.jsx("td", {
                                                              className:
                                                                  "p-3 text-sm text-gray-700",
                                                              children:
                                                                  t.excel_sheet
                                                                      ? e.jsx(
                                                                            "a",
                                                                            {
                                                                                href: `https://forms-api.saiid.org/api/excel/${t.manager_id_number}`,
                                                                                download:
                                                                                    !0,
                                                                                className:
                                                                                    "text-blue-600 hover:text-blue-800 hover:underline",
                                                                                target: "_blank",
                                                                                children:
                                                                                    "تحميل الملف",
                                                                            }
                                                                        )
                                                                      : "-",
                                                          }),
                                                      ],
                                                  },
                                                  t.manager_id_number
                                              )
                                          ),
                                }),
                            ],
                        }),
                    }),
                    e.jsxs("div", {
                        className: "flex justify-between items-center mt-6",
                        children: [
                            e.jsx("button", {
                                onClick: () => c((t) => Math.max(t - 1, 1)),
                                disabled: a === 1,
                                className:
                                    "p-2 bg-gray-300 rounded-md disabled:opacity-50",
                                children: e.jsx(f, { size: 20 }),
                            }),
                            e.jsxs("span", {
                                className: "mx-2 text-gray-700",
                                children: ["صفحة ", a, " من ", o],
                            }),
                            e.jsx("button", {
                                onClick: () => c((t) => Math.min(t + 1, o)),
                                disabled: a === o,
                                className:
                                    "p-2 bg-gray-300 rounded-md disabled:opacity-50",
                                children: e.jsx(N, { size: 20 }),
                            }),
                        ],
                    }),
                ],
            }),
        })
    );
};
export { z as default };
