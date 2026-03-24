import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { useCacheInvalidation } from '../../../hooks/useCacheInvalidation';
import { getProjectCode } from '../../../utils/helpers';
import { toast } from 'react-toastify';
import {
  ArrowRight,
  ArrowLeft,
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
  Users,
} from 'lucide-react';
import { OrphanSelectionWidget } from '../components/OrphanSelectionWidget';

const ProjectSupply = () => {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { invalidateProjectsCache } = useCacheInvalidation();
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [availableItems, setAvailableItems] = useState([]);
  const [summary, setSummary] = useState({
    unit_cost: 0,
    total_supply_cost: 0,
    expected_surplus: 0,
    has_deficit: false,
    deficit_amount: 0,
  });
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItem, setNewItem] = useState({
    warehouse_item_id: '',
    quantity_per_unit: '',
  });
  const [pendingChanges, setPendingChanges] = useState(false); // لتتبع التغييرات غير المحفوظة

  // 💱 Shekel Conversion State
  const [showShekelModal, setShowShekelModal] = useState(false);
  const [isEditingShekel, setIsEditingShekel] = useState(false); // ✅ للتمييز بين التحويل الجديد والتعديل
  const [exchangeRate, setExchangeRate] = useState('');
  const [transferDiscountPercentage, setTransferDiscountPercentage] = useState(0); // ✅ نسبة خصم النقل (هي نفسها نسبة الخصم للتحويل)
  const [convertingToShekel, setConvertingToShekel] = useState(false);

  // 📦 Surplus Categories State
  const [surplusCategories, setSurplusCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(false);

  // 👥 Beneficiaries State
  const [beneficiariesCount, setBeneficiariesCount] = useState('');
  const [updatingBeneficiaries, setUpdatingBeneficiaries] = useState(false);

  // 👦 Orphan Selection State
  const [selectedOrphansData, setSelectedOrphansData] = useState(null);
  const [existingOrphans, setExistingOrphans] = useState([]);
  const [loadingOrphans, setLoadingOrphans] = useState(false);
  const [showOrphanWidget, setShowOrphanWidget] = useState(false); // ✅ التحكم في ظهور قسم اختيار الأيتام

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

  // ⚠️ Insufficient Items Warning Modal
  const [showInsufficientItemsModal, setShowInsufficientItemsModal] = useState(false);
  const [insufficientItemsList, setInsufficientItemsList] = useState([]);

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
      fetchCart();
      fetchAvailableItems();
      fetchSurplusCategories();
    }
  }, [projectId]);

  // تحديث الـ summary عند تغيير الأصناف أو العدد أو المشروع
  useEffect(() => {
    if (project && (cartItems.length > 0 || quantity)) {
      updateSummaryLocally(cartItems, quantity);
    }
  }, [cartItems, quantity, project]);

  const fetchProjectData = async (forceRefresh = false) => {
    try {
      // ✅ إضافة timestamp لإجبار التحديث الفوري عند forceRefresh
      const params = forceRefresh ? { _t: Date.now() } : {};

      const response = await apiClient.get(`/project-proposals/${projectId}`, {
        params,
        headers: forceRefresh ? {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        } : {}
      });
      if (response.data.success) {
        const projectData = response.data.project || response.data.data || response.data;
        setProject(projectData);
        setQuantity(projectData.quantity || 1);
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error('فشل تحميل بيانات المشروع');
    }
  };

  const fetchCart = async (forceRefresh = false) => {
    try {
      // setLoading(true);
      // ✅ إضافة timestamp لإجبار التحديث الفوري عند forceRefresh
      const params = forceRefresh ? { _t: Date.now() } : {};

      const response = await apiClient.get(`/projects/${projectId}/warehouse`, {
        params,
        headers: forceRefresh ? {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        } : {}
      });
      console.log('🛒 Cart API Response:', response.data);

      if (response.data.success) {
        const data = response.data.data || response.data;
        const summaryData = data.summary || data;

        console.log('🛒 Cart Items:', data.items);
        console.log('🛒 Summary Data:', summaryData);
        console.log('🛒 Project Data:', data.project);

        setCartItems(data.items || []);
        const loadedItems = data.items || [];
        const loadedQuantity = data.project?.quantity || quantity;

        // ✅ تحديث بيانات المشروع من الـ API
        if (data.project) {
          setProject(prev => ({
            ...prev,
            ...data.project,
            quantity: data.project.quantity || prev?.quantity || 0,
          }));
          setQuantity(data.project.quantity || 1);

          // ✅ جلب قسم الفائض الحالي من بيانات المشروع
          if (data.project.surplus_category_id !== null && data.project.surplus_category_id !== undefined) {
            setSelectedCategoryId(data.project.surplus_category_id.toString());
            if (import.meta.env.DEV) {
              console.log('📦 Loaded surplus_category_id:', data.project.surplus_category_id);
            }
          } else {
            // ✅ إذا كانت القيمة null أو undefined، نعيد تعيينها إلى string فارغ
            setSelectedCategoryId('');
            if (import.meta.env.DEV) {
              console.log('📦 No surplus_category_id found, resetting to empty');
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching cart:', error);
      if (!error.isConnectionError) {
        toast.error('فشل تحميل سلة التوريد');
      }
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
      console.log('🏪 Available Items Response:', response.data);

      if (response.data.success) {
        // البيانات تأتي في response.data.data.data (paginated)
        const items = response.data.data?.data || response.data.data || [];
        console.log('🏪 Available Items:', items);
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
      console.log('📦 Surplus Categories Response:', response.data);

      if (response.data.success) {
        const categories = response.data.data || [];
        console.log('📦 Surplus Categories:', categories);
        setSurplusCategories(categories);
      }
    } catch (error) {
      console.error('Error fetching surplus categories:', error);
      // لا نعرض خطأ هنا لأن الأقسام اختيارية
    } finally {
      setLoadingCategories(false);
    }
  };

  // Get available amount and currency helper
  const getAvailableAmountInfo = () => {
    if (project?.shekel_exchange_rate && project?.net_amount_shekel) {
      return {
        amount: project.net_amount_shekel,
        currency: 'ILS',
        symbol: '₪',
        originalAmount: project.net_amount_usd || project.net_amount || 0,
        exchangeRate: project.shekel_exchange_rate,
      };
    }
    return {
      amount: project?.net_amount_usd || project?.net_amount || 0,
      currency: 'USD',
      symbol: '$',
      originalAmount: null,
      exchangeRate: null,
    };
  };

  // تحديث الـ summary محلياً بناءً على الأصناف الحالية
  // ✅ عملية حساب الفائض:
  // الفائض = المبلغ الصافي بالشيكل - (تكلفة الطرد الواحد * العدد)
  // حيث:
  // - المبلغ الصافي بالشيكل = project.net_amount_shekel (إذا كان محولاً) أو project.net_amount_usd (إذا لم يكن محولاً)
  // - تكلفة الطرد الواحد = مجموع (unit_price * quantity_per_unit) لكل صنف في السلة
  // - العدد = quantity (عدد الطرود)
  const updateSummaryLocally = (items, projectQuantity) => {
    // ✅ حساب تكلفة الطرد الواحد: مجموع (سعر الوحدة * الكمية لكل صنف)
    const unitCost = items.reduce((sum, item) => {
      const itemTotal = parseFloat(item.unit_price || 0) * parseFloat(item.quantity_per_unit || 0);
      return sum + itemTotal;
    }, 0);

    // ✅ حساب التكلفة الإجمالية: تكلفة الطرد الواحد * العدد
    const totalCost = unitCost * projectQuantity;

    // ✅ الحصول على المبلغ المتاح (بالشيكل إذا كان محولاً، أو بالدولار)
    const amountInfo = getAvailableAmountInfo();
    const availableAmount = amountInfo.amount || 0;

    // ✅ حساب الفائض: المبلغ الصافي - (تكلفة الطرد * العدد)
    const expectedSurplus = availableAmount - totalCost;
    const hasDeficit = expectedSurplus < 0;

    setSummary(prev => ({
      ...prev,
      unit_cost: unitCost,
      total_supply_cost: totalCost,
      expected_surplus: expectedSurplus,
      has_deficit: hasDeficit,
      deficit_amount: hasDeficit ? Math.abs(expectedSurplus) : 0,
      available_amount: availableAmount,
      currency: amountInfo.currency || 'USD',
    }));
  };

  const handleAddItem = () => {
    if (!newItem.warehouse_item_id || !newItem.quantity_per_unit || parseFloat(newItem.quantity_per_unit) <= 0) {
      toast.error('الرجاء اختيار صنف وإدخال كمية صحيحة');
      return;
    }

    // البحث عن الصنف المحدد
    const selectedWarehouseItem = availableItems.find(item => item.id === parseInt(newItem.warehouse_item_id));
    if (!selectedWarehouseItem) {
      toast.error('الصنف المحدد غير موجود');
      return;
    }

    // التحقق من الكمية المتوفرة
    const qtyPerUnit = parseFloat(newItem.quantity_per_unit);
    const totalNeeded = qtyPerUnit * quantity;
    if (totalNeeded > selectedWarehouseItem.quantity_available) {
      toast.error(`الكمية غير كافية! المتوفر: ${selectedWarehouseItem.quantity_available}`);
      return;
    }

    // التحقق إذا كان الصنف موجود بالفعل في السلة
    const existingItem = cartItems.find(item => item.warehouse_item_id === parseInt(newItem.warehouse_item_id));
    if (existingItem) {
      toast.warning('الصنف موجود بالفعل في السلة');
      return;
    }

    // إضافة الصنف محلياً للسلة
    const newCartItem = {
      id: Date.now(), // ID مؤقت
      warehouse_item_id: parseInt(newItem.warehouse_item_id),
      warehouse_item: selectedWarehouseItem,
      item_name: selectedWarehouseItem.item_name,
      quantity_per_unit: qtyPerUnit,
      unit_price: parseFloat(selectedWarehouseItem.unit_price),
      total_price_per_unit: qtyPerUnit * parseFloat(selectedWarehouseItem.unit_price),
      available_in_warehouse: selectedWarehouseItem.quantity_available,
    };

    const updatedCartItems = [...cartItems, newCartItem];
    setCartItems(updatedCartItems);
    setPendingChanges(true);
    updateSummaryLocally(updatedCartItems, quantity);

    // تحديث قائمة الأصناف المتوفرة محلياً (تقليل الكمية المتوفرة)
    setAvailableItems(prev => prev.map(item =>
      item.id === parseInt(newItem.warehouse_item_id)
        ? { ...item, quantity_available: item.quantity_available - totalNeeded }
        : item
    ));

    toast.success('تم إضافة الصنف للسلة');
    setShowAddItemModal(false);
    setNewItem({ warehouse_item_id: '', quantity_per_unit: '' });
  };

  const handleUpdateItemQuantity = (itemId, newQuantity) => {
    if (!newQuantity || parseFloat(newQuantity) <= 0) {
      toast.error('الكمية يجب أن تكون أكبر من صفر');
      return;
    }

    const item = cartItems.find(i => i.id === itemId);
    if (!item) {
      toast.error('الصنف غير موجود في السلة');
      return;
    }

    const newQty = parseFloat(newQuantity);
    const totalNeeded = newQty * quantity;
    const availableQty = item.available_in_warehouse || item.warehouse_item?.quantity_available || 0;

    if (totalNeeded > availableQty) {
      toast.error(`الكمية غير كافية! المتوفر: ${availableQty}`);
      return;
    }

    // تحديث الكمية محلياً
    const updatedCartItems = cartItems.map(i =>
      i.id === itemId
        ? {
          ...i,
          quantity_per_unit: newQty,
          total_price_per_unit: newQty * parseFloat(i.unit_price),
        }
        : i
    );

    setCartItems(updatedCartItems);
    setPendingChanges(true);
    updateSummaryLocally(updatedCartItems, quantity);
    toast.success('تم تحديث الكمية');
  };

  const handleDeleteItem = (itemId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الصنف من السلة؟')) {
      return;
    }

    const item = cartItems.find(i => i.id === itemId);
    if (!item) {
      toast.error('الصنف غير موجود في السلة');
      return;
    }

    // حذف الصنف محلياً
    const updatedCartItems = cartItems.filter(i => i.id !== itemId);
    setCartItems(updatedCartItems);
    setPendingChanges(true);
    updateSummaryLocally(updatedCartItems, quantity);

    // إعادة الكمية المتوفرة للأصناف المتاحة
    const totalNeeded = (item.quantity_per_unit || 0) * quantity;
    setAvailableItems(prev => prev.map(warehouseItem =>
      warehouseItem.id === item.warehouse_item_id
        ? { ...warehouseItem, quantity_available: warehouseItem.quantity_available + totalNeeded }
        : warehouseItem
    ));

    toast.success('تم حذف الصنف من السلة');
  };

  const handleUpdateProjectQuantity = () => {
    if (!quantity || quantity < 1) {
      toast.error('العدد يجب أن يكون 1 على الأقل');
      return;
    }

    // ✅ التحقق من كفاية الكميات لجميع الأصناف
    let hasInsufficientItems = false;
    const insufficientItems = [];

    cartItems.forEach(item => {
      const quantityPerUnit = parseFloat(item.quantity_per_unit || 0);
      const totalNeeded = quantityPerUnit * quantity;
      const availableQty = item.available_in_warehouse || item.warehouse_item?.quantity_available || 0;

      if (totalNeeded > availableQty) {
        hasInsufficientItems = true;
        insufficientItems.push({
          name: item.item_name || item.warehouse_item?.item_name || 'صنف',
          needed: totalNeeded,
          available: availableQty
        });
      }
    });

    if (hasInsufficientItems) {
      // عرض تنبيه لكل صنف غير كافي
      insufficientItems.forEach(item => {
        toast.warning(
          `⚠️ الكمية غير كافية للصنف "${item.name}"!\n` +
          `المطلوب: ${item.needed.toLocaleString('en-US')} | المتوفر: ${item.available.toLocaleString('en-US')}`,
          { autoClose: 5000 }
        );
      });
      return; // لا نحدث العدد إذا كانت الكميات غير كافية
    }

    // تحديث العدد محلياً
    updateSummaryLocally(cartItems, quantity);
    setPendingChanges(true);
    toast.success('تم تحديث العدد');
  };

  // ✅ التحقق من كفاية جميع الأصناف
  const checkItemsAvailability = () => {
    const insufficient = [];

    cartItems.forEach(item => {
      const quantityPerUnit = parseFloat(item.quantity_per_unit || 0);
      const totalNeeded = quantityPerUnit * quantity;
      const availableQty = item.available_in_warehouse || item.warehouse_item?.quantity_available || 0;

      if (totalNeeded > availableQty) {
        const shortage = totalNeeded - availableQty;
        const shortageCost = shortage * parseFloat(item.unit_price || 0);
        insufficient.push({
          id: item.id,
          name: item.item_name || item.warehouse_item?.item_name || 'صنف',
          needed: totalNeeded,
          available: availableQty,
          shortage: shortage,
          shortageCost: shortageCost,
          unitPrice: parseFloat(item.unit_price || 0)
        });
      }
    });

    return insufficient;
  };

  const handleConfirmSupply = async () => {
    if (cartItems.length === 0) {
      toast.error('السلة فارغة! يرجى إضافة أصناف أولاً');
      return;
    }

    // ✅ التحقق من اختيار قسم الفائض (إجباري)
    if (!selectedCategoryId || selectedCategoryId === '') {
      toast.error('يرجى اختيار قسم الفائض قبل تأكيد التوريد');
      return;
    }

    // ✅ التحقق من كفاية جميع الأصناف
    const insufficientItems = checkItemsAvailability();

    if (insufficientItems.length > 0) {
      // ✅ عرض modal للتحذير من النقص
      setInsufficientItemsList(insufficientItems);
      setShowInsufficientItemsModal(true);
      return;
    }

    // ✅ إذا كانت جميع الأصناف كافية، المتابعة بالطريقة العادية
    const currencySymbol = availableAmountInfo.symbol;
    const confirmMessage = summary.has_deficit
      ? `يوجد عجز قدره ${currencySymbol}${summary.deficit_amount.toFixed(2)}. هل تريد المتابعة؟`
      : 'هل أنت متأكد من تأكيد التوريد؟';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    await proceedWithSupply();
  };

  // ✅ متابعة التوريد (مع أو بدون نقص)
  const proceedWithSupply = async (proceedWithShortage = false) => {

    try {
      setIsSubmitting(true);

      // ✅ إذا كان هناك نقص وتم الموافقة، تحديث الكميات بناءً على المتوفر
      let itemsToProcess = cartItems;
      if (proceedWithShortage && insufficientItemsList.length > 0) {
        itemsToProcess = cartItems.map(item => {
          const insufficientItem = insufficientItemsList.find(ins => ins.id === item.id);
          if (insufficientItem) {
            // ✅ تحديث الكمية للصنف الناقص بناءً على المتوفر
            const maxQuantityPerUnit = insufficientItem.available / quantity;
            const updatedItem = {
              ...item,
              quantity_per_unit: maxQuantityPerUnit,
              total_price_per_unit: maxQuantityPerUnit * parseFloat(item.unit_price || 0)
            };
            // ✅ تحديث السلة محلياً لتحديث التكلفة
            setCartItems(prev => prev.map(prevItem =>
              prevItem.id === item.id ? updatedItem : prevItem
            ));
            return updatedItem;
          }
          return item;
        });
        // ✅ تحديث الـ summary بناءً على الكميات المحدثة
        updateSummaryLocally(itemsToProcess, quantity);
      }

      // 1. إضافة/تحديث جميع الأصناف في الـ Backend
      for (const item of itemsToProcess) {
        try {
          // التحقق إذا كان الصنف موجود في الـ Backend (له ID حقيقي وليس مؤقت)
          if (item.id && item.id < 1000000000) {
            // ID حقيقي - تحديث
            await apiClient.patch(`/projects/${projectId}/warehouse/items/${item.id}`, {
              quantity_per_unit: item.quantity_per_unit,
            });
          } else {
            // ID مؤقت - إضافة جديد
            await apiClient.post(`/projects/${projectId}/warehouse/items`, {
              warehouse_item_id: item.warehouse_item_id,
              quantity_per_unit: item.quantity_per_unit,
            });
          }
        } catch (error) {
          console.error('Error saving item:', error);
          if (error.response?.status === 422) {
            const errorData = error.response.data;
            if (errorData.error === 'الكمية غير كافية') {
              toast.error(`${errorData.message}\nالمتوفر: ${errorData.available_quantity}`);
            } else {
              toast.error(errorData.message || 'خطأ في البيانات');
            }
          } else {
            toast.error(`فشل حفظ الصنف: ${item.item_name}`);
          }
          setIsSubmitting(false);
          return;
        }
      }

      // 2. تحديث العدد
      try {
        // ✅ التحقق من أن العدد صحيح قبل الإرسال
        const quantityValue = parseInt(quantity);
        if (isNaN(quantityValue) || quantityValue < 1) {
          toast.error('العدد يجب أن يكون رقماً صحيحاً أكبر من صفر');
          setIsSubmitting(false);
          return;
        }

        // ✅ تسجيل البيانات المرسلة للتحقق (فقط في development)
        if (import.meta.env.DEV) {
          console.log('📤 Sending quantity update:', {
            projectId,
            quantity: quantityValue,
            quantityType: typeof quantityValue
          });
        }

        const response = await apiClient.patch(`/projects/${projectId}/warehouse/quantity`, {
          quantity: quantityValue,
        });

        if (import.meta.env.DEV) {
          console.log('✅ Quantity update response:', response.data);
        }
      } catch (error) {
        console.error('Error updating quantity:', error);

        // ✅ معالجة خاصة لأخطاء 422 (Validation Error)
        if (error.response?.status === 422) {
          const errorData = error.response.data;
          const errorMessage = errorData.message || errorData.error || 'خطأ في التحقق من البيانات';
          const errors = errorData.errors || {};

          // ✅ عرض رسالة الخطأ مع التفاصيل
          if (errors.quantity) {
            toast.error(`خطأ في العدد: ${Array.isArray(errors.quantity) ? errors.quantity.join(', ') : errors.quantity}`);
          } else {
            toast.error(errorMessage);
          }
        } else {
          toast.error(error.response?.data?.message || 'فشل تحديث العدد');
        }

        setIsSubmitting(false);
        return;
      }

      // ✅ 3. التحقق من حالة المشروع ونقله إلى "قيد التوريد" إذا لزم الأمر
      const currentStatus = project?.status || '';
      if (currentStatus !== 'قيد التوريد' && currentStatus !== 'تم التوريد') {
        try {
          if (import.meta.env.DEV) {
            console.log('🔄 Project status is not "قيد التوريد", moving to supply...', {
              currentStatus,
              projectId
            });
          }

          // ✅ نقل المشروع إلى حالة "قيد التوريد"
          const moveResponse = await apiClient.post(`/project-proposals/${projectId}/move-to-supply`);

          if (moveResponse.data.success) {
            // ✅ تحديث حالة المشروع محلياً
            setProject(prev => ({
              ...prev,
              status: 'قيد التوريد'
            }));

            if (import.meta.env.DEV) {
              console.log('✅ Project moved to supply status successfully');
            }
          } else {
            toast.error(moveResponse.data.message || 'فشل نقل المشروع لمرحلة التوريد');
            setIsSubmitting(false);
            return;
          }
        } catch (moveError) {
          console.error('Error moving project to supply:', moveError);
          const errorMessage = moveError.response?.data?.message ||
            moveError.userMessage ||
            'فشل نقل المشروع لمرحلة التوريد';
          toast.error(errorMessage);
          setIsSubmitting(false);
          return;
        }
      }

      // ✅ 4. تأكيد التوريد
      const confirmPayload = {
        notes: '',
      };

      // ✅ حساب التكلفة الفعلية بناءً على الأصناف المعالجة
      const actualUnitCost = itemsToProcess.reduce((sum, item) => {
        const itemTotal = parseFloat(item.unit_price || 0) * parseFloat(item.quantity_per_unit || 0);
        return sum + itemTotal;
      }, 0);
      const actualTotalCost = actualUnitCost * quantity;

      // ✅ حساب تكلفة الأصناف الناقصة (الغير موجودة)
      let shortageCost = 0;
      if (proceedWithShortage && insufficientItemsList.length > 0) {
        shortageCost = insufficientItemsList.reduce((sum, item) => sum + item.shortageCost, 0);
      }

      // ✅ حساب المبلغ المتاح والفائض
      const availableAmount = summary.available_amount || availableAmountInfo.amount || 0;
      // ✅ حساب الفائض النهائي:
      // الفائض = المبلغ الصافي بالشيكل - (تكلفة الطرد * العدد) + تكلفة النقص
      // حيث تكلفة النقص تُضاف للفائض لأن الأصناف الناقصة لم يتم شراؤها فعلياً
      const surplusAmount = availableAmount - actualTotalCost + shortageCost;

      // ✅ جعل اختيار قسم الفائض إجباري
      if (!selectedCategoryId) {
        toast.error('يرجى اختيار قسم الفائض قبل تأكيد التوريد');
        setIsSubmitting(false);
        return;
      }

      // ✅ إضافة القسم ومبلغ الفائض
      confirmPayload.surplus_category_id = parseInt(selectedCategoryId);

      // ✅ إرسال مبلغ الفائض (يشمل الفائض الأصلي + تكلفة الأصناف الناقصة)
      if (surplusAmount > 0) {
        confirmPayload.surplus_amount = parseFloat(surplusAmount.toFixed(2));
      }

      // ✅ إرسال تكلفة النقص أيضاً (للمعلومات)
      if (shortageCost > 0) {
        confirmPayload.shortage_cost = parseFloat(shortageCost.toFixed(2));
      }

      const response = await apiClient.post(`/projects/${projectId}/warehouse/confirm`, confirmPayload);

      if (response.data.success) {
        toast.success('تم تأكيد التوريد بنجاح');
        invalidateProjectsCache(); // ✅ إبطال كاش المشاريع
        setPendingChanges(false);
        setShowInsufficientItemsModal(false); // إغلاق modal إذا كان مفتوحاً
        navigate(`/project-management/projects/${projectId}`);
      }
    } catch (error) {
      console.error('Error confirming supply:', error);
      toast.error(error.response?.data?.message || 'فشل تأكيد التوريد');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSupply = async () => {
    if (!window.confirm('هل أنت متأكد من إلغاء التوريد؟ سيتم حذف جميع الأصناف من السلة.')) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiClient.post(`/projects/${projectId}/warehouse/cancel`);

      if (response.data.success) {
        toast.success('تم إلغاء التوريد بنجاح');
        invalidateProjectsCache(); // ✅ إبطال كاش المشاريع
        navigate(`/project-management/projects/${projectId}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'فشل إلغاء التوريد');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 👥 تحديث عدد المستفيدين (يتم استدعاؤه عند onBlur)
  const handleUpdateBeneficiaries = async () => {
    if (!projectId) return;

    // ✅ إذا كانت القيمة فارغة أو لم تتغير، لا نحدث
    const currentValue = project?.beneficiaries_count || project?.calculated_beneficiaries || 0;
    const newValue = beneficiariesCount === '' ? '' : parseInt(beneficiariesCount);

    if (beneficiariesCount === '' || newValue === currentValue) {
      return; // لا حاجة للتحديث
    }

    if (isNaN(newValue) || newValue < 0) {
      toast.error('يرجى إدخال عدد صحيح أكبر من أو يساوي صفر');
      // إعادة تعيين القيمة إلى القيمة الحالية
      setBeneficiariesCount(currentValue);
      return;
    }

    try {
      setUpdatingBeneficiaries(true);
      const response = await apiClient.patch(`/project-proposals/${projectId}`, {
        beneficiaries_count: newValue
      });

      if (response.data.success) {
        toast.success('تم تحديث عدد المستفيدين بنجاح');
        // تحديث بيانات المشروع
        fetchProjectData(true);
      } else {
        toast.error(response.data.message || 'فشل تحديث عدد المستفيدين');
        // إعادة تعيين القيمة إلى القيمة الحالية في حالة الفشل
        setBeneficiariesCount(currentValue);
      }
    } catch (error) {
      console.error('Error updating beneficiaries:', error);

      // معالجة خاصة لأخطاء 401 (Unauthorized) - انتهت صلاحية الجلسة
      if (error.response?.status === 401) {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) {
          toast.error('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.');
        } else {
          toast.error('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.');
        }
        // إعادة تعيين القيمة إلى القيمة الحالية
        setBeneficiariesCount(currentValue);
        return;
      }

      // معالجة خاصة لأخطاء الصلاحيات 403
      if (error.response?.status === 403 || error.isPermissionError) {
        const permissionMessage = error.response?.data?.message || error.userMessage ||
          'ليس لديك صلاحيات لتحديث عدد المستفيدين. يرجى التواصل مع الإدارة لتعديل الصلاحيات في الـ Backend.';
        toast.error(permissionMessage);
      } else {
        toast.error(error.userMessage || error.response?.data?.message || 'حدث خطأ أثناء تحديث عدد المستفيدين');
      }
      // إعادة تعيين القيمة إلى القيمة الحالية في حالة الفشل
      setBeneficiariesCount(currentValue);
    } finally {
      setUpdatingBeneficiaries(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatILS = (amount) => {
    if (!amount || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // 💱 Handle Shekel Conversion
  const handleConvertToShekel = async () => {
    const rate = parseFloat(exchangeRate);
    if (!rate || rate <= 0) {
      toast.error('يرجى إدخال سعر صرف صحيح');
      return;
    }

    const transferDiscount = parseFloat(transferDiscountPercentage) || 0;
    // ✅ نسبة خصم النقل يجب أن تكون أكبر من صفر
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
        transfer_discount_percentage: transferDiscount // ✅ نسبة خصم النقل (مطلوبة - هي نفسها نسبة الخصم للتحويل)
      });

      if (response.data.success) {
        toast.success(response.data.message || (isEditingShekel ? 'تم تحديث التحويل إلى شيكل بنجاح' : 'تم التحويل إلى شيكل بنجاح'));
        setShowShekelModal(false);
        setIsEditingShekel(false);
        setExchangeRate('');
        setTransferDiscountPercentage(0); // ✅ إعادة تعيين نسبة خصم النقل
        // ✅ تحديث البيانات فوراً (force refresh)
        fetchProjectData(true);
        fetchCart(true);
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
    // لا يمكن التعديل إذا كانت حالة المشروع "منتهي"
    if (project.status === 'منتهي') return false;
    // لا يمكن التعديل إذا كانت حالة التوريد "تم التوريد"
    if (project.status === 'تم التوريد') return false;
    return true;
  };

  // ✅ فتح modal التعديل مع ملء القيم الحالية
  const handleEditShekelConversion = () => {
    if (!canEditShekelConversion()) {
      toast.error('لا يمكن تعديل التحويل للشيكل بعد انتهاء حالة التوريد أو انتقال المشروع إلى حالة "منتهي"');
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

  const availableAmountInfo = getAvailableAmountInfo();

  // if (loading) {
  //   return (
  //     <div className="flex justify-center items-center min-h-screen">
  //       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
  //     </div>
  //   );
  // }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">المشروع غير موجود</p>
          <Link
            to="/project-management/projects"
            className="mt-4 inline-block text-sky-600 hover:text-sky-700"
          >
            العودة لقائمة المشاريع
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" style={ { fontFamily: 'Cairo, sans-serif' } }>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */ }
        <div className="mb-6">
          <Link
            to={ `/project-management/projects/${projectId}` }
            className="inline-flex items-center text-sky-600 hover:text-sky-700 mb-4"
          >
            <ArrowRight className="w-4 h-4 ml-2" />
            العودة لتفاصيل المشروع
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <ShoppingCart className="w-8 h-8 text-sky-600" />
              سلة التوريد - مشروع { getProjectCode(project, `#${project.id}`) }
            </h1>
            <Link
              to={ needsShekelConversion ? '#' : `/project-management/projects/${projectId}/supply/edit` }
              onClick={ (e) => {
                if (needsShekelConversion) {
                  e.preventDefault();
                  toast.error('يجب تحويل المبلغ للشيكل أولاً قبل تعديل التوريد');
                }
              } }
              className={ `px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all ${
                needsShekelConversion
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:shadow-lg'
              }` }
              title={ needsShekelConversion ? 'غير متاح قبل التحويل للشيكل' : 'تعديل التوريد' }
            >
              <Edit className="w-5 h-5" />
              تعديل التوريد
            </Link>
          </div>
        </div>

        {/* 💱 تنبيه التحويل للشيكل */ }
        { needsShekelConversion && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-100 rounded-xl">
                <DollarSign className="w-8 h-8 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-amber-800 mb-2">
                  ⚠️ يجب تحويل المبلغ إلى شيكل أولاً
                </h3>
                <p className="text-amber-700 mb-3">
                  المبلغ الحالي بالدولار: <span className="font-bold">${ formatCurrency(project?.net_amount_usd || project?.net_amount || 0) }</span>
                </p>
                <p className="text-sm text-amber-600 mb-4">
                  لإتمام عملية التوريد، يجب تحويل المبلغ من الدولار إلى الشيكل باستخدام سعر الصرف الحالي.
                </p>
                <button
                  onClick={ handleNewShekelConversion }
                  className="px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors font-medium flex items-center gap-2"
                >
                  <DollarSign className="w-5 h-5" />
                  تحويل إلى شيكل
                </button>
              </div>
            </div>
          </div>
        ) }

        {/* Project Info */ }
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">معلومات المشروع</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">كود المشروع</p>
              <p className="text-lg font-semibold text-gray-800">{ getProjectCode(project, project.id?.toString() || '---') }</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">اسم المشروع</p>
              <p className="text-lg font-semibold text-gray-800 line-clamp-2">
                { project.project_name || project.name || '-' }
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">
                المبلغ المتاح للتوريد { availableAmountInfo.currency === 'ILS' ? '(شيكل)' : '(دولار)' }
              </p>
              <p className="text-lg font-semibold text-green-600">
                { availableAmountInfo.symbol }{ formatILS(availableAmountInfo.amount) }
              </p>
              { availableAmountInfo.originalAmount && (
                <p className="text-xs text-gray-500 mt-1">
                  المبلغ الأصلي: ${ formatCurrency(availableAmountInfo.originalAmount) } | سعر الصرف: { availableAmountInfo.exchangeRate }
                </p>
              ) }
              { !needsShekelConversion && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    تم التحويل للشيكل
                  </span>
                  { canEditShekelConversion() && (
                    <button
                      onClick={ handleEditShekelConversion }
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full hover:bg-blue-200 transition-colors"
                      title="تعديل سعر الصرف ونسبة الخصم"
                    >
                      <Edit className="w-3 h-3" />
                      تعديل
                    </button>
                  ) }
                </div>
              ) }
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">العدد</p>
              <p className="text-lg font-semibold text-gray-800">{ quantity }</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">عدد المستفيدين (الأيتام)</p>
              <p className="text-lg font-semibold text-gray-800">
                { (project?.beneficiaries_count || project?.calculated_beneficiaries || 0).toLocaleString('en-US') }
              </p>
            </div>
          </div>
        </div>


        {/* Cart Items Table */ }
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-sky-600" />
            الأصناف في السلة
          </h2>
          { cartItems.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">السلة فارغة. أضف أصنافاً للبدء.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">اسم الصنف</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">الكمية للطرد الواحد</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">السعر</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">الإجمالي للطرد</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">المتوفر في المخزن</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  { cartItems.map((item) => (
                    <CartItemRow
                      key={ item.id }
                      item={ item }
                      projectQuantity={ quantity }
                      formatCurrency={ formatCurrency }
                      formatILS={ formatILS }
                    />
                  )) }
                </tbody>
              </table>
            </div>
          ) }
        </div>

        {/* Cost Summary */ }
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-600" />
            ملخص التكاليف
            { summary.currency === 'ILS' && (
              <span className="text-sm font-normal text-gray-500">(بالشيكل)</span>
            ) }
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-700 font-medium">تكلفة الطرد الواحد:</span>
                <span className="text-lg font-bold text-gray-800">
                  { summary.currency === 'ILS' ? '₪' : '$' }{ formatILS(summary.unit_cost) }
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                <span className="text-gray-700 font-medium">العدد:</span>
                <span className="text-lg font-bold text-gray-800">{ quantity }</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-xl border-2 border-green-200">
                <span className="text-gray-700 font-medium">التكلفة الإجمالية:</span>
                <span className="text-lg font-bold text-green-700">
                  { summary.currency === 'ILS' ? '₪' : '$' }{ formatILS(summary.total_supply_cost) }
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                <span className="text-gray-700 font-medium">المبلغ المتاح للمشروع:</span>
                <span className="text-lg font-bold text-blue-700">
                  { summary.currency === 'ILS' ? '₪' : '$' }{ formatILS(summary.available_amount || availableAmountInfo.amount) }
                </span>
              </div>
            </div>
            <div className="space-y-4">
              <div
                className={ `flex justify-between items-center p-4 rounded-xl border-2 ${summary.has_deficit
                  ? 'bg-red-50 border-red-200'
                  : 'bg-emerald-50 border-emerald-200'
                  }` }
              >
                <span className="text-gray-700 font-medium">
                  { summary.has_deficit ? 'العجز المتوقع:' : 'الفائض المتوقع:' }
                </span>
                <span
                  className={ `text-lg font-bold ${summary.has_deficit ? 'text-red-700' : 'text-emerald-700'
                    }` }
                >
                  { summary.currency === 'ILS' ? '₪' : '$' }{ formatILS(Math.abs(summary.expected_surplus)) }
                </span>
              </div>
              { summary.has_deficit && (
                <div className="p-4 bg-red-100 border-2 border-red-300 rounded-xl">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-800 mb-1">تحذير: يوجد عجز</p>
                      <p className="text-sm text-red-700">
                        التكلفة الإجمالية ({ summary.currency === 'ILS' ? '₪' : '$' }{ formatILS(summary.total_supply_cost) }) تتجاوز المبلغ المتاح (
                        { summary.currency === 'ILS' ? '₪' : '$' }{ formatILS(summary.available_amount || availableAmountInfo.amount) })
                      </p>
                    </div>
                  </div>
                </div>
              ) }
            </div>
          </div>
        </div>

        {/* 📦 Surplus Category Display */ }
        { surplusCategories.length > 0 && project?.surplus_category_id && (
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              قسم الفائض
            </h3>
            <div className="max-w-md">
              { (() => {
                const selectedCategory = surplusCategories.find(cat => cat.id === project.surplus_category_id);
                return selectedCategory ? (
                  <p className="text-lg font-semibold text-gray-800">
                    { selectedCategory.name }
                    { selectedCategory.statistics && ` (رصيد: ₪${formatCurrency(selectedCategory.statistics.total_balance)})` }
                  </p>
                ) : (
                  <p className="text-gray-500">-</p>
                );
              })() }
            </div>
          </div>
        ) }

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
                        setIsSubmitting(true);
                        const response = await apiClient.post(`/project-proposals/${projectId}/orphans`, selectedOrphansData);
                        if (response.data.success) {
                          toast.success('تم حفظ اختيار الأيتام بنجاح');
                          fetchProjectOrphans();
                        }
                      } catch (error) {
                        console.error('Error saving orphans:', error);
                        toast.error(error.response?.data?.message || 'حدث خطأ أثناء حفظ اختيار الأيتام');
                      } finally {
                        setIsSubmitting(false);
                      }
                    } }
                    disabled={ isSubmitting || !selectedOrphansData }
                    className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-700 text-white rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    { isSubmitting ? 'جاري الحفظ...' : 'حفظ اختيار الأيتام' }
                  </button>
                </div>
              </>
            ) }
          </div>
        ) }
      </div>


      {/* 💱 Shekel Conversion Modal */ }
      <ShekelConversionModal
        isOpen={ showShekelModal }
        onClose={ () => {
          setShowShekelModal(false);
          setIsEditingShekel(false);
          setExchangeRate('');
          setTransferDiscountPercentage(0); // ✅ إعادة تعيين نسبة خصم النقل
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

      {/* ⚠️ Modal التحذير من نقص الأصناف */ }
      { showInsufficientItemsModal && insufficientItemsList.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" style={ { fontFamily: 'Cairo, sans-serif' } }>
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-red-700 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-red-600" />
                تحذير: نقص في الأصناف
              </h3>
              <button
                onClick={ () => setShowInsufficientItemsModal(false) }
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-800 mb-2">
                  ⚠️ يوجد نقص في { insufficientItemsList.length } صنف:
                </p>
                <p className="text-sm text-red-700">
                  بعض الأصناف غير كافية للكمية المطلوبة. إذا وافقت على المتابعة، سيتم إنقاص المبلغ المنفذ بناءً على الكميات المتوفرة فقط.
                </p>
              </div>

              {/* قائمة الأصناف الناقصة */ }
              <div className="space-y-3">
                { insufficientItemsList.map((item, index) => {
                  const totalShortageCost = item.shortageCost;
                  return (
                    <div key={ index } className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 mb-1">{ item.name }</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-600">المطلوب:</span>
                              <span className="font-semibold text-gray-800 ml-2">{ item.needed.toLocaleString('en-US') }</span>
                            </div>
                            <div>
                              <span className="text-gray-600">المتوفر:</span>
                              <span className="font-semibold text-gray-800 ml-2">{ item.available.toLocaleString('en-US') }</span>
                            </div>
                            <div>
                              <span className="text-red-600">النقص:</span>
                              <span className="font-semibold text-red-700 ml-2">{ item.shortage.toLocaleString('en-US') }</span>
                            </div>
                            <div>
                              <span className="text-red-600">تكلفة النقص:</span>
                              <span className="font-semibold text-red-700 ml-2">
                                ₪{ formatILS(totalShortageCost) }
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }) }
              </div>

              {/* ملخص التكلفة */ }
              <div className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-700 font-medium">إجمالي تكلفة النقص:</span>
                  <span className="text-xl font-bold text-red-700">
                    ₪{ formatILS(insufficientItemsList.reduce((sum, item) => sum + item.shortageCost, 0)) }
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  سيتم خصم هذا المبلغ من التكلفة الإجمالية عند المتابعة
                </p>
              </div>

              {/* الأزرار */ }
              <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-gray-200">
                <button
                  onClick={ () => setShowInsufficientItemsModal(false) }
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
                >
                  إلغاء
                </button>
                <button
                  onClick={ async () => {
                    // ✅ التحقق من اختيار قسم الفائض قبل المتابعة
                    if (!selectedCategoryId || selectedCategoryId === '') {
                      toast.error('يرجى اختيار قسم الفائض قبل تأكيد التوريد');
                      return;
                    }
                    setShowInsufficientItemsModal(false);
                    await proceedWithSupply(true);
                  } }
                  disabled={ isSubmitting || !selectedCategoryId || selectedCategoryId === '' }
                  className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  title={ !selectedCategoryId || selectedCategoryId === '' ? 'يرجى اختيار قسم الفائض أولاً' : '' }
                >
                  { isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      جاري التأكيد...
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5" />
                      الموافقة والمتابعة مع النقص
                    </>
                  ) }
                </button>
              </div>
            </div>
          </div>
        </div>
      ) }

    </div>
  );
};

// Cart Item Row Component
const CartItemRow = ({ item, projectQuantity, formatCurrency, formatILS }) => {
  // ✅ حساب الكمية المطلوبة والكمية المتوفرة
  const quantityPerUnit = parseFloat(item.quantity_per_unit || 0);
  const totalNeeded = quantityPerUnit * (projectQuantity || 1);
  const availableQty = item.available_in_warehouse || item.warehouse_item?.quantity_available || item.available_quantity || 0;
  const isInsufficient = totalNeeded > availableQty;

  return (
    <tr className={ `hover:bg-gray-50 transition-colors ${isInsufficient ? 'bg-red-50 border-l-4 border-red-500' : ''}` }>
      <td className="py-4 px-4 text-sm text-gray-800 font-medium">
        <div className="flex items-center gap-2">
          { item.warehouse_item?.item_name || item.item_name || '-' }
          { isInsufficient && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
              <AlertCircle className="w-3 h-3" />
              غير كافي
            </span>
          ) }
        </div>
      </td>
      <td className="py-4 px-4">
        <span className="text-sm text-gray-700">{ item.quantity_per_unit }</span>
      </td>
      <td className="py-4 px-4 text-sm text-gray-700">₪{ formatILS(item.unit_price || 0) }</td>
      <td className="py-4 px-4 text-sm font-semibold text-gray-800">
        ₪{ formatILS(item.total_price_per_unit || item.unit_price * (item.quantity_per_unit || 0) || 0) }
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
    </tr>
  );
};

// Add Item Modal Component
const AddItemModal = ({ isOpen, onClose, availableItems, newItem, setNewItem, onAdd, isSubmitting, formatILS }) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  // البحث عن الصنف المختار للحصول على تفاصيله
  const selectedItem = availableItems.find(item => item.id === parseInt(newItem.warehouse_item_id));

  // فلترة الأصناف بناءً على البحث
  const filteredItems = availableItems.filter(item => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.item_name?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.location?.toLowerCase().includes(query)
    );
  });

  // إعادة تعيين البحث عند إغلاق النافذة
  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Plus className="w-6 h-6 text-sky-600" />
            إضافة صنف للسلة
          </h3>
          <button
            onClick={ handleClose }
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="space-y-6">
          {/* البحث عن الصنف */ }
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-sky-600" />
              البحث عن الصنف
            </label>
            <div className="relative">
              <input
                type="text"
                value={ searchQuery }
                onChange={ (e) => setSearchQuery(e.target.value) }
                placeholder="ابحث بالاسم، الفئة، الوصف، أو الموقع..."
                className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
              { searchQuery && (
                <button
                  onClick={ () => setSearchQuery('') }
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                  title="مسح البحث"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              ) }
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
            { searchQuery && (
              <p className="text-xs text-gray-500 mt-1">
                { filteredItems.length } صنف متطابق
              </p>
            ) }
          </div>

          {/* اختيار الصنف */ }
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">اختر الصنف</label>
            { filteredItems.length === 0 ? (
              <div className="w-full px-4 py-8 border-2 border-gray-300 rounded-xl text-center bg-gray-50">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">لا توجد أصناف تطابق البحث</p>
                <button
                  onClick={ () => setSearchQuery('') }
                  className="text-sky-600 hover:text-sky-700 text-sm mt-2"
                >
                  مسح البحث
                </button>
              </div>
            ) : (
              <select
                value={ newItem.warehouse_item_id }
                onChange={ (e) => setNewItem({ ...newItem, warehouse_item_id: e.target.value }) }
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="">-- اختر صنف --</option>
                { filteredItems.map((item) => (
                  <option key={ item.id } value={ item.id }>
                    { item.item_name } - (المتوفر: { item.quantity_available } { item.unit || 'قطعة' })
                  </option>
                )) }
              </select>
            ) }
          </div>

          {/* تفاصيل الصنف المختار */ }
          { selectedItem && (
            <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-2xl p-6 border-2 border-sky-200">
              <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-sky-600" />
                تفاصيل الصنف
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* اسم الصنف */ }
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">اسم الصنف</p>
                  <p className="text-base font-bold text-gray-800">{ selectedItem.item_name }</p>
                </div>

                {/* الفئة */ }
                { selectedItem.category && (
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">الفئة</p>
                    <p className="text-base font-semibold text-gray-800">{ selectedItem.category }</p>
                  </div>
                ) }

                {/* الكمية المتوفرة */ }
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">الكمية المتوفرة</p>
                  <p className="text-base font-bold text-green-600">
                    { selectedItem.quantity_available } { selectedItem.unit || 'قطعة' }
                  </p>
                </div>

                {/* السعر */ }
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">السعر للوحدة</p>
                  <p className="text-base font-bold text-sky-600">
                    ₪{ formatILS(selectedItem.unit_price || 0) }
                  </p>
                </div>

                {/* الوصف */ }
                { selectedItem.description && (
                  <div className="bg-white rounded-xl p-4 shadow-sm md:col-span-2">
                    <p className="text-xs text-gray-500 mb-1">الوصف</p>
                    <p className="text-sm text-gray-700">{ selectedItem.description }</p>
                  </div>
                ) }

                {/* الموقع */ }
                { selectedItem.location && (
                  <div className="bg-white rounded-xl p-4 shadow-sm md:col-span-2">
                    <p className="text-xs text-gray-500 mb-1">الموقع في المخزن</p>
                    <p className="text-sm text-gray-700">{ selectedItem.location }</p>
                  </div>
                ) }
              </div>
            </div>
          ) }

          {/* الكمية للطرد الواحد */ }
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              الكمية للطرد الواحد { selectedItem && `(${selectedItem.unit || 'قطعة'})` }
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={ newItem.quantity_per_unit }
              onChange={ (e) => setNewItem({ ...newItem, quantity_per_unit: e.target.value }) }
              placeholder="أدخل الكمية"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-lg"
            />
            { selectedItem && newItem.quantity_per_unit && (
              <p className="text-sm text-gray-500 mt-2">
                💡 السعر الإجمالي للطرد: <span className="font-bold text-sky-600">
                  ₪{ formatILS((parseFloat(selectedItem.unit_price || 0) * parseFloat(newItem.quantity_per_unit))) }
                </span>
              </p>
            ) }
          </div>

          {/* الأزرار */ }
          <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-gray-200">
            <button
              onClick={ onClose }
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
            >
              إلغاء
            </button>
            <button
              onClick={ onAdd }
              disabled={ isSubmitting || !newItem.warehouse_item_id || !newItem.quantity_per_unit }
              className="px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              { isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  جاري الإضافة...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  إضافة للسلة
                </>
              ) }
            </button>
          </div>
        </div>
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

  // ✅ حساب المبلغ بعد تطبيق نسبة خصم النقل (هي نفسها نسبة الخصم للتحويل)
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

export default ProjectSupply;

