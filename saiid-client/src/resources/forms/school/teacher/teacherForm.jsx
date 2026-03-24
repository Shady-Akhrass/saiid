import { useState, useEffect, useRef } from "react";

const TeacherForm = ({ formData, handleChange }) => {
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const name = `${formData.name || ""}`.trim();
    handleChange({ target: { name: "name", value: name } });
  }, [formData.name]);

  const validateField = (name, value) => {
    let error = "";

    switch (name) {
      case "name":
        if (!value) {
          error = "يرجى إدخال الاسم رباعي";
        } else if (value.length < 4) {
          error = "الاسم يجب أن يكون رباعي";
        }
        break;

      case "id_number":
        if (!value) {
          error = "يرجى إدخال رقم الهوية";
        } else if (!/^\d{9}$/.test(value)) {
          error = "رقم الهوية يجب أن يتكون من 9 أرقام";
        }
        break;

      case "birth_date":
        if (!value) {
          error = "يرجى إدخال تاريخ الميلاد";
        }
        break;

      case "gender":
        if (!value) {
          error = "يرجى اختيار الجنس";
        }
        break;

      case "university_major":
        if (!value) {
          error = "يرجى اختيار التخصص الجامعي  ";
        }
        break;

      case "marital_status":
        if (!value) {
          error = "يرجى اختيار الحالة الإجتماعية";
        }
        break;

      case "address_details":
        if (!value) {
          error = "يرجى إدخال عنوان السكن الحالي بالتفصيل";
        }
        break;

      case "guardian_phone_number":
        if (!value) {
          error = "يرجى إدخال رقم الجوال";
        } else if (!/^\d{10}$/.test(value)) {
          error = "رقم الجوال يجب أن يتكون من 10 أرقام";
        }
        break;

      case "alternative_phone_number":
        if (!value) {
          error = "يرجى إدخال رقم الجوال البديل";
        } else if (!/^\d{10}$/.test(value)) {
          error = "رقم الجوال البديل يجب أن يتكون من 10 أرقام";
        }
        break;

      default:
        break;
    }

    return error;
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    const error = validateField(name, value);
    setErrors((prevErrors) => ({ ...prevErrors, [name]: error }));
    handleChange(e);
  };
  return (
    <div className="aids-form">
      <h2 className="text-2xl font-semibold mb-4">بيانات المتقدم</h2>
      <div className="mb-4 ">
        <label className="block text-gray-700">الاسم رباعي </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleFieldChange}
          className={`mt-1 p-2 border ${errors.name ? "border-red-500" : "border-gray-300"
            } rounded-lg w-full`}
          required
        />
        {errors.name && <span className="text-red-500">{errors.name}</span>}
      </div>

      <div className="mb-4">
        <label className="block text-gray-700">رقم الهوية </label>
        <input
          type="number"
          name="id_number"
          value={formData.id_number}
          onChange={handleFieldChange}
          className={`mt-1 p-2 border ${errors.id_number ? "border-red-500" : "border-gray-300"
            } rounded-lg w-full`}
          required
        />
        {errors.id_number && (
          <span className="text-red-500">{errors.id_number}</span>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-gray-700">تاريخ الميلاد</label>
        <input
          type="date"
          name="birth_date"
          value={formData.birth_date}
          onChange={handleFieldChange}
          className={`mt-1 p-2 border ${errors.birth_date ? "border-red-500" : "border-gray-300"
            } rounded-lg w-full`}
          required
        />
        {errors.birth_date && (
          <span className="text-red-500">{errors.birth_date}</span>
        )}
      </div>
      <div className="mb-4">
        <label className="block text-gray-700">الجنس</label>
        <select
          name="gender"
          value={formData.gender}
          onChange={handleFieldChange}
          className={`mt-1 p-2 border ${errors.gender ? "border-red-500" : "border-gray-300"
            } rounded-lg w-full`}
          required
        >
          <option value="">اختار الجنس</option>
          <option value="ذكر"> ذكر</option>
          <option value="أنثى"> انثى</option>
        </select>
        {errors.gender && <span className="text-red-500">{errors.gender}</span>}
      </div>
      <div className="mb-4">
        <label className="block text-gray-700"> اختيار التخصص الجامعي</label>
        <select
          name="university_major"
          value={formData.university_major}
          onChange={handleFieldChange}
          className={`mt-1 p-2 border ${errors.university_major ? "border-red-500" : "border-gray-300"
            } rounded-lg w-full`}
          required
        >
          <option value="">التخصص الجامعي </option>
          <option value="صف">معلم صف</option>
          <option value="رياضيات">معلم رياضيات</option>
          <option value="عربي">معلم لغة عربية</option>
          <option value="انجليزي">معلم لغة انجليزية</option>
          <option value="علوم">معلم علوم</option>
        </select>
        {errors.university_major && (
          <span className="text-red-500">{errors.university_major}</span>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-gray-700">الحالة الإجتماعية</label>
        <select
          name="marital_status"
          value={formData.marital_status}
          onChange={handleFieldChange}
          className={`mt-1 p-2 border ${errors.marital_status ? "border-red-500" : "border-gray-300"
            } rounded-lg w-full`}
          required
        >
          <option value="">اختار الحالة الإجتماعية</option>
          <option value="متزوج">متزوج</option>
          <option value="أرمل">أرمل</option>
          <option value="مطلق">مطلق</option>
          <option value="أعزب">أعزب</option>
        </select>
        {errors.marital_status && (
          <span className="text-red-500">{errors.marital_status}</span>
        )}
      </div>


      <div className="mb-4">
        <label className="block text-gray-700">عنوان السكن بالتفصيل</label>

        <textarea
          name="address_details"
          value={formData.address_details}
          required
          onChange={handleFieldChange}
          className={`mt-1 p-2 border ${errors.address_details ? "border-red-500" : "border-gray-300"
            } rounded-lg w-full`}
        />
        {errors.address_details && (
          <span className="text-red-500">{errors.address_details}</span>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-gray-700">رقم الجوال</label>
        <input
          type="text"
          name="guardian_phone_number"
          value={formData.guardian_phone_number}
          onChange={handleFieldChange}
          className={`mt-1 p-2 border ${errors.guardian_phone_number ? "border-red-500" : "border-gray-300"
            } rounded-lg w-full`}
          required
        />
        {errors.guardian_phone_number && (
          <span className="text-red-500">{errors.guardian_phone_number}</span>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-gray-700">رقم جوال بديل</label>
        <input
          type="text"
          name="alternative_phone_number"
          value={formData.alternative_phone_number}
          onChange={handleFieldChange}
          className={`mt-1 p-2 border ${errors.alternative_phone_number
              ? "border-red-500"
              : "border-gray-300"
            } rounded-lg w-full`}
          required
        />
        {errors.alternative_phone_number && (
          <span className="text-red-500">
            {errors.alternative_phone_number}
          </span>
        )}
      </div>
    </div>
  );
};

export default TeacherForm;
