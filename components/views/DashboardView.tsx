import React, { useState, useMemo } from 'react';
import { AppState, Sale } from '../../types';
import { Icons } from '../../constants';
import { SalesPerformanceChart, Button, StatCard } from '../shared';

interface DashboardViewProps {
  state: AppState;
  onApprove: (id: string) => void;
  onCreateSale: (e: string, p: string, a: number, pr: string, m: any) => void;
  displaySales: Sale[];
}

const DashboardView: React.FC<DashboardViewProps> = ({ state, onApprove, onCreateSale, displaySales }) => {
  const [showModal, setShowModal] = useState(false);
  const isEmployee = state.currentUser?.role === 'employee';
  const [formData, setFormData] = useState({ email: '', phone: '', amount: '', productId: '', method: 'bKash' as any });

  const stats = useMemo(() => isEmployee ? [
    { label: 'Wallet', val: `৳${state.currentUser?.wallet.toLocaleString()}`, color: 'text-emerald-600', icon: Icons.Wallet },
    { label: 'Total Sales', val: state.currentUser?.totalSalesCount || 0, color: 'text-indigo-600', icon: Icons.Check },
    { label: 'In Review', val: displaySales.filter(s => s.status === 'pending').length, color: 'text-amber-600', icon: Icons.Dashboard }
  ] : [
    { label: 'Admin Wallet', val: `৳${state.adminWallet.toLocaleString()}`, color: 'text-emerald-600', icon: Icons.Wallet },
    { label: 'Total Sales', val: displaySales.length, color: 'text-indigo-600', icon: Icons.Sales },
    { label: 'Pending Approval', val: displaySales.filter(s => s.status === 'pending').length, color: 'text-amber-600', icon: Icons.Bell }
  ], [state, isEmployee, displaySales]);


  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((s, i) => (
          <StatCard key={i} label={s.label} value={s.val} color={s.color} icon={s.icon} />
        ))}
      </div>

      <SalesPerformanceChart users={state.users} sales={displaySales} />
    </div>
  );
};

export default DashboardView;
