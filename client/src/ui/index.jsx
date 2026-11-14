import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, ChevronRight, X, Loader2 } from 'lucide-react';

// ==========================================
// 1. Buttons (iOS Tap Micro-interaction & Colors)
// ==========================================
export const Button = ({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'plain' | 'destructive'
  size = 'md', // 'sm' | 'md' | 'lg'
  disabled = false,
  loading = false,
  onClick,
  className = '',
  type = 'button',
  icon: Icon,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center font-medium transition-all select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 rounded-[10px] gap-1.5 h-8 min-h-[32px]',
    md: 'text-sm px-4 py-2 rounded-[12px] gap-2 h-10 min-h-[40px]',
    lg: 'text-base px-5 py-2.5 rounded-[14px] gap-2.5 h-12 min-h-[44px]'
  };

  const variants = {
    primary:
      'bg-[#007AFF] text-white shadow-sm hover:bg-[#0062CC] active:scale-[0.97] transition-all duration-150',
    secondary:
      'bg-black/5 dark:bg-white/10 text-[#1C1C1E] dark:text-[#F2F2F7] hover:bg-black/10 dark:hover:bg-white/15 active:scale-[0.97] transition-all duration-150',
    plain:
      'bg-transparent text-[#007AFF] hover:bg-[#007AFF]/10 active:scale-[0.97] transition-all duration-150',
    destructive:
      'bg-[#FF3B30] text-white shadow-sm hover:bg-[#D70015] active:scale-[0.97] transition-all duration-150'
  };

  return (
    <motion.button
      type={type}
      whileTap={disabled || loading ? {} : { scale: 0.97 }}
      transition={{ duration: 0.12 }}
      onClick={disabled || loading ? undefined : onClick}
      disabled={disabled || loading}
      className={`${base} ${sizeStyles[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0" />
      ) : null}
      {children}
    </motion.button>
  );
};

export const IconButton = ({
  icon: Icon,
  variant = 'secondary',
  size = 'md',
  onClick,
  disabled = false,
  className = '',
  label,
  ...props
}) => {
  const sizes = {
    sm: 'w-8 h-8 rounded-[10px]',
    md: 'w-10 h-10 rounded-[12px]',
    lg: 'w-12 h-12 rounded-[14px]'
  };

  const variants = {
    primary: 'bg-[#007AFF] text-white hover:bg-[#0062CC] active:scale-[0.94]',
    secondary:
      'bg-black/5 dark:bg-white/10 text-[#1C1C1E] dark:text-[#F2F2F7] hover:bg-black/10 dark:hover:bg-white/15 active:scale-[0.94]',
    plain:
      'bg-transparent text-[#6B7280] dark:text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] hover:bg-black/5 dark:hover:bg-white/10 active:scale-[0.94]',
    destructive: 'bg-[#FF3B30]/10 text-[#FF3B30] hover:bg-[#FF3B30]/20 active:scale-[0.94]'
  };

  return (
    <motion.button
      type="button"
      whileTap={disabled ? {} : { scale: 0.94 }}
      transition={{ duration: 0.12 }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center transition-all select-none cursor-pointer disabled:opacity-40 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      <Icon className="w-4 h-4" />
    </motion.button>
  );
};

// ==========================================
// 2. Form Controls (Input, Select, Switch, etc.)
// ==========================================
export const Input = ({
  label,
  error,
  hint,
  className = '',
  containerClassName = '',
  ...props
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label className="text-xs font-semibold text-[#6B7280] dark:text-[#8E8E93] tracking-wide">
          {label}
        </label>
      )}
      <input
        className={`w-full px-3.5 py-2.5 bg-white dark:bg-[#2C2C2E] text-[#1C1C1E] dark:text-[#F2F2F7] border ${
          error ? 'border-[#FF3B30]' : 'border-black/10 dark:border-white/10'
        } rounded-[12px] text-sm placeholder:text-[#8E8E93] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all ${className}`}
        {...props}
      />
      {hint && !error && <span className="text-[11px] text-[#8E8E93]">{hint}</span>}
      {error && (
        <span className="text-[11px] text-[#FF3B30] flex items-center gap-1 font-medium">
          <AlertCircle className="w-3 h-3" />
          {error}
        </span>
      )}
    </div>
  );
};

export const Select = ({
  label,
  options = [],
  error,
  className = '',
  containerClassName = '',
  ...props
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label className="text-xs font-semibold text-[#6B7280] dark:text-[#8E8E93] tracking-wide">
          {label}
        </label>
      )}
      <select
        className={`w-full px-3.5 py-2.5 bg-white dark:bg-[#2C2C2E] text-[#1C1C1E] dark:text-[#F2F2F7] border border-black/10 dark:border-white/10 rounded-[12px] text-sm focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all cursor-pointer ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-[11px] text-[#FF3B30] font-medium">{error}</span>}
    </div>
  );
};

export const Textarea = ({
  label,
  error,
  hint,
  rows = 3,
  className = '',
  containerClassName = '',
  ...props
}) => {
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label className="text-xs font-semibold text-[#6B7280] dark:text-[#8E8E93] tracking-wide">
          {label}
        </label>
      )}
      <textarea
        rows={rows}
        className={`w-full px-3.5 py-2.5 bg-white dark:bg-[#2C2C2E] text-[#1C1C1E] dark:text-[#F2F2F7] border ${
          error ? 'border-[#FF3B30]' : 'border-black/10 dark:border-white/10'
        } rounded-[12px] text-sm placeholder:text-[#8E8E93] focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition-all ${className}`}
        {...props}
      />
      {hint && !error && <span className="text-[11px] text-[#8E8E93]">{hint}</span>}
      {error && <span className="text-[11px] text-[#FF3B30] font-medium">{error}</span>}
    </div>
  );
};

export const Switch = ({ checked, onChange, label, disabled = false }) => {
  return (
    <label
      className={`inline-flex items-center gap-3 cursor-pointer select-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      }`}
    >
      <div
        onClick={() => !disabled && onChange(!checked)}
        className={`w-12 h-7 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
          checked ? 'bg-[#34C759]' : 'bg-black/15 dark:bg-white/20'
        }`}
      >
        <div
          className={`bg-white w-6 h-6 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
      {label && (
        <span className="text-sm font-medium text-[#1C1C1E] dark:text-[#F2F2F7]">{label}</span>
      )}
    </label>
  );
};

export const Checkbox = ({ checked, onChange, label, disabled = false }) => {
  return (
    <label
      className={`inline-flex items-center gap-2.5 cursor-pointer select-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 rounded text-[#007AFF] focus:ring-[#007AFF] border-black/20 dark:border-white/20 dark:bg-[#2C2C2E]"
      />
      {label && <span className="text-sm text-[#1C1C1E] dark:text-[#F2F2F7]">{label}</span>}
    </label>
  );
};

export const SegmentedControl = ({
  options = [],
  value,
  onChange,
  className = ''
}) => {
  return (
    <div
      className={`inline-flex p-1 bg-black/5 dark:bg-white/10 rounded-[14px] select-none ${className}`}
    >
      {options.map((opt) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative px-4 py-1.5 text-xs font-semibold rounded-[10px] transition-all cursor-pointer ${
              isSelected
                ? 'bg-white dark:bg-[#2C2C2E] text-[#1C1C1E] dark:text-[#F2F2F7] shadow-sm'
                : 'text-[#6B7280] dark:text-[#8E8E93] hover:text-[#1C1C1E] dark:hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

// ==========================================
// 3. Card & Inset Grouped List
// ==========================================
export const Card = ({ children, className = '', header, ...props }) => {
  return (
    <div
      className={`card bg-white dark:bg-[#1C1C1E] rounded-[20px] p-5 shadow-[0_2px_12px_rgb(0_0_0_/_0.04)] dark:shadow-[0_4px_20px_rgb(0_0_0_/_0.4)] border border-black/[0.04] dark:border-white/[0.08] ${className}`}
      {...props}
    >
      {header && <div className="mb-4">{header}</div>}
      {children}
    </div>
  );
};

export const InsetGroupedList = ({ items = [], className = '' }) => {
  return (
    <div
      className={`bg-white dark:bg-[#1C1C1E] rounded-[16px] overflow-hidden border border-black/[0.06] dark:border-white/[0.08] divide-y divide-black/[0.05] dark:divide-white/[0.05] ${className}`}
    >
      {items.map((item, idx) => (
        <div
          key={idx}
          onClick={item.onClick}
          className={`flex items-center justify-between px-4 py-3 min-h-[48px] ${
            item.onClick
              ? 'cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] active:bg-black/[0.05]'
              : ''
          }`}
        >
          <div className="flex items-center gap-3">
            {item.icon && <div className="text-[#007AFF] shrink-0">{item.icon}</div>}
            <div>
              <div className="text-sm font-medium text-[#1C1C1E] dark:text-[#F2F2F7]">
                {item.title}
              </div>
              {item.subtitle && (
                <div className="text-xs text-[#6B7280] dark:text-[#8E8E93]">{item.subtitle}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {item.value && (
              <span className="text-sm text-[#6B7280] dark:text-[#8E8E93]">{item.value}</span>
            )}
            {item.onClick && <ChevronRight className="w-4 h-4 text-gray-400" />}
          </div>
        </div>
      ))}
    </div>
  );
};

// ==========================================
// 4. Badges, Confidence & Indicators
// ==========================================
export const StatusBadge = ({ status }) => {
  const configs = {
    uploaded: { bg: 'bg-[#007AFF]/12', text: 'text-[#007AFF]', label: 'Uploaded' },
    queued: { bg: 'bg-[#007AFF]/15', text: 'text-[#007AFF]', label: 'Queued' },
    processing: {
      bg: 'bg-[#007AFF]/20 animate-pulse',
      text: 'text-[#007AFF]',
      label: 'Processing'
    },
    needs_review: { bg: 'bg-[#FF9500]/15', text: 'text-[#FF9500]', label: 'Needs Review' },
    completed: { bg: 'bg-[#34C759]/15', text: 'text-[#34C759]', label: 'Completed' },
    reviewed: { bg: 'bg-[#5856D6]/15', text: 'text-[#5856D6]', label: 'Reviewed' },
    failed: { bg: 'bg-[#FF3B30]/15', text: 'text-[#FF3B30]', label: 'Failed' }
  };

  const current = configs[status] || {
    bg: 'bg-black/5 dark:bg-white/10',
    text: 'text-[#6B7280] dark:text-[#8E8E93]',
    label: status
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${current.bg} ${current.text}`}
    >
      {current.label}
    </span>
  );
};

export const ConfidenceBar = ({ score = 0, showLabel = true }) => {
  const percentage = Math.round(score * 100);
  const isHigh = score >= 0.7;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-200 ${
            isHigh ? 'bg-[#34C759]' : 'bg-[#FF9500]'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
      {showLabel && (
        <span
          className={`text-[11px] font-mono font-medium ${
            isHigh ? 'text-[#34C759]' : 'text-[#FF9500]'
          }`}
        >
          {percentage}%
        </span>
      )}
    </div>
  );
};

// ==========================================
// 5. Modals, Sheets & Overlays (Controlled Glass)
// ==========================================
export const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-lg' }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          className={`relative w-full ${maxWidth} glass bg-white/85 dark:bg-[#1C1C1E]/85 border border-white/50 dark:border-white/10 rounded-[24px] shadow-2xl p-6 z-10 overflow-hidden`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10 mb-4">
            <h3 className="text-lg font-bold text-[#1C1C1E] dark:text-[#F2F2F7] tracking-tight">
              {title}
            </h3>
            <IconButton icon={X} variant="plain" size="sm" onClick={onClose} label="Close" />
          </div>
          <div>{children}</div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export const Sheet = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          className="relative w-full max-w-md h-full glass bg-white/90 dark:bg-[#1C1C1E]/90 border-l border-white/30 dark:border-white/10 shadow-2xl p-6 z-10 overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/10 mb-5">
            <h3 className="text-xl font-bold text-[#1C1C1E] dark:text-[#F2F2F7] tracking-tight">
              {title}
            </h3>
            <IconButton icon={X} variant="plain" size="sm" onClick={onClose} label="Close" />
          </div>
          <div>{children}</div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export const Toast = ({ message, type = 'info', onDismiss }) => {
  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-[#34C759]" />,
    error: <AlertCircle className="w-4 h-4 text-[#FF3B30]" />,
    info: <div className="w-2 h-2 rounded-full bg-[#007AFF]" />
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="fixed top-5 left-1/2 -translate-x-1/2 z-50 glass bg-white/85 dark:bg-[#2C2C2E]/85 border border-black/10 dark:border-white/10 shadow-lg px-4 py-2.5 rounded-full flex items-center gap-2.5 text-sm font-medium text-[#1C1C1E] dark:text-[#F2F2F7]"
    >
      {icons[type]}
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
};

// ==========================================
// 6. Skeleton, Empty & Error States
// ==========================================
export const Skeleton = ({ className = '', count = 1 }) => {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`bg-black/5 dark:bg-white/10 rounded-[8px] animate-pulse ${className}`}
        />
      ))}
    </div>
  );
};

export const EmptyState = ({
  icon: Icon = AlertCircle,
  title,
  description,
  actionLabel,
  onAction
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-[20px] bg-black/[0.02] dark:bg-white/[0.02] border border-dashed border-black/10 dark:border-white/10">
      <div className="w-12 h-12 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-base font-semibold text-[#1C1C1E] dark:text-[#F2F2F7]">{title}</h4>
      {description && (
        <p className="text-sm text-[#6B7280] dark:text-[#8E8E93] max-w-sm mt-1 mb-4">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export const ErrorState = ({ message, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center rounded-[16px] bg-[#FF3B30]/5 border border-[#FF3B30]/20">
      <AlertCircle className="w-8 h-8 text-[#FF3B30] mb-2" />
      <h4 className="text-sm font-semibold text-[#FF3B30]">Something went wrong</h4>
      <p className="text-xs text-[#6B7280] dark:text-[#8E8E93] mt-1 mb-3">
        {message || 'Unable to complete the operation.'}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
};
