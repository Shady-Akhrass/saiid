import React from 'react';
import { Clock } from 'lucide-react';
import { getStatusColor } from '../../utils/projectUtils';

export const StatusBadge = ({ status, isPostponed = false, size = 'default' }) => {
  const sizeClasses = size === 'small' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${isPostponed
          ? 'bg-gradient-to-r from-orange-100 to-amber-200 text-orange-800 border-2 border-orange-400 font-bold shadow-md'
          : `${getStatusColor(status)} text-white`
        } ${sizeClasses}`}
    >
      {isPostponed && <Clock className={size === 'small' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      {status}
    </span>
  );
};

export default StatusBadge;
