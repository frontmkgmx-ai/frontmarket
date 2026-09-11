import React from 'react';
import { useDiditStatus } from '../hooks/useDiditStatus';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  approved: { label: '✅ Aprovada', color: '#22c55e' },
  declined: { label: '❌ Rejeitada', color: '#ef4444' },
  in_progress: { label: '🔍 Em análise', color: '#f59e0b' },
  review: { label: '🔍 Em revisão manual', color: '#f59e0b' },
  pending: { label: '⏳ Aguardando verificação', color: '#6b7280' },
  not_started: { label: '⚪ Não iniciada', color: '#6b7280' }
};

interface KYCStatusProps {
  className?: string;
}

export function KYCStatus({ className }: KYCStatusProps = {}) {
  const { status, loading, error, refresh } = useDiditStatus();

  if (loading) return <p className="text-sm text-gray-500">Carregando status KYC...</p>;
  if (error) return <p className="text-sm text-red-500">Erro ao consultar verificação: {error}</p>;
  
  if (!status) return <p className="text-sm text-gray-500">Nenhum status encontrado. Inicie a verificação.</p>;

  const config = STATUS_CONFIG[status] || { label: status, color: '#6b7280' };

  return (
    <div className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-2">Status da Verificação</h3>
      <p style={{ color: config.color }} className="font-bold text-lg mb-2">
        {config.label}
      </p>

      <button 
        onClick={() => refresh()}
        className="mt-2 text-xs font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1"
      >
        Atualizar Status
      </button>
    </div>
  );
}
