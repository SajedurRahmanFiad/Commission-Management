import React, { useMemo } from 'react';
import { User, Sale } from '../../types';

interface SalesPerformanceChartProps {
  users: User[];
  sales: Sale[];
}

const SalesPerformanceChart: React.FC<SalesPerformanceChartProps> = ({ users, sales }) => {
  const employees = users.filter(u => u.role === 'employee');
  
  const chartData = useMemo(() => {
    return employees.map(emp => {
      const count = sales.filter(s => s.employeeId === emp.id && s.status === 'completed').length;
      return {
        name: emp.username || emp.email.split('@')[0],
        count
      };
    }).sort((a, b) => b.count - a.count);
  }, [employees, sales]);

  const maxCount = Math.max(...chartData.map(d => d.count), 1);

  return (
    <div className="bg-white p-6 rounded-[1rem] border border-slate-200 shadow-sm">
      <div className="mb-8">
        <h3 className="text-md font-bold text-slate-800">Team Performance</h3>
        <p className="text-xs text-slate-400 font-medium mt-1">Comparing sales per agent</p>
      </div>
      
      <div className="space-y-6">
        {chartData.length > 0 ? chartData.map((data, i) => (
          <div key={i} className="group">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-bold text-slate-700">{data.name}</span>
              <span className="text-xs font-bold text-indigo-600">{data.count} Sales</span>
            </div>
            <div className="h-3 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${(data.count / maxCount) * 100}%` }}
              ></div>
            </div>
          </div>
        )) : (
          <div className="h-40 flex items-center justify-center text-slate-300 italic text-xs tracking-widest">
            Insufficient Data for Analytics
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesPerformanceChart;
