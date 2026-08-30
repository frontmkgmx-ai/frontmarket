import React, { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { Package, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { validateIdentity } from '../../lib/identityValidators';
import { maskCPF } from '../../lib/utils';
import { maskCNPJ } from '../../lib/validators';

export function Register() {
  const [document, setDocument] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validatingDoc, setValidatingDoc] = useState(false);
  const [docFeedback, setDocFeedback] = useState<{valid: boolean; message: string} | null>(null);
  const navigate = useNavigate();

  const handleDocumentChange = (value: string) => {
    const numbersOnly = value.replace(/\D/g, '');
    let masked = value;
    if (numbersOnly.length <= 11) {
      masked = maskCPF(value);
    } else {
      masked = maskCNPJ(value);
    }
    setDocument(masked);
    setDocFeedback(null);
  };

  const validateDocField = async () => {
    const raw = document.replace(/\D/g, '');
    if (raw.length !== 11 && raw.length !== 14) {
      return;
    }
    
    setValidatingDoc(true);
    setDocFeedback(null);
    try {
      const result = await validateIdentity(document, name);
      setDocFeedback({
        valid: result.isValid,
        message: result.message
      });
      
      if (result.isValid && result.data?.type === 'CNPJ') {
        if (!name) {
          setName(result.data.razaoSocial);
        }
      }
    } catch (e: any) {
      setDocFeedback({
        valid: false,
        message: 'Erro ao validar documento.'
      });
    } finally {
      setValidatingDoc(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading || validatingDoc) return;
    
    setError('');
    
    const rawDoc = document.replace(/\D/g, '');
    if (rawDoc.length !== 11 && rawDoc.length !== 14) {
      setError('CPF ou CNPJ inválido.');
      return;
    }

    if (docFeedback && !docFeedback.valid) {
      setError('Corrija os erros no documento antes de prosseguir.');
      return;
    }
    
    setLoading(true);

    try {
      // Validar novamente antes de enviar
      const result = await validateIdentity(document, name);
      if (!result.isValid) {
        throw new Error(result.message);
      }

      // 1. Cria autenticação no Firebase
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: name });

      // 2. Grava perfil com setDoc
      await setDoc(doc(db, 'users', user.uid), {
        name,
        email,
        document: rawDoc,
        documentType: result.data?.type || (rawDoc.length === 11 ? 'CPF' : 'CNPJ'),
        role: 'merchant',
        stores: [],
        createdAt: serverTimestamp()
      });

      // 3. Redireciona diretamente para onboarding
      navigate('/onboarding', { replace: true });
    } catch (err: any) {
      console.error("Register error:", err);
      setError(err.message || 'Erro ao criar conta. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="max-w-md w-full space-y-8 bg-white/10 backdrop-blur-xl p-8 rounded-2xl border border-white/20 shadow-2xl">
        <div className="text-center">
          <Link to="/" className="mx-auto h-12 w-12 bg-white/20 rounded-full flex items-center justify-center border border-white/30 backdrop-blur-md hover:bg-white/30 transition-colors inline-flex">
            <Package className="h-6 w-6 text-white" />
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-white">
            Criar conta no Front MK
          </h2>
          <p className="mt-2 text-sm text-gray-300">
            Já tem uma conta?{' '}
            <Link to="/login" className="font-medium text-teal-300 hover:text-teal-200">
              Faça login
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-500/20 text-red-200 p-3 rounded-md text-sm border border-red-500/30">
              {error}
            </div>
          )}
          <div className="rounded-md space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300" htmlFor="document">
                CPF ou CNPJ
              </label>
              <div className="relative mt-1">
                <input
                  id="document"
                  name="document"
                  type="text"
                  required
                  value={document}
                  onChange={(e) => handleDocumentChange(e.target.value)}
                  onBlur={validateDocField}
                  className={`appearance-none relative block w-full px-3 py-2 bg-white/5 border ${docFeedback ? (docFeedback.valid ? 'border-emerald-500' : 'border-red-500') : 'border-white/20'} placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm backdrop-blur-sm`}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                />
                {validatingDoc && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
                  </div>
                )}
                {docFeedback && !validatingDoc && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {docFeedback.valid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                )}
              </div>
              {docFeedback && (
                <p className={`mt-1 text-xs ${docFeedback.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                  {docFeedback.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300" htmlFor="name">
                Nome Completo / Razão Social
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 bg-white/5 border border-white/20 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm mt-1 backdrop-blur-sm"
                placeholder="Seu Nome ou Empresa"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 bg-white/5 border border-white/20 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm mt-1 backdrop-blur-sm"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300" htmlFor="password">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-2 bg-white/5 border border-white/20 placeholder-gray-400 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm mt-1 backdrop-blur-sm"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-indigo-950 bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] cursor-pointer"
            >
              {loading ? 'Criando conta...' : 'Cadastrar e Começar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
