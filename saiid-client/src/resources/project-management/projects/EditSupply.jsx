import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { getProjectCode } from '../../../utils/helpers';
import {
  ArrowRight,
  Plus,
  Edit,
  Trash2,
  Package,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  X,
  ShoppingCart,
  Info,
  Search,
  Save,
  Folder,
  UserCheck,
  Users,
  Calculator,
  Banknote,
  TrendingDown,
} from 'lucide-react';
import { OrphanSelectionWidget } from '../components/OrphanSelectionWidget';
import { AssignProjectModal } from '../components/ProjectModals';

const EditSupply = () => {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingSupply, setConfirmingSupply] = useState(false);
  const [project, setProject] = useState(null);
  const [confirmedItems, setConfirmedItems] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [surplusAmount, setSurplusAmount] = useState(0);
  const [currency, setCurrency] = useState('USD');
  const [surplusCategories, setSurplusCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItem, setNewItem] = useState({
    warehouse_item_id: '',
    quantity_per_unit: '',
  });
  const [beneficiariesCount, setBeneficiariesCount] = useState('');
  const [updatingBeneficiaries, setUpdatingBeneficiaries] = useState(false);

  // 💱 Shekel Conversion State
  const [showShekelModal, setShowShekelModal] = useState(false);
  const [isEditingShekel, setIsEditingShekel] = useState(false);
  const [exchangeRate, setExchangeRate] = useState('');
  const [transferDiscountPercentage, setTransferDiscountPercentage] = useState(0);
  const [convertingToShekel, setConvertingToShekel] = useState(false);

  // 🧑‍💼 حالة مودال إسناد الباحث
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  // 👦 Orphan Selection State
  const [selectedOrphansData, setSelectedOrphansData] = useState(null);
  const [existingOrphans, setExistingOrphans] = useState([]);
  const [loadingOrphans, setLoadingOrphans] = useState(false);
  const [showOrphanWidget, setShowOrphanWidget] = useState(false); // ✅ للتحكم في ظهور قسم اختيار الأيتام

  // ✅ تعريف دور مدير المشاريع
  const normalizedRole =
    (typeof (user?.role || user?.role_name || user?.user_role || '') === 'string'
      ? (user?.role || user?.role_name || user?.user_role || '').toLowerCase()
      : '') || '';
  const isProjectManager =
    normalizedRole === 'project_manager' || normalizedRole === 'مدير مشاريع';

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
      fetchConfirmedItems();
      fetchAvailableItems();
      fetchSurplusCategories();
    }
  }, [projectId]);

  // ✅ تحديث beneficiariesCount وجلب الأيتام عند تغيير المشروع
  useEffect(() => {
    if (project) {
      const currentCount = project?.beneficiaries_count || project?.calculated_beneficiaries || '';
      setBeneficiariesCount(currentCount);

      const projectTypeName = typeof project.project_type === 'string' 
        ? project.project_type 
        : (project.project_type?.name_ar || project.project_type?.name || '');

      const isOrphanProject = ['كفالة', 'كفالات', 'أيتام', 'ايتام'].some(keyword => 
        projectTypeName.includes(keyword)
      );
      if (isOrphanProject) {
        fetchProjectOrphans();
        // ✅ إذا كان المشروع يحتوي بالفعل على أيتام، نُظهر القسم تلقائياً
        if (project.sponsored_orphans_count > 0) {
          setShowOrphanWidget(true);
        }
      }
    }
  }, [project?.id]);

  // ✅ تحديث صندوق الفائض تلقائياً عند تغيير الأصناف أو الكمية
  useEffect(() => {
    if (project && confirmedItems.length > 0) {
      updateSurplusAmount();
    }
  }, [confirmedItems, quantity, project]);

  // ✅ دالة لحساب المبلغ المتاح
  const getAvailableAmountInfo = () => {
    if (!project) return { amount: 0, currency: 'USD', symbol: '$', originalAmount: null, exchangeRate: null };

    const hasShekel = project.shekel_exchange_rate && project.net_amount_shekel;
    if (hasShekel) {
      return {
        amount: parseFloat(project.net_amount_shekel || 0),
        currency: 'ILS',
        symbol: '₪',
        originalAmount: parseFloat(project.net_amount_usd || project.net_amount || 0),
        exchangeRate: project.shekel_exchange_rate
      };
    }

    return {
      amount: parseFloat(project.net_amount_usd || project.net_amount || 0),
      currency: 'USD',
      symbol: '$',
      originalAmount: null,
      exchangeRate: null
    };
  };

  // ✅ دالة لتحديث صندوق الفائض تلقائياً
  const updateSurplusAmount = () => {
    if (!project || confirmedItems.length === 0) return;

    // حساب التكلفة الإجمالية
    const unitCost = confirmedItems.reduce((sum, item) => {
      const itemCost = parseFloat(item.quantity_per_unit || 0) * parseFloat(item.unit_price || 0);
      return sum + itemCost;
    }, 0);

    const totalCost = unitCost * quantity;
    const amountInfo = getAvailableAmountInfo();
    const availableAmount = parseFloat(amountInfo.amount || 0);
    const calculatedSurplus = availableAmount - totalCost;

    setSurplusAmount(calculatedSurplus);
  };

  const fetchProjectData = async () => {
    try {
      const response = await apiClient.get(`/project-proposals/${projectId}`, {
        params: {
          _t: Date.now(), // ✅ cache busting
        },
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      if (response.data.success) {
        const projectData = response.data.project || response.data.data || response.data;
        setProject(projectData);
        setQuantity(projectData.quantity || 1);
        // تحديد العملة من بيانات المشروع
        if (projectData.shekel_exchange_rate && projectData.net_amount_shekel) {
          setCurrency('ILS');
        }
        // ✅ جلب قسم الفائض الحالي من بيانات المشروع
        if (projectData.surplus_category_id !== null && projectData.surplus_category_id !== undefined) {
          setSelectedCategoryId(projectData.surplus_category_id.toString());
          if (import.meta.env.DEV) {
            console.log('📦 Loaded surplus_category_id from project data:', projectData.surplus_category_id);
          }
        } else {
          // ✅ إذا كانت القيمة null أو undefined، نعيد تعيينها إلى string فارغ
          setSelectedCategoryId('');
          if (import.meta.env.DEV) {
            console.log('📦 No surplus_category_id in project data, resetting to empty');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error('فشل تحميل بيانات المشروع');
    }
  };

  const fetchConfirmedItems = async (forceRefresh = false) => {
    try {
      // setLoading(true);
      const params = forceRefresh ? { _t: Date.now() } : {};
      const response = await apiClient.get(`/projects/${projectId}/warehouse`, {
        params,
        headers: forceRefresh ? {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        } : {}
      });
      if (response.data.success) {
        const data = response.data.data || response.data;
        const items = data.items || [];
        const summaryData = data.summary || data;

        if (import.meta.env.DEV) {
          console.log('📦 Fetched items from backend:', {
            totalItems: items.length,
            itemsByStatus: {
              confirmed: items.filter(item => item.status === 'confirmed').length,
              pending: items.filter(item => item.status === 'pending').length,
              all: items.map(item => ({ id: item.id, warehouse_item_id: item.warehouse_item_id, status: item.status }))
            }
          });
        }

        // ✅ في صفحة التعديل، نعرض جميع الأصناف (confirmed و pending)
        // لأن المستخدم قد يضيف أصناف جديدة أو يعدل أصناف موجودة
        const allItems = items.filter(item =>
          item.status === 'confirmed' || item.status === 'pending' || !item.status
        );
        setConfirmedItems(allItems);

        if (import.meta.env.DEV) {
          console.log('📦 All items after filtering:', allItems.length);
        }
        if (data.project?.quantity) {
          setQuantity(data.project.quantity);
        }
        // جلب صندوق الفائض من البيانات
        if (summaryData.surplus_amount !== undefined && summaryData.surplus_amount !== null) {
          setSurplusAmount(summaryData.surplus_amount);
        } else if (summaryData.expected_surplus !== undefined && summaryData.expected_surplus !== null) {
          setSurplusAmount(summaryData.expected_surplus);
        }
        // جلب العملة
        if (summaryData.currency) {
          setCurrency(summaryData.currency);
        } else if (project?.shekel_exchange_rate && project?.net_amount_shekel) {
          setCurrency('ILS');
        }
        // ✅ جلب قسم الفائض الحالي من بيانات المشروع
        if (data.project?.surplus_category_id !== null && data.project?.surplus_category_id !== undefined) {
          setSelectedCategoryId(data.project.surplus_category_id.toString());
          if (import.meta.env.DEV) {
            console.log('📦 Loaded surplus_category_id from warehouse:', data.project.surplus_category_id);
          }
        } else if (project?.surplus_category_id !== null && project?.surplus_category_id !== undefined) {
          setSelectedCategoryId(project.surplus_category_id.toString());
          if (import.meta.env.DEV) {
            console.log('📦 Loaded surplus_category_id from project:', project.surplus_category_id);
          }
        } else {
          // ✅ إذا كانت القيمة null أو undefined، نعيد تعيينها إلى string فارغ
          setSelectedCategoryId('');
          if (import.meta.env.DEV) {
            console.log('📦 No surplus_category_id found, resetting to empty');
          }
        }
      }
    } catch (error) {
      console.error('Error fetching confirmed items:', error);
      toast.error('فشل تحميل الأصناف المؤكدة');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectOrphans = async () => {
    if (!projectId) return;
    try {
      setLoadingOrphans(true);
      const response = await apiClient.get(`/project-proposals/${projectId}/orphans`);
      if (response.data.success) {
        setExistingOrphans(response.data.orphans || []);
      }
    } catch (error) {
      console.error('Error fetching project orphans:', error);
    } finally {
      setLoadingOrphans(false);
    }
  };

  const fetchAvailableItems = async () => {
    try {
      const response = await apiClient.get('/warehouse/available', {
        params: { per_page: 100 }
      });
      if (response.data.success) {
        const items = response.data.data?.data || response.data.data || [];
        setAvailableItems(items.filter(item => item.is_active !== false && item.quantity_available > 0));
      }
    } catch (error) {
      console.error('Error fetching available items:', error);
    }
  };

  // 📦 Fetch Surplus Categories
  const fetchSurplusCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await apiClient.get('/surplus-categories', {
        params: { is_active: 1 }
      });
      if (response.data.success) {
        const categories = response.data.data || [];
        setSurplusCategories(categories);
      }
    } catch (error) {
      console.error('Error fetching surplus categories:', error);
      // لا نعرض خطأ هنا لأن الأقسام اختيارية
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleUpdateItemQuantity = (itemId, newQuantity) => {
    // ✅ التحقق من صحة الكمية
    const parsedQuantity = parseFloat(newQuantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      toast.error('الكمية يجب أن تكون رقماً صحيحاً أكبر من صفر');
      return;
    }

    // ✅ البحث عن الصنف باستخدام id أو warehouse_item_id
    const item = confirmedItems.find(item =>
      item.id === itemId || item.warehouse_item_id === itemId
    );

    if (!item) {
      toast.error('الصنف غير موجود');
      return;
    }

    // ✅ التحقق من الكمية المتوفرة في المخزن
    const totalNeeded = parsedQuantity * quantity;
    const warehouseItem = availableItems.find(wItem =>
      wItem.id === item.warehouse_item_id
    );

    // إذا كان الصنف موجوداً في availableItems، نتحقق من الكمية
    if (warehouseItem) {
      const availableQty = warehouseItem.quantity_available || 0;
      if (totalNeeded > availableQty) {
        toast.error(`الكمية غير كافية! المتوفر: ${availableQty.toLocaleString('en-US')} | المطلوب: ${totalNeeded.toLocaleString('en-US')}`);
        return;
      }
    } else {
      // إذا لم يكن موجوداً في availableItems، نستخدم الكمية من الصنف نفسه
      const availableQty = item.available_in_warehouse || item.warehouse_item?.quantity_available || 0;
      if (availableQty > 0 && totalNeeded > availableQty) {
        toast.error(`الكمية غير كافية! المتوفر: ${availableQty.toLocaleString('en-US')} | المطلوب: ${totalNeeded.toLocaleString('en-US')}`);
        return;
      }
    }

    // ✅ تحديث الكمية
    const updatedItems = confirmedItems.map((currentItem) =>
      (currentItem.id === itemId || currentItem.warehouse_item_id === itemId)
        ? { ...currentItem, quantity_per_unit: parsedQuantity }
        : currentItem
    );

    setConfirmedItems(updatedItems);

    if (import.meta.env.DEV) {
      console.log('✅ Updated item quantity:', {
        itemId,
        oldQuantity: item.quantity_per_unit,
        newQuantity: parsedQuantity
      });
    }

    toast.success('تم تحديث الكمية');
  };

  const handleUpdateBeneficiaries = async () => {
    const currentValue = project?.beneficiaries_count || project?.calculated_beneficiaries || '';
    const newValue = beneficiariesCount || '';

    // إذا لم يتغير القيمة، لا نفعل شيء
    if (newValue === currentValue) {
      return;
    }

    try {
      setUpdatingBeneficiaries(true);
      const response = await apiClient.patch(`/project-proposals/${projectId}/beneficiaries`, {
        beneficiaries_count: newValue ? parseInt(newValue) : null,
      });

      if (response.data.success) {
        toast.success('تم تحديث عدد المستفيدين بنجاح');
        // تحديث بيانات المشروع
        fetchProjectData();
      } else {
        toast.error(response.data.message || 'فشل تحديث عدد المستفيدين');
        setBeneficiariesCount(currentValue);
      }
    } catch (error) {
      console.error('Error updating beneficiaries:', error);
      toast.error(error.response?.data?.message || 'حدث خطأ أثناء تحديث عدد المستفيدين');
      setBeneficiariesCount(currentValue);
    } finally {
      setUpdatingBeneficiaries(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الصنف من التوريد؟')) {
      return;
    }

    // البحث عن الصنف المراد حذفه
    const itemToDelete = confirmedItems.find(item => item.id === itemId || item.warehouse_item_id === itemId);
    if (!itemToDelete) {
      toast.error('الصنف غير موجود');
      return;
    }

    // ✅ إذا كان الصنف جديداً (ليس له id في الـ backend)، نحذفه محلياً فقط
    if (itemToDelete.id === null || itemToDelete.id === undefined || itemToDelete.isNew) {
      const updatedItems = confirmedItems.filter(item =>
        item.id !== itemId && item.warehouse_item_id !== itemId
      );
      setConfirmedItems(updatedItems);

      // ✅ إعادة الكمية المتوفرة للأصناف المتاحة
      const totalNeeded = (itemToDelete.quantity_per_unit || 0) * quantity;
      setAvailableItems(prev => prev.map(warehouseItem =>
        warehouseItem.id === itemToDelete.warehouse_item_id
          ? { ...warehouseItem, quantity_available: warehouseItem.quantity_available + totalNeeded }
          : warehouseItem
      ));

      toast.success('تم حذف الصنف');
      return;
    }

    // إذا كان الصنف موجوداً في الـ backend، نحذفه من الـ backend
    try {
      // محاولة استخدام endpoint الحذف المباشر
      try {
        const deleteResponse = await apiClient.delete(`/projects/${projectId}/warehouse/items/${itemToDelete.id}`);
        if (deleteResponse.data.success) {
          const deletedItemId = deleteResponse.data.deleted_item_id || itemToDelete.id;

          // ✅ التحقق من deleted_item_id في الـ response
          if (import.meta.env.DEV) {
            console.log('✅ تم حذف الصنف بنجاح:', {
              deleted_item_id: deletedItemId,
              item_id: itemToDelete.id
            });
          }

          // ✅ إعادة الكمية المتوفرة للأصناف المتاحة
          const totalNeeded = (itemToDelete.quantity_per_unit || 0) * quantity;
          setAvailableItems(prev => prev.map(warehouseItem =>
            warehouseItem.id === itemToDelete.warehouse_item_id
              ? { ...warehouseItem, quantity_available: warehouseItem.quantity_available + totalNeeded }
              : warehouseItem
          ));

          // ⚠️ مهم: إعادة جلب البيانات من السيرفر للتأكد من الحذف
          await fetchConfirmedItems(true); // force refresh

          // ✅ إعادة جلب الأصناف المتوفرة أيضاً
          await fetchAvailableItems();

          // ✅ التحقق من أن الصنف تم حذفه فعلياً (سيتم التحقق بعد إعادة الجلب)
          if (import.meta.env.DEV) {
            console.log('✅ تم إعادة جلب البيانات بعد الحذف');
          }

          toast.success(deleteResponse.data.message || 'تم حذف الصنف بنجاح');
          return;
        } else {
          throw new Error(deleteResponse.data.message || 'فشل حذف الصنف');
        }
      } catch (deleteError) {
        // إذا لم يكن endpoint الحذف موجوداً، نستخدم طريقة التعديل
        if (deleteError.response?.status === 404 || deleteError.response?.status === 405) {
          // استخدام endpoint التعديل لحذف الصنف
          const updatedItems = confirmedItems.filter(item => item.id !== itemId && item.warehouse_item_id !== itemId);

          // إعداد البيانات للإرسال (بدون الصنف المحذوف)
          const itemsToUpdate = updatedItems
            .filter(item => item.id !== null && item.id !== undefined)
            .map(item => ({
              id: item.id,
              quantity_per_unit: parseFloat(item.quantity_per_unit) || 0,
            }));

          const itemsToAdd = updatedItems
            .filter(item => item.id === null || item.id === undefined)
            .map(item => ({
              warehouse_item_id: item.warehouse_item_id,
              quantity_per_unit: parseFloat(item.quantity_per_unit) || 0,
            }));

          const payload = {
            items: [...itemsToUpdate, ...itemsToAdd],
            quantity: parseInt(quantity),
          };

          if (notes.trim()) {
            payload.notes = notes.trim();
          }

          if (surplusAmount !== undefined && surplusAmount !== null) {
            payload.surplus_amount = parseFloat(surplusAmount);
          }

          if (selectedCategoryId) {
            payload.surplus_category_id = parseInt(selectedCategoryId);
          } else {
            payload.surplus_category_id = null;
          }

          const editResponse = await apiClient.post(`/projects/${projectId}/warehouse/edit`, payload);

          if (editResponse.data.success) {
            // ✅ إعادة الكمية المتوفرة للأصناف المتاحة
            const totalNeeded = (itemToDelete.quantity_per_unit || 0) * quantity;
            setAvailableItems(prev => prev.map(warehouseItem =>
              warehouseItem.id === itemToDelete.warehouse_item_id
                ? { ...warehouseItem, quantity_available: warehouseItem.quantity_available + totalNeeded }
                : warehouseItem
            ));

            // ⚠️ مهم: إعادة جلب البيانات من السيرفر للتأكد من الحذف
            await fetchConfirmedItems(true); // force refresh

            // ✅ إعادة جلب الأصناف المتوفرة أيضاً
            await fetchAvailableItems();

            toast.success(editResponse.data.message || 'تم حذف الصنف بنجاح');
          } else {
            throw new Error(editResponse.data.message || 'فشل حذف الصنف');
          }
        } else {
          throw deleteError;
        }
      }
    } catch (error) {
      console.error('Error deleting item:', error);

      // معالجة الأخطاء حسب نوع الخطأ
      let errorMessage = 'فشل حذف الصنف';

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        switch (status) {
          case 404:
            errorMessage = data.message || 'الصنف غير موجود في السلة';
            break;
          case 422:
            errorMessage = data.message || 'لا يمكن حذف هذا الصنف';
            break;
          case 500:
            errorMessage = data.message || 'حدث خطأ في السيرفر';
            // في وضع التطوير، عرض تفاصيل الخطأ
            if (import.meta.env.DEV && data.error) {
              console.error('تفاصيل الخطأ من السيرفر:', data.error);
            }
            break;
          default:
            errorMessage = data.message || 'حدث خطأ غير متوقع';
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    }
  };

  const handleAddNewItem = () => {
    if (!newItem.warehouse_item_id || !newItem.quantity_per_unit) {
      toast.error('يرجى اختيار الصنف وإدخال الكمية');
      return;
    }

    const qtyPerUnit = parseFloat(newItem.quantity_per_unit);
    if (isNaN(qtyPerUnit) || qtyPerUnit <= 0) {
      toast.error('الكمية يجب أن تكون رقماً صحيحاً أكبر من صفر');
      return;
    }

    const warehouseItem = availableItems.find(item => item.id === parseInt(newItem.warehouse_item_id));
    if (!warehouseItem) {
      toast.error('الصنف المختار غير موجود');
      return;
    }

    // ✅ التحقق من الكمية المتوفرة
    const totalNeeded = qtyPerUnit * quantity;
    if (totalNeeded > warehouseItem.quantity_available) {
      toast.error(`الكمية غير كافية! المتوفر: ${warehouseItem.quantity_available.toLocaleString('en-US')} | المطلوب: ${totalNeeded.toLocaleString('en-US')}`);
      return;
    }

    // ✅ التحقق من عدم وجود الصنف مسبقاً
    const exists = confirmedItems.some(item =>
      item.warehouse_item_id === parseInt(newItem.warehouse_item_id)
    );

    if (exists) {
      toast.error('هذا الصنف موجود مسبقاً في التوريد');
      return;
    }

    const newItemData = {
      id: null, // جديد
      warehouse_item_id: parseInt(newItem.warehouse_item_id),
      warehouse_item: warehouseItem, // ✅ حفظ معلومات الصنف الكاملة
      item_name: warehouseItem.item_name,
      quantity_per_unit: qtyPerUnit,
      unit_price: parseFloat(warehouseItem.unit_price || 0),
      total_price_per_unit: qtyPerUnit * parseFloat(warehouseItem.unit_price || 0),
      available_in_warehouse: warehouseItem.quantity_available, // ✅ حفظ الكمية المتوفرة
      isNew: true,
    };

    const updatedItems = [...confirmedItems, newItemData];
    setConfirmedItems(updatedItems);

    // ✅ تحديث الكمية المتوفرة محلياً (تقليل الكمية المتوفرة)
    setAvailableItems(prev => prev.map(item =>
      item.id === parseInt(newItem.warehouse_item_id)
        ? { ...item, quantity_available: item.quantity_available - totalNeeded }
        : item
    ));

    setNewItem({ warehouse_item_id: '', quantity_per_unit: '' });
    setShowAddItemModal(false);
    toast.success('تم إضافة الصنف');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (confirmedItems.length === 0) {
      toast.error('يجب أن يحتوي التوريد على صنف واحد على الأقل');
      return;
    }

    // ✅ التحقق من اختيار قسم الفائض (إجباري)
    if (!selectedCategoryId || selectedCategoryId === '') {
      toast.error('يرجى اختيار قسم الفائض قبل حفظ التعديلات');
      return;
    }

    if (!window.confirm('هل أنت متأكد من حفظ التعديلات؟ سيتم تحديث التوريد.')) {
      return;
    }

    try {
      setSubmitting(true);

      // ✅ إعداد البيانات للإرسال
      // الأصناف الموجودة (لها id) - يمكن تحديثها حتى لو كانت مؤكدة
      const itemsToUpdate = confirmedItems
        .filter(item => item.id !== null && item.id !== undefined && !item.isNew)
        .map(item => ({
          id: item.id,
          quantity_per_unit: parseFloat(item.quantity_per_unit) || 0,
        }));

      // الأصناف الجديدة (ليس لها id أو marked as new)
      const itemsToAdd = confirmedItems
        .filter(item => {
          const isNewItem = item.id === null || item.id === undefined || item.isNew;
          const hasWarehouseId = item.warehouse_item_id !== null && item.warehouse_item_id !== undefined;
          return isNewItem && hasWarehouseId;
        })
        .map(item => ({
          warehouse_item_id: parseInt(item.warehouse_item_id),
          quantity_per_unit: parseFloat(item.quantity_per_unit) || 0,
        }));

      // ✅ التحقق من وجود أصناف للإرسال
      if (itemsToUpdate.length === 0 && itemsToAdd.length === 0) {
        toast.error('لا توجد أصناف للإرسال');
        setSubmitting(false);
        return;
      }

      if (import.meta.env.DEV) {
        console.log('📤 Sending supply update:', {
          itemsToUpdate: itemsToUpdate.length,
          itemsToAdd: itemsToAdd.length,
          totalItems: confirmedItems.length,
          itemsToUpdateDetails: itemsToUpdate,
          itemsToAddDetails: itemsToAdd,
          confirmedItemsDetails: confirmedItems.map(item => ({
            id: item.id,
            warehouse_item_id: item.warehouse_item_id,
            isNew: item.isNew,
            item_name: item.item_name,
            quantity_per_unit: item.quantity_per_unit
          }))
        });
      }

      const payload = {
        items: [...itemsToUpdate, ...itemsToAdd],
        quantity: parseInt(quantity),
      };

      if (import.meta.env.DEV) {
        console.log('📤 Full payload:', JSON.stringify(payload, null, 2));
        console.log('📤 Payload items count:', payload.items.length);
        console.log('📤 Payload items:', payload.items);
      }

      if (notes.trim()) {
        payload.notes = notes.trim();
      }

      // إضافة صندوق الفائض إذا تم تعديله
      if (surplusAmount !== undefined && surplusAmount !== null) {
        payload.surplus_amount = parseFloat(surplusAmount);
      }

      // ✅ إضافة قسم الفائض (إجباري)
      if (!selectedCategoryId || selectedCategoryId === '') {
        toast.error('يرجى اختيار قسم الفائض قبل حفظ التعديلات');
        setSubmitting(false);
        return;
      }

      payload.surplus_category_id = parseInt(selectedCategoryId);

      const response = await apiClient.post(`/projects/${projectId}/warehouse/edit`, payload);

      if (import.meta.env.DEV) {
        console.log('📥 Backend response:', {
          success: response.data.success,
          message: response.data.message,
          data: response.data.data,
          fullResponse: response.data
        });

        // ✅ التحقق من أن الـ backend أضاف الأصناف
        if (response.data.data) {
          console.log('📥 Backend response data:', {
            items_added: response.data.data.items_added,
            items_updated: response.data.data.items_updated,
            items_deleted: response.data.data.items_deleted,
            total_items: response.data.data.total_items
          });
        }
      }

      if (response.data.success) {
        toast.success(response.data.message || 'تم تعديل التوريد بنجاح');

        // ✅ إعادة جلب البيانات مرة واحدة فقط (بدون force refresh لتقليل الطلبات)
        // نستخدم force refresh فقط إذا كان ضرورياً
        await fetchConfirmedItems(false); // ✅ استخدام cache بدلاً من force refresh

        // ✅ تحديث بيانات المشروع فقط إذا لزم الأمر (بدون force refresh)
        if (response.data.data?.project) {
          setProject(prev => ({
            ...prev,
            ...response.data.data.project
          }));
        }

        if (import.meta.env.DEV) {
          console.log('✅ تم إعادة جلب البيانات بعد الحفظ في نفس صفحة التعديل (بدون انتقال)');
        }
      } else {
        toast.error(response.data.message || 'فشل تعديل التوريد');
        if (import.meta.env.DEV) {
          console.error('❌ Backend returned success: false', response.data);
        }
      }
    } catch (error) {
      console.error('Error editing supply:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      let errorMessage = 'فشل تعديل التوريد';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ تأكيد التوريد (نقل المشروع لحالة "تم التوريد")
  const handleConfirmSupply = async () => {
    // ✅ تحديث الأصناف المؤكدة أولاً لضمان الحصول على أحدث البيانات
    await fetchConfirmedItems(true); // force refresh
    
    // ✅ انتظار قصير لضمان تحديث الـ state
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (import.meta.env.DEV) {
      console.log('🔍 handleConfirmSupply called:', {
        confirmedItemsLength: confirmedItems.length,
        confirmedItems: confirmedItems.map(item => ({
          id: item.id,
          warehouse_item_id: item.warehouse_item_id,
          status: item.status,
          quantity_per_unit: item.quantity_per_unit,
          unit_price: item.unit_price
        })),
        projectId,
        selectedCategoryId
      });
    }

    if (confirmedItems.length === 0) {
      toast.error('يجب أن يحتوي التوريد على صنف واحد على الأقل');
      return;
    }

    // ✅ التحقق من اختيار قسم الفائض (إجباري)
    if (!selectedCategoryId || selectedCategoryId === '') {
      toast.error('يرجى اختيار قسم الفائض قبل تأكيد التوريد');
      return;
    }

    if (!window.confirm('هل أنت متأكد من تأكيد التوريد؟ سيتم نقل المشروع لحالة "تم التوريد".')) {
      return;
    }

    try {
      setConfirmingSupply(true);

      // ✅ حساب التكلفة الفعلية
      const actualUnitCost = confirmedItems.reduce((sum, item) => {
        const itemTotal = parseFloat(item.unit_price || 0) * parseFloat(item.quantity_per_unit || 0);
        return sum + itemTotal;
      }, 0);
      const actualTotalCost = actualUnitCost * quantity;

      // ✅ حساب المبلغ المتاح والفائض
      const availableAmountInfo = getAvailableAmountInfo();
      const availableAmount = availableAmountInfo.amount || 0;
      const surplusAmount = availableAmount - actualTotalCost;

      // ✅ إعداد payload التأكيد
      const confirmPayload = {
        notes: notes.trim() || '',
        surplus_category_id: parseInt(selectedCategoryId),
      };

      // ✅ إرسال مبلغ الفائض
      if (surplusAmount > 0) {
        confirmPayload.surplus_amount = parseFloat(surplusAmount.toFixed(2));
      }

      if (import.meta.env.DEV) {
        console.log('📤 Sending confirm request:', {
          url: `/projects/${projectId}/warehouse/confirm`,
          payload: confirmPayload,
          confirmedItemsCount: confirmedItems.length,
          confirmedItems: confirmedItems.map(item => ({
            id: item.id,
            warehouse_item_id: item.warehouse_item_id,
            status: item.status
          }))
        });
      }

      const response = await apiClient.post(`/projects/${projectId}/warehouse/confirm`, confirmPayload);

      if (response.data.success) {
        toast.success('تم تأكيد التوريد بنجاح');

        // ✅ تحديث حالة المشروع محلياً بدلاً من إعادة الجلب (لتقليل الطلبات)
        setProject(prev => ({
          ...prev,
          status: 'تم التوريد'
        }));

        // ✅ الانتقال إلى صفحة العرض (ستقوم بجلب البيانات تلقائياً)
        navigate(`/project-management/projects/${projectId}/supply`);
      } else {
        toast.error(response.data.message || 'فشل تأكيد التوريد');
      }
    } catch (error) {
      console.error('Error confirming supply:', error);
      toast.error(error.response?.data?.message || 'فشل تأكيد التوريد');
    } finally {
      setConfirmingSupply(false);
    }
  };

  // ✅ التحقق من حالة المشروع - هل يمكن تأكيد التوريد؟
  const canConfirmSupply = () => {
    if (!project) return false;
    // ✅ يمكن التأكيد فقط إذا كان المشروع في حالة "قيد التوريد" وليس "تم التوريد"
    return project.status === 'قيد التوريد';
  };

  // 💱 Handle Shekel Conversion
  const handleConvertToShekel = async () => {
    const rate = parseFloat(exchangeRate);
    if (!rate || rate <= 0) {
      toast.error('يرجى إدخال سعر صرف صحيح');
      return;
    }

    const transferDiscount = parseFloat(transferDiscountPercentage) || 0;
    if (transferDiscount <= 0) {
      toast.error('نسبة خصم النقل يجب أن تكون أكبر من صفر');
      return;
    }
    if (transferDiscount > 100) {
      toast.error('نسبة خصم النقل يجب أن تكون أقل من أو تساوي 100');
      return;
    }

    try {
      setConvertingToShekel(true);
      const response = await apiClient.post(`/project-proposals/${projectId}/convert-to-shekel`, {
        shekel_exchange_rate: rate,
        transfer_discount_percentage: transferDiscount
      });

      if (response.data.success) {
        toast.success(response.data.message || (isEditingShekel ? 'تم تحديث التحويل إلى شيكل بنجاح' : 'تم التحويل إلى شيكل بنجاح'));
        setShowShekelModal(false);
        setIsEditingShekel(false);
        setExchangeRate('');
        setTransferDiscountPercentage(0);
        // ✅ تحديث البيانات فوراً
        await fetchProjectData();
        await fetchConfirmedItems(true);
      }
    } catch (error) {
      console.error('Error converting to shekel:', error);
      toast.error(error.response?.data?.message || 'فشل التحويل إلى شيكل');
    } finally {
      setConvertingToShekel(false);
    }
  };

  // Check if project needs shekel conversion
  const needsShekelConversion = !project?.shekel_exchange_rate;

  // ✅ التحقق من إمكانية تعديل التحويل للشيكل
  const canEditShekelConversion = () => {
    if (!project) return false;
    // لا يمكن التعديل إذا كانت حالة المشروع "منتهي" فقط
    if (project.status === 'منتهي') return false;
    // ✅ السماح بالتعديل حتى في حالة "تم التوريد"
    return true;
  };

  // ✅ فتح modal التعديل مع ملء القيم الحالية
  const handleEditShekelConversion = () => {
    if (!canEditShekelConversion()) {
      toast.error('لا يمكن تعديل التحويل للشيكل بعد انتقال المشروع إلى حالة "منتهي"');
      return;
    }
    setIsEditingShekel(true);
    setExchangeRate(project?.shekel_exchange_rate?.toString() || '');
    setTransferDiscountPercentage(project?.transfer_discount_percentage || 0);
    setShowShekelModal(true);
  };

  // ✅ فتح modal التحويل الجديد
  const handleNewShekelConversion = () => {
    setIsEditingShekel(false);
    setExchangeRate('');
    setTransferDiscountPercentage(0);
    setShowShekelModal(true);
  };

  // فلترة الأصناف المتاحة للبحث
  const filteredAvailableItems = availableItems.filter(item => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.item_name?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
  });

  // فلترة الأصناف المتاحة (استبعاد الموجودة)
  const availableForAdd = filteredAvailableItems.filter(item =>
    !confirmedItems.some(ci => ci.warehouse_item_id === item.id)
  );

  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatShekel = (amount) => {
    if (!amount || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('he-IL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getCurrencySymbol = () => {
    return currency === 'ILS' ? '₪' : '$';
  };

  // if (loading) {
  //   return (
  //     <div className="flex justify-center items-center min-h-screen">
  //       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-gray-50" style={ { fontFamily: 'Cairo, sans-serif' } }>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */ }
        <div className="mb-6 flex flex-col gap-4">
          <div>
            <Link
              to={ `/project-management/projects/${projectId}` }
              className="inline-flex items-center text-sky-600 hover:text-sky-700 mb-4"
            >
              <ArrowRight className="w-4 h-4 ml-2" />
              العودة لتفاصيل المشروع
            </Link>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Edit className="w-8 h-8 text-sky-600" />
              تعديل التوريد المؤكد - مشروع { getProjectCode(project, `#${projectId}`) }
            </h1>
          </div>

          {/* زر إسناد الباحث (يظهر من البداية، يتفعّل بعد "تم التوريد") */ }
          { isProjectManager && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={ () => setAssignModalOpen(true) }
                disabled={ !project || project.status !== 'تم التوريد' }
                className={ `inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all ${
                  project && project.status === 'تم التوريد'
                    ? 'bg-amber-500 hover:bg-amber-600 text-white'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }` }
                title={
                  !project
                    ? ''
                    : project.status === 'تم التوريد'
                      ? 'إسناد/تعديل الباحث لهذا المشروع'
                      : 'يتوفر زر الإسناد بعد أن تصبح حالة المشروع "تم التوريد"'
                }
              >
                <UserCheck className="w-4 h-4" />
                إسناد باحث
              </button>
              { project && project.status !== 'تم التوريد' && (
                <span className="text-xs text-gray-500">
                  حالة المشروع الحالية: <span className="font-semibold">{ project.status }</span>
                </span>
              ) }
            </div>
          ) }
        </div>

        <form onSubmit={ handleSubmit }>
          {/* Project Info */ }
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">معلومات المشروع</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">اسم المشروع</p>
                <p className="text-lg font-semibold text-gray-800">
                  { project?.project_name || project?.donor_name || project?.name || project?.project_description || project?.description || '-' }
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">عدد الطرود</p>
                <input
                  type="number"
                  min="1"
                  value={ quantity }
                  onChange={ (e) => setQuantity(parseInt(e.target.value) || 1) }
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">عدد المستفيدين</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={ beneficiariesCount || '' }
                    onChange={ (e) => setBeneficiariesCount(e.target.value) }
                    onBlur={ handleUpdateBeneficiaries }
                    placeholder="أدخل عدد المستفيدين"
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    disabled={ updatingBeneficiaries }
                  />
                  { updatingBeneficiaries && (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
                  ) }
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">الحالة</p>
                <span className="inline-block px-3 py-1 bg-teal-500 text-white rounded-full text-sm font-medium">
                  { project?.status || 'تم التوريد' }
                </span>
              </div>
            </div>

            {/* Financial Summary */}
            { (() => {
              const rate = parseFloat(project?.shekel_exchange_rate || 0);
              const amountUSD = parseFloat(project?.amount_in_usd || 0);
              const netAmountUSD = parseFloat(project?.net_amount || 0);
              const finalILS = parseFloat(project?.net_amount_shekel || 0);
              const hasConversion = finalILS > 0 && rate > 0;

              // Compute ILS equivalents for cards that only have USD values
              const amountILS = hasConversion ? amountUSD * rate : null;
              const netAmountILS = hasConversion ? netAmountUSD * rate : null;

              const fmtUSD = (v) => `${Number(v).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USD`;
              const fmtILS = (v) => `${Number(v).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ILS`;

              const shareBase = hasConversion ? finalILS : netAmountUSD;
              const shareCurrency = hasConversion ? 'ILS' : 'USD';
              const sharePerBeneficiary = beneficiariesCount > 0 ? shareBase / beneficiariesCount : 0;
              const shareILS = hasConversion && beneficiariesCount > 0 ? sharePerBeneficiary : null;
              const shareUSD = !hasConversion && beneficiariesCount > 0 ? sharePerBeneficiary : (hasConversion && rate > 0 && beneficiariesCount > 0 ? sharePerBeneficiary / rate : null);

              const FinCard = ({ colorBg, colorBorder, colorIcon, colorLabel, colorMain, colorSub, icon: Icon, label, primary, secondary }) => (
                <div className={`${colorBg} p-4 rounded-2xl border ${colorBorder} flex flex-col items-center text-center`}>
                  <div className={`p-2.5 ${colorIcon} rounded-xl mb-2`}>
                    <Icon size={20} />
                  </div>
                  <p className={`text-xs ${colorLabel} font-medium mb-1`}>{label}</p>
                  <p className={`${colorMain} font-bold text-base leading-tight`}>{primary}</p>
                  {secondary && <p className={`text-[11px] ${colorSub} mt-0.5`}>{secondary}</p>}
                </div>
              );

              return (
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Banknote className="text-emerald-500" size={22} />
                    ملخص مالي
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {/* Beneficiaries */}
                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center text-center">
                      <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl mb-2"><Users size={20} /></div>
                      <p className="text-xs text-blue-800 font-medium mb-1">المستفيدين</p>
                      <p className="text-blue-900 font-bold text-base leading-tight">{beneficiariesCount || 0}</p>
                    </div>

                    {/* Exchange Rate */}
                    <div className="bg-sky-50/50 p-4 rounded-2xl border border-sky-100 flex flex-col items-center text-center">
                      <div className="p-2.5 bg-sky-100 text-sky-600 rounded-xl mb-2"><DollarSign size={20} /></div>
                      <p className="text-xs text-sky-800 font-medium mb-1">سعر الصرف</p>
                      {hasConversion ? (
                        <>
                          <p className="text-sky-900 font-bold text-base leading-tight">{rate.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                          <p className="text-[11px] text-sky-600 mt-0.5">1 USD = {rate} ILS</p>
                        </>
                      ) : (
                        <p className="text-sky-400 text-sm mt-1">لم يتم التحويل</p>
                      )}
                    </div>

                    {/* Before Admin Discount */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center text-center">
                      <div className="p-2.5 bg-slate-200 text-slate-600 rounded-xl mb-2"><DollarSign size={20} /></div>
                      <p className="text-xs text-slate-700 font-medium mb-1">قبل الخصم الإداري</p>
                      <p className="text-slate-900 font-bold text-base leading-tight">{fmtUSD(amountUSD)}</p>
                      {amountILS && <p className="text-[11px] text-slate-500 mt-0.5">{fmtILS(amountILS)}</p>}
                    </div>

                    {/* Before Transport Discount */}
                    <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 flex flex-col items-center text-center">
                      <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl mb-2"><TrendingDown size={20} /></div>
                      <p className="text-xs text-amber-800 font-medium mb-1">قبل خصم النقل</p>
                      <p className="text-amber-900 font-bold text-base leading-tight">{fmtUSD(netAmountUSD)}</p>
                      {netAmountILS && <p className="text-[11px] text-amber-600 mt-0.5">{fmtILS(netAmountILS)}</p>}
                    </div>

                    {/* After All Discounts */}
                    <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 flex flex-col items-center text-center">
                      <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl mb-2"><Banknote size={20} /></div>
                      <p className="text-xs text-emerald-800 font-medium mb-1">بعد الخصومات</p>
                      {hasConversion ? (
                        <>
                          <p className="text-emerald-900 font-bold text-base leading-tight">{fmtILS(finalILS)}</p>
                          <p className="text-[11px] text-emerald-600 mt-0.5">{fmtUSD(netAmountUSD)}</p>
                        </>
                      ) : (
                        <p className="text-emerald-900 font-bold text-base leading-tight">{fmtUSD(netAmountUSD)}</p>
                      )}
                    </div>

                    {/* Per Beneficiary Share */}
                    <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex flex-col items-center text-center shadow-sm">
                      <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl mb-2"><Calculator size={20} /></div>
                      <p className="text-xs text-indigo-800 font-medium mb-1">نصيب المستفيد</p>
                      {beneficiariesCount > 0 ? (
                        <>
                          <p className="text-indigo-900 font-bold text-base leading-tight">
                            {sharePerBeneficiary.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} {shareCurrency}
                          </p>
                          {hasConversion && shareUSD && (
                            <p className="text-[11px] text-indigo-500 mt-0.5">
                              {shareUSD.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USD
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-indigo-400 text-sm mt-1">0.00</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })() }

            {/* 💱 Shekel Conversion Info & Edit Button */ }
            { project && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 mb-1">معلومات التحويل للشيكل</p>
                    { needsShekelConversion ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-amber-600 font-medium">لم يتم التحويل للشيكل بعد</span>
                        <button
                          type="button"
                          onClick={ handleNewShekelConversion }
                          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm flex items-center gap-2"
                        >
                          <DollarSign className="w-4 h-4" />
                          تحويل للشيكل
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-green-600 font-medium">
                          تم التحويل: سعر الصرف { project.shekel_exchange_rate } 
                        </span>
                        <button
                          type="button"
                          onClick={ handleEditShekelConversion }
                          disabled={ !canEditShekelConversion() }
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={ !canEditShekelConversion() ? 'لا يمكن التعديل بعد انتقال المشروع إلى حالة "منتهي"' : 'تعديل سعر الصرف ونسبة الخصم' }
                        >
                          <Edit className="w-4 h-4" />
                          تعديل التحويل
                        </button>
                      </div>
                    ) }
                  </div>
                </div>
              </div>
            ) }
          </div>

          {/* Confirmed Items */ }
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Package className="w-6 h-6 text-sky-600" />
                الأصناف المؤكدة
              </h2>
              <button
                type="button"
                onClick={ () => setShowAddItemModal(true) }
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                إضافة صنف جديد
              </button>
            </div>

            { confirmedItems.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">لا توجد أصناف مؤكدة</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">اسم الصنف</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">الكمية للطرد</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">سعر الوحدة</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">السعر الإجمالي</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">المتوفر في المخزن</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    { confirmedItems.map((item) => {
                      // ✅ حساب الكمية المطلوبة والكمية المتوفرة
                      const quantityPerUnit = parseFloat(item.quantity_per_unit || 0);
                      const totalNeeded = quantityPerUnit * quantity;
                      const warehouseItem = availableItems.find(wItem => wItem.id === item.warehouse_item_id);
                      const availableQty = warehouseItem?.quantity_available || item.available_in_warehouse || item.warehouse_item?.quantity_available || 0;
                      const isInsufficient = totalNeeded > availableQty;

                      return (
                        <tr key={ item.id || item.warehouse_item_id } className={ `hover:bg-gray-50 transition-colors ${isInsufficient ? 'bg-red-50 border-l-4 border-red-500' : ''}` }>
                          <td className="py-4 px-4 text-sm text-gray-800 font-medium">
                            <div className="flex items-center gap-2">
                              { item.item_name || item.warehouse_item?.item_name || '-' }
                              { item.isNew && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                                  جديد
                                </span>
                              ) }
                              { isInsufficient && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                  <AlertCircle className="w-3 h-3" />
                                  غير كافي
                                </span>
                              ) }
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={ item.quantity_per_unit }
                              onChange={ (e) => handleUpdateItemQuantity(item.id || item.warehouse_item_id, e.target.value) }
                              className={ `w-24 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 ${isInsufficient ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                }` }
                            />
                          </td>
                          <td className="py-4 px-4 text-sm text-gray-700">
                            ₪{ formatCurrency(item.unit_price || 0) }
                          </td>
                          <td className="py-4 px-4 text-sm font-semibold text-sky-600">
                            ₪{ formatCurrency((item.quantity_per_unit || 0) * (item.unit_price || 0)) }
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className={ `text-sm font-medium ${isInsufficient ? 'text-red-700' : 'text-gray-700'}` }>
                                  { availableQty.toLocaleString('en-US') }
                                </span>
                                { isInsufficient && (
                                  <span className="text-xs text-red-600 flex items-center gap-1 font-medium">
                                    <AlertCircle className="w-3 h-3" />
                                    غير كافي
                                  </span>
                                ) }
                              </div>
                              { isInsufficient && (
                                <div className="text-xs text-red-600 mt-1">
                                  المطلوب: { totalNeeded.toLocaleString('en-US') } | المتوفر: { availableQty.toLocaleString('en-US') }
                                </div>
                              ) }
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <button
                              type="button"
                              onClick={ () => handleDeleteItem(item.id || item.warehouse_item_id) }
                              className="p-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    }) }
                  </tbody>
                </table>
              </div>
            ) }
          </div>

          {/* Surplus Amount & Category */ }
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-green-600" />
              صندوق الفائض
            </h2>

            {/* Surplus Amount */ }
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  مبلغ صندوق الفائض
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={ surplusAmount }
                  onChange={ (e) => setSurplusAmount(parseFloat(e.target.value) || 0) }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500 mt-2">
                  يمكنك تعديل مبلغ صندوق الفائض يدوياً
                </p>
              </div>
              <div className="flex items-end">
                <div className={ `w-full px-4 py-3 rounded-xl ${surplusAmount >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}` }>
                  <p className="text-sm font-medium mb-1">
                    { surplusAmount >= 0 ? 'فائض' : 'عجز' }
                  </p>
                  <p className="text-2xl font-bold">
                    { getCurrencySymbol() }{ currency === 'ILS' ? formatShekel(Math.abs(surplusAmount)) : formatCurrency(Math.abs(surplusAmount)) }
                  </p>
                  <p className="text-xs mt-1 opacity-75">
                    { currency === 'ILS' ? 'شيكل' : 'دولار' }
                  </p>
                </div>
              </div>
            </div>

            {/* Surplus Category */ }
            { surplusCategories.length > 0 && (
              <div className="border-t pt-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-sky-600" />
                  قسم الفائض <span className="text-red-500">*</span>
                </label>
                <select
                  value={ selectedCategoryId }
                  onChange={ (e) => setSelectedCategoryId(e.target.value) }
                  className={ `w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${!selectedCategoryId || selectedCategoryId === ''
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300'
                    }` }
                  disabled={ loadingCategories }
                  required
                >
                  <option value="">-- اختر قسم الفائض (مطلوب) --</option>
                  { surplusCategories.map((category) => (
                    <option key={ category.id } value={ category.id }>
                      { category.name }
                      { category.statistics && ` (رصيد: ${getCurrencySymbol()}${currency === 'ILS' ? formatShekel(category.statistics.total_balance) : formatCurrency(category.statistics.total_balance)})` }
                    </option>
                  )) }
                </select>
                { (!selectedCategoryId || selectedCategoryId === '') && (
                  <p className="text-xs text-red-600 mt-2">
                    ⚠️ اختيار قسم الفائض إجباري لحفظ التعديلات
                  </p>
                ) }
                { selectedCategoryId && (
                  <p className="text-xs text-gray-500 mt-2">
                    يمكن تصنيف المشاريع حسب الأقسام لمتابعة رصيد كل قسم بشكل منفصل
                  </p>
                ) }
              </div>
            ) }
          </div>

          {/* Notes */ }
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">ملاحظات التعديل (اختياري)</label>
            <textarea
              value={ notes }
              onChange={ (e) => setNotes(e.target.value) }
              rows={ 3 }
              placeholder="أدخل ملاحظات حول التعديل..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>

          {/* 👦 Orphan Selection Widget */ }
          { project && ['كفالة', 'كفالات', 'أيتام', 'ايتام'].some(keyword => {
            const typeStr = typeof project.project_type === 'string' 
              ? project.project_type 
              : (project.project_type?.name_ar || project.project_type?.name || '');
            return typeStr.includes(keyword);
          }) && (
            <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <Users className="w-6 h-6 text-purple-600" />
                  اختيار الأيتام المستفيدين
                </h2>
                <label className="flex items-center cursor-pointer gap-2">
                  <span className="text-sm font-medium text-gray-600">إضافة أيتام لهذا المشروع؟</span>
                  <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out bg-gray-200 rounded-full cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ showOrphanWidget }
                      onChange={ (e) => setShowOrphanWidget(e.target.checked) }
                      className="absolute z-10 w-6 h-6 opacity-0 cursor-pointer peer"
                    />
                    <div className={ `absolute left-0 w-6 h-6 transition duration-200 ease-in-out bg-white border-2 border-gray-200 rounded-full peer-checked:translate-x-full peer-checked:border-blue-600 ${showOrphanWidget ? 'translate-x-full border-blue-600' : ''}` }></div>
                    <div className={ `w-full h-full rounded-full transition duration-200 ease-in-out ${showOrphanWidget ? 'bg-blue-600' : 'bg-gray-200'}` }></div>
                  </div>
                </label>
              </div>

              { showOrphanWidget && (
                <>
                  <OrphanSelectionWidget
                    project={ project }
                    initialSelectedOrphans={ existingOrphans.map(o => o.orphan_id_number || o.id_number || o.id) }
                    onSelectionSubmit={ setSelectedOrphansData }
                  />

                  <div className="flex justify-end mt-4">
                    <button
                      type="button"
                      onClick={ async () => {
                        if (!selectedOrphansData) return;
                        try {
                          setSubmitting(true);
                          const response = await apiClient.post(`/project-proposals/${projectId}/orphans`, selectedOrphansData);
                          if (response.data.success) {
                            toast.success('تم حفظ اختيار الأيتام بنجاح');
                            fetchProjectOrphans();
                          }
                        } catch (error) {
                          console.error('Error saving orphans:', error);
                          toast.error(error.response?.data?.message || 'حدث خطأ أثناء حفظ اختيار الأيتام');
                        } finally {
                          setSubmitting(false);
                        }
                      } }
                      disabled={ submitting || !selectedOrphansData }
                      className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
                    >
                      { submitting ? 'جاري الحفظ...' : 'حفظ اختيار الأيتام' }
                    </button>
                  </div>
                </>
              ) }
            </div>
          ) }

          {/* Action Buttons */ }
          <div className="flex items-center justify-end gap-4">
            <Link
              to={ `/project-management/projects/${projectId}` }
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
            >
              إلغاء
            </Link>
            <button
              type="submit"
              disabled={ submitting || confirmingSupply || confirmedItems.length === 0 || !selectedCategoryId || selectedCategoryId === '' }
              className="px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title={ !selectedCategoryId || selectedCategoryId === '' ? 'يرجى اختيار قسم الفائض أولاً' : '' }
            >
              { submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  حفظ التعديلات
                </>
              ) }
            </button>
            { canConfirmSupply() && (
              <button
                type="button"
                onClick={ handleConfirmSupply }
                disabled={ submitting || confirmingSupply || confirmedItems.length === 0 || !selectedCategoryId || selectedCategoryId === '' }
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title={ !selectedCategoryId || selectedCategoryId === '' ? 'يرجى اختيار قسم الفائض أولاً' : '' }
              >
                { confirmingSupply ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    جاري التأكيد...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    تأكيد التوريد
                  </>
                ) }
              </button>
            ) }
          </div>
        </form>

        {/* Modal إسناد الباحث من صفحة تعديل التوريد */ }
        { project && (
          <AssignProjectModal
            isOpen={ assignModalOpen }
            onClose={ () => setAssignModalOpen(false) }
            projectId={ project.id || projectId }
            project={ project }
            onSuccess={ () => {
              // بعد الإسناد، نعيد تحميل بيانات المشروع للتأكد من تحديث الحالة / الباحث
              fetchProjectData();
              setAssignModalOpen(false);
            } }
          />
        ) }

        {/* Add Item Modal */ }
        { showAddItemModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Plus className="w-6 h-6 text-green-600" />
                  إضافة صنف جديد
                </h3>
                <button
                  onClick={ () => {
                    setShowAddItemModal(false);
                    setNewItem({ warehouse_item_id: '', quantity_per_unit: '' });
                    setSearchQuery('');
                  } }
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Search */ }
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Search className="w-4 h-4 text-sky-600" />
                    البحث عن الصنف
                  </label>
                  <input
                    type="text"
                    value={ searchQuery }
                    onChange={ (e) => setSearchQuery(e.target.value) }
                    placeholder="ابحث بالاسم أو الفئة..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {/* Select Item */ }
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">اختر الصنف</label>
                  { availableForAdd.length === 0 ? (
                    <div className="w-full px-4 py-8 border-2 border-gray-300 rounded-xl text-center bg-gray-50">
                      <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500">لا توجد أصناف متاحة للإضافة</p>
                    </div>
                  ) : (
                    <select
                      value={ newItem.warehouse_item_id }
                      onChange={ (e) => setNewItem({ ...newItem, warehouse_item_id: e.target.value }) }
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="">-- اختر صنف --</option>
                      { availableForAdd.map((item) => (
                        <option key={ item.id } value={ item.id }>
                          { item.item_name } - (المتوفر: { item.quantity_available } { item.unit || 'قطعة' })
                        </option>
                      )) }
                    </select>
                  ) }
                </div>

                {/* Quantity */ }
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">الكمية للطرد الواحد</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={ newItem.quantity_per_unit }
                    onChange={ (e) => setNewItem({ ...newItem, quantity_per_unit: e.target.value }) }
                    placeholder="أدخل الكمية"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {/* Actions */ }
                <div className="flex items-center justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={ () => {
                      setShowAddItemModal(false);
                      setNewItem({ warehouse_item_id: '', quantity_per_unit: '' });
                      setSearchQuery('');
                    } }
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={ handleAddNewItem }
                    disabled={ !newItem.warehouse_item_id || !newItem.quantity_per_unit }
                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    إضافة
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) }

        {/* 💱 Shekel Conversion Modal */ }
        { showShekelModal && project && (
          <ShekelConversionModal
            isOpen={ showShekelModal }
            onClose={ () => {
              setShowShekelModal(false);
              setIsEditingShekel(false);
              setExchangeRate('');
              setTransferDiscountPercentage(0);
            } }
            project={ project }
            exchangeRate={ exchangeRate }
            setExchangeRate={ setExchangeRate }
            transferDiscountPercentage={ transferDiscountPercentage }
            setTransferDiscountPercentage={ setTransferDiscountPercentage }
            onConvert={ handleConvertToShekel }
            isConverting={ convertingToShekel }
            formatCurrency={ formatCurrency }
            isEditing={ isEditingShekel }
          />
        ) }
      </div>
    </div>
  );
};

// 💱 Shekel Conversion Modal Component
const ShekelConversionModal = ({ isOpen, onClose, project, exchangeRate, setExchangeRate, transferDiscountPercentage, setTransferDiscountPercentage, onConvert, isConverting, formatCurrency, isEditing = false }) => {
  if (!isOpen) return null;

  const netAmount = project?.net_amount_usd || project?.net_amount || 0;
  const rate = parseFloat(exchangeRate) || 0;
  const transferDiscount = parseFloat(transferDiscountPercentage) || 0;

  // ✅ حساب المبلغ بعد تطبيق نسبة خصم النقل
  const transferDiscountAmount = (netAmount * transferDiscount) / 100;
  const amountAfterTransferDiscount = netAmount - transferDiscountAmount;

  // ✅ حساب المبلغ بالشيكل بعد الخصم
  const convertedAmount = amountAfterTransferDiscount * rate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-amber-600" />
            { isEditing ? 'تعديل التحويل للشيكل' : 'تحويل المبلغ إلى شيكل' }
          </h3>
          <button
            onClick={ onClose }
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Current Amount */ }
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm text-gray-600 mb-1">المبلغ الحالي (دولار)</p>
            <p className="text-2xl font-bold text-gray-800">${ formatCurrency(netAmount) }</p>
          </div>

          {/* Exchange Rate Input */ }
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              سعر الصرف (1 دولار = ؟ شيكل) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={ exchangeRate }
              onChange={ (e) => setExchangeRate(e.target.value) }
              placeholder="مثال: 3.65"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-lg"
            />
          </div>

          {/* Transfer Discount Percentage Input */ }
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              نسبة خصم النقل (%) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="100"
              value={ transferDiscountPercentage }
              onChange={ (e) => setTransferDiscountPercentage(e.target.value) }
              placeholder="مثال: 5 (مطلوب)"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-lg"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              نسبة خصم النقل مطلوبة ويجب أن تكون أكبر من صفر (مثال: 5%) - هذه النسبة تُخصم من المبلغ قبل التحويل للشيكل
            </p>
          </div>

          {/* Calculation Preview */ }
          { rate > 0 && (
            <div className="space-y-3">
              { transferDiscount > 0 && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-blue-600">المبلغ الأصلي:</p>
                    <p className="text-lg font-bold text-blue-700">${ formatCurrency(netAmount) }</p>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-blue-600">نسبة خصم النقل ({ transferDiscount }%):</p>
                    <p className="text-lg font-bold text-red-600">-${ formatCurrency(transferDiscountAmount) }</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t-2 border-blue-300">
                    <p className="text-sm font-medium text-blue-700">المبلغ بعد الخصم:</p>
                    <p className="text-xl font-bold text-blue-800">${ formatCurrency(amountAfterTransferDiscount) }</p>
                  </div>
                </div>
              ) }

              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <p className="text-sm text-green-600 mb-1">المبلغ بعد التحويل (شيكل)</p>
                <p className="text-2xl font-bold text-green-700">₪{ formatCurrency(convertedAmount) }</p>
                <p className="text-xs text-green-600 mt-1">
                  { transferDiscount > 0 ? (
                    <>المبلغ بعد الخصم ({ formatCurrency(amountAfterTransferDiscount) } دولار) × { rate } = { formatCurrency(convertedAmount) } شيكل</>
                  ) : (
                    <>سعر الصرف: 1 دولار = { rate } شيكل</>
                  ) }
                </p>
              </div>
            </div>
          ) }

          {/* Warning */ }
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            <p className="font-medium mb-1">⚠️ تنبيه مهم:</p>
            <p>
              { isEditing
                ? 'سيتم تحديث سعر الصرف ونسبة الخصم، وسيتم إعادة حساب المبلغ بالشيكل بناءً على القيم الجديدة.'
                : 'بعد التحويل، سيتم حساب جميع تكاليف التوريد والفائض بالشيكل. هذه العملية لا يمكن التراجع عنها.'
              }
            </p>
          </div>

          {/* Actions */ }
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              onClick={ onClose }
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={ onConvert }
              disabled={ isConverting || !rate || rate <= 0 || !transferDiscountPercentage || parseFloat(transferDiscountPercentage) <= 0 }
              className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              { isConverting ? (
                <>
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  { isEditing ? 'جاري التحديث...' : 'جاري التحويل...' }
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  { isEditing ? 'تأكيد التعديل' : 'تأكيد التحويل' }
                </>
              ) }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditSupply;

