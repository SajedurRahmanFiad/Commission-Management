import React from 'react';

interface FormFieldProps {
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'textarea' | 'select';
  placeholder?: string;
  value: string | number;
  onChange: (value: string) => void;
  required?: boolean;
  options?: { value: string; label: string }[];
  className?: string;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  required = false,
  options,
  className = ''
}) => {
  const baseInputClass = 'w-full px-4 sm:px-5 py-3 sm:py-4 rounded-2xl bg-slate-50 border border-slate-200 outline-none font-medium text-slate-700 focus:border-indigo-500 transition-all';

  return (
    <div className={className}>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">
        {label}
      </label>
      {type === 'textarea' ? (
        <textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={`${baseInputClass} h-24 sm:h-32 resize-none`}
        />
      ) : type === 'select' ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={baseInputClass}
        >
          <option value="">Select an option...</option>
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={baseInputClass}
        />
      )}
    </div>
  );
};

export default FormField;
