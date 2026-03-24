// import validator from 'validator';

// const validateForm = (formData, formType) => {
//     let errors = {};

//     if (formType === 'ApprovalForm') {
//         if (validator.isEmpty(formData.data_approval_name)) {
//             errors.data_approval_name = 'اسم المتعهد مطلوب';
//         }
//     }

//     if (formType === 'FatherForm') {
//         if (validator.isEmpty(formData.father_first_name)) {
//             errors.father_first_name = 'الاسم الأول مطلوب';
//         }
//         if (validator.isEmpty(formData.father_fathers_name)) {
//             errors.father_fathers_name = 'اسم الأب مطلوب';
//         }
//         if (validator.isEmpty(formData.father_grandfathers_name)) {
//             errors.father_grandfathers_name = 'اسم الجد مطلوب';
//         }
//         if (validator.isEmpty(formData.father_last_name)) {
//             errors.father_last_name = 'اسم العائلة مطلوب';
//         }
//         if (!validator.isDate(formData.deceased_father_birth_date)) {
//             errors.deceased_father_birth_date = 'تاريخ ميلاد الأب غير صالح';
//         }
//         if (!validator.isDate(formData.death_date)) {
//             errors.death_date = 'تاريخ وفاة الأب غير صالح';
//         }
//         if (validator.isEmpty(formData.death_cause)) {
//             errors.death_cause = 'سبب الوفاة مطلوب';
//         }
//     }

//     if (formType === 'MotherForm') {
//         if (validator.isEmpty(formData.mother_first_name)) {
//             errors.mother_first_name = 'الاسم الأول مطلوب';
//         }
//         if (validator.isEmpty(formData.mother_fathers_name)) {
//             errors.mother_fathers_name = 'اسم الأب مطلوب';
//         }
//         if (validator.isEmpty(formData.mother_grandfathers_name)) {
//             errors.mother_grandfathers_name = 'اسم الجد مطلوب';
//         }
//         if (validator.isEmpty(formData.mother_last_name)) {
//             errors.mother_last_name = 'اسم العائلة مطلوب';
//         }
//         if (!validator.isNumeric(formData.mother_id_number)) {
//             errors.mother_id_number = 'رقم هوية الأم غير صالح';
//         }
//         if (!validator.isDate(formData.mother_birth_date)) {
//             errors.mother_birth_date = 'تاريخ ميلاد الأم غير صالح';
//         }
//     }

//     if (formType === 'GuardianForm') {
//         if (validator.isEmpty(formData.guardian_first_name)) {
//             errors.guardian_first_name = 'الاسم الأول مطلوب';
//         }
//         if (validator.isEmpty(formData.guardian_fathers_name)) {
//             errors.guardian_fathers_name = 'اسم الأب مطلوب';
//         }
//         if (validator.isEmpty(formData.guardian_grandfathers_name)) {
//             errors.guardian_grandfathers_name = 'اسم الجد مطلوب';
//         }
//         if (validator.isEmpty(formData.guardian_last_name)) {
//             errors.guardian_last_name = 'اسم العائلة مطلوب';
//         }
//         if (!validator.isNumeric(formData.guardian_phone_number)) {
//             errors.guardian_phone_number = 'رقم الجوال غير صالح';
//         }
//         if (!validator.isNumeric(formData.alternative_phone_number)) {
//             errors.alternative_phone_number = 'رقم جوال بديل غير صالح';
//         }
//     }

//     if (formType === 'OrphanForm') {
//         if (validator.isEmpty(formData.orphan_first_name)) {
//             errors.orphan_first_name = 'الاسم الأول مطلوب';
//         }
//         if (validator.isEmpty(formData.orphan_fathers_name)) {
//             errors.orphan_fathers_name = 'اسم الأب مطلوب';
//         }
//         if (validator.isEmpty(formData.orphan_grandfathers_name)) {
//             errors.orphan_grandfathers_name = 'اسم الجد مطلوب';
//         }
//         if (validator.isEmpty(formData.orphan_last_name)) {
//             errors.orphan_last_name = 'اسم العائلة مطلوب';
//         }
//         if (!validator.isNumeric(formData.orphan_id_number)) {
//             errors.orphan_id_number = 'رقم هوية اليتيم غير صالح';
//         }
//         if (!validator.isDate(formData.orphan_birth_date)) {
//             errors.orphan_birth_date = 'تاريخ ميلاد اليتيم غير صالح';
//         }
//         if (validator.isEmpty(formData.health_status)) {
//             errors.health_status = 'الحالة الصحية مطلوبة';
//         }
//         if (formData.health_status === 'مريض' && validator.isEmpty(formData.disease_description)) {
//             errors.disease_description = 'وصف المرض مطلوب';
//         }
//         if (validator.isEmpty(formData.original_address)) {
//             errors.original_address = 'عنوان السكن الاساسي مطلوب';
//         }
//         if (validator.isEmpty(formData.current_address)) {
//             errors.current_address = 'عنوان السكن الحالي مطلوب';
//         }
//         if (!validator.isNumeric(formData.number_of_siplings)) {
//             errors.number_of_siplings = 'عدد الأخوة والأخوات غير صالح';
//         }
//         if (validator.isEmpty(formData.is_enrolled_in_memorization_center)) {
//             errors.is_enrolled_in_memorization_center = 'هل اليتيم ملتحق في مراكز التحفيظ مطلوب';
//         }
//     }

//     return errors;
// };

// export default validateForm;