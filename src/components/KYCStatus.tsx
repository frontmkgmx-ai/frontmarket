import React from 'react';
import { useDiditStatus } from '../hooks/useDiditStatus';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  approved: { label: '✅ Aprovado', color: '#22c55e' },
  declined: { label: '❌ Recusado', color: '#ef4444' },
  review: { label: '🔍 Em revisão', color: '#f59e0b' },
  pending: { label: '⏳ Pendente', color: '#6b7280' },
  processing: { label: '⚙️ Processando', color: '#3b82f6' },
};

interface KYCStatusProps {
  vendorData?: string;
}

export function KYCStatus({ vendorData }: KYCStatusProps) {
  const { status, documentData, loading, error, refresh } = useDiditStatus(vendorData);

  if (loading) return <p className="text-sm text-gray-500">Carregando status KYC...</p>;
  if (error) return <p className="text-sm text-red-500">Erro: {error}</p>;
  
  if (!status) return <p className="text-sm text-gray-500">Nenhum status encontrado. Inicie a verificação.</p>;

  const config = STATUS_CONFIG[status] || { label: status, color: '#6b7280' };

  return (
    <div className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-2">Status da Verificação</h3>
      <p style={{ color: config.color }} className="font-bold text-lg mb-4">
        {config.label}
      </p>

      {documentData && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-sm text-gray-700">
          <h4 className="font-semibold text-gray-900 mb-2">Dados Extraídos</h4>
          <p><strong>Nome:</strong> {documentData.first_name} {documentData.last_name}</p>
          <p><strong>Documento:</strong> {documentData.document_number}</p>
          <p><strong>Nascimento:</strong> {documentData.date_of_birth}</p>
          <p><strong>Nacionalidade:</strong> {documentData.nationality}</p>
          <p><strong>Validade:</strong> {documentData.expiry_date}</p>
        </div>
      )}

      <button 
        onClick={refresh}
        className="mt-4 text-xs font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1"
      >
        🔄 Atualizar
      </button>
    </div>
  );
}
