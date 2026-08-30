// 1. Validação Algorítmica de CPF (Sem consumo de API)
export function isValidCPF(cpf: string): boolean {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;

  let sum = 0;
  let rest;

  for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.substring(10, 11))) return false;

  return true;
}

// Validação Algorítmica de CNPJ
export function isValidCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/[^\d]+/g, '');
  if (cnpj.length !== 14 || !!cnpj.match(/(\d)\1{13}/)) return false;

  let length = cnpj.length - 2;
  let numbers = cnpj.substring(0, length);
  let digits = cnpj.substring(length);
  let sum = 0;
  let pos = length - 7;

  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  length = length + 1;
  numbers = cnpj.substring(0, length);
  sum = 0;
  pos = length - 7;
  for (let i = length; i >= 1; i--) {
    sum += parseInt(numbers.charAt(length - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

// 2. Consulta Pública e Gratuita de CNPJ (BrasilAPI)
export async function fetchCNPJ(cnpj: string) {
  const cleanCNPJ = cnpj.replace(/[^\d]+/g, '');
  if (cleanCNPJ.length !== 14) throw new Error('CNPJ inválido');

  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`);
  if (!res.ok) throw new Error('CNPJ não encontrado na base oficial');
  return await res.json();
}

// 3. Validação Sintática de Tipo de Chave Pix
export function validatePixKey(key: string) {
  const cleanKey = key.trim();

  // CPF (11 dígitos numéricos)
  if (/^\d{11}$/.test(cleanKey.replace(/[^\d]/g, '')) && isValidCPF(cleanKey)) {
    return { valid: true, type: 'CPF' };
  }

  // CNPJ (14 dígitos numéricos)
  if (/^\d{14}$/.test(cleanKey.replace(/[^\d]/g, '')) && isValidCNPJ(cleanKey)) {
    return { valid: true, type: 'CNPJ' };
  }

  // E-mail
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanKey)) {
    return { valid: true, type: 'EMAIL' };
  }

  // Telefone (+55 opcional + DDD + 9 dígitos)
  if (/^(\+55)?\d{10,11}$/.test(cleanKey.replace(/[^\d]/g, ''))) {
    return { valid: true, type: 'PHONE' };
  }

  // Chave Aleatória (UUID v4)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanKey)) {
    return { valid: true, type: 'EVP' };
  }

  return { valid: false, type: 'UNKNOWN' };
}

export function maskCNPJ(value: string) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
}
