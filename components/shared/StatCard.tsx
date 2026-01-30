import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color, icon: Icon }) => {
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 flex items-center gap-6 shadow-sm hover:border-indigo-100 transition-colors group">
      <div className={`p-4 rounded-xl bg-slate-50 ${color} shadow-inner group-hover:scale-110 transition-transform`}>
        <Icon />
      </div>
      <div>
        <p className="text-[13px] text-slate-500 mb-1">
          {label}
        </p>
        <h3 className="text-xl font-bold text-slate-800">{value}</h3>
      </div>
    </div>
  );
};

export default StatCard;
