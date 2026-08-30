import { isValidCPF, isValidCNPJ, fetchCNPJ } from './validators';

export async function validateIdentity(
  document: string,
  name: string,
  birthDate?: string
): Promise<{ isValid: boolean; message: string; data?: any }> {
  const cleanDoc = document.replace(/[^\d]+/g, '');
  
  if (!cleanDoc) {
    return { isValid: false, message: 'Documento não fornecido.' };
  }

  // Se for CPF (11 dígitos)
  if (cleanDoc.length === 11) {
    if (!isValidCPF(cleanDoc)) {
      return { isValid: false, message: 'CPF inválido.' };
    }
    
    // Aqui seria a integração com API de KYC (Datavalid, Serpro, etc.)
    // Como fallback local e para protótipo, vamos aprovar se o CPF for válido
    // e os dados estiverem preenchidos.
    if (!name.trim()) {
      return { isValid: false, message: 'Nome é obrigatório.' };
    }
    
    return { 
      isValid: true, 
      message: 'CPF validado com sucesso (validação local).',
      data: { type: 'CPF', document: cleanDoc, name }
    };
  }
  
  // Se for CNPJ (14 dígitos)
  if (cleanDoc.length === 14) {
    if (!isValidCNPJ(cleanDoc)) {
      return { isValid: false, message: 'CNPJ inválido.' };
    }
    
    try {
      const cnpjData = await fetchCNPJ(cleanDoc);
      
      if (cnpjData.descricao_situacao_cadastral !== 'ATIVA') {
        return { 
          isValid: false, 
          message: `CNPJ inapto ou baixado. Situação: ${cnpjData.descricao_situacao_cadastral}` 
        };
      }
      
      return {
        isValid: true,
        message: 'CNPJ validado e ativo.',
        data: {
          type: 'CNPJ',
          document: cleanDoc,
          razaoSocial: cnpjData.razao_social,
          nomeFantasia: cnpjData.nome_fantasia || cnpjData.razao_social,
          cnae: cnpjData.cnae_fiscal_descricao,
          situacao: cnpjData.descricao_situacao_cadastral
        }
      };
    } catch (error: any) {
      return { isValid: false, message: error.message || 'Erro ao consultar CNPJ na base.' };
    }
  }

  return { isValid: false, message: 'Documento deve ser um CPF (11 dígitos) ou CNPJ (14 dígitos).' };
}
