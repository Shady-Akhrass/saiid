import React, { useMemo, useRef, useEffect, useState } from 'react';

/**
 * مكون VirtualizedTable لعرض الجداول الكبيرة بشكل فعال
 * يعرض فقط الصفوف المرئية في viewport
 * 
 * @param {Array} data - البيانات المراد عرضها
 * @param {function} renderRow - دالة لعرض كل صف
 * @param {number} rowHeight - ارتفاع كل صف بالبكسل
 * @param {number} overscan - عدد الصفوف الإضافية للعرض (لتحسين الأداء)
 * @param {string} className - classes CSS للجدول
 */
const VirtualizedTable = ({
  data = [],
  renderRow,
  rowHeight = 50,
  overscan = 5,
  className = '',
  header = null,
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const containerRef = useRef(null);

  // ✅ حساب الصفوف المرئية
  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(
      data.length,
      Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan
    );
    return { start, end };
  }, [scrollTop, containerHeight, rowHeight, data.length, overscan]);

  // ✅ الصفوف المرئية فقط
  const visibleRows = useMemo(() => {
    return data.slice(visibleRange.start, visibleRange.end);
  }, [data, visibleRange.start, visibleRange.end]);

  // ✅ ارتفاع الـ spacer العلوي
  const topSpacerHeight = visibleRange.start * rowHeight;
  
  // ✅ ارتفاع الـ spacer السفلي
  const bottomSpacerHeight = (data.length - visibleRange.end) * rowHeight;

  // ✅ تحديث ارتفاع الـ container
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // ✅ معالج التمرير
  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };

  return (
    <div className={`overflow-auto ${className}`} ref={containerRef} onScroll={handleScroll}>
      {header && <div className="sticky top-0 z-10 bg-white">{header}</div>}
      <div style={{ height: data.length * rowHeight, position: 'relative' }}>
        {/* ✅ Spacer علوي */}
        <div style={{ height: topSpacerHeight }} />

        {/* ✅ الصفوف المرئية */}
        <div style={{ position: 'relative' }}>
          {visibleRows.map((item, index) => {
            const actualIndex = visibleRange.start + index;
            return (
              <div
                key={actualIndex}
                style={{
                  height: rowHeight,
                  position: 'absolute',
                  top: index * rowHeight,
                  width: '100%',
                }}
              >
                {renderRow(item, actualIndex)}
              </div>
            );
          })}
        </div>

        {/* ✅ Spacer سفلي */}
        <div style={{ height: bottomSpacerHeight }} />
      </div>
    </div>
  );
};

export default VirtualizedTable;

