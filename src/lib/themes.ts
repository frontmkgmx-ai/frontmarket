export interface ThemeConfig {
  id: string;
  name: string;
  colors: {
    background: string;
    text: string;
    primary: string;
    secondary: string;
    surface: string;
    border: string;
  };
  fontFamily: string;
  borderRadius: string;
}

export const STORE_THEMES: ThemeConfig[] = [
  {
    id: 'default',
    name: 'Padrão',
    colors: {
      background: 'bg-slate-50',
      text: 'text-slate-900',
      primary: 'bg-indigo-600',
      secondary: 'bg-indigo-100',
      surface: 'bg-white',
      border: 'border-slate-200'
    },
    fontFamily: 'font-sans',
    borderRadius: 'rounded-xl'
  },
  {
    id: 'dark',
    name: 'Modo Escuro',
    colors: {
      background: 'bg-slate-950',
      text: 'text-slate-50',
      primary: 'bg-indigo-500',
      secondary: 'bg-slate-800',
      surface: 'bg-slate-900',
      border: 'border-slate-800'
    },
    fontFamily: 'font-sans',
    borderRadius: 'rounded-xl'
  },
  {
    id: 'elegant',
    name: 'Elegante',
    colors: {
      background: 'bg-stone-50',
      text: 'text-stone-900',
      primary: 'bg-stone-900',
      secondary: 'bg-stone-200',
      surface: 'bg-white',
      border: 'border-stone-200'
    },
    fontFamily: 'font-serif',
    borderRadius: 'rounded-none'
  },
  {
    id: 'playful',
    name: 'Divertido',
    colors: {
      background: 'bg-amber-50',
      text: 'text-amber-950',
      primary: 'bg-rose-500',
      secondary: 'bg-amber-200',
      surface: 'bg-white',
      border: 'border-amber-200'
    },
    fontFamily: 'font-sans',
    borderRadius: 'rounded-3xl'
  },
  {
    id: 'minimal',
    name: 'Minimalista',
    colors: {
      background: 'bg-white',
      text: 'text-black',
      primary: 'bg-black',
      secondary: 'bg-gray-100',
      surface: 'bg-white',
      border: 'border-gray-100'
    },
    fontFamily: 'font-mono',
    borderRadius: 'rounded-sm'
  },
  {
    id: 'neon',
    name: 'Cyberpunk',
    colors: {
      background: 'bg-black',
      text: 'text-fuchsia-400',
      primary: 'bg-fuchsia-600',
      secondary: 'bg-cyan-900',
      surface: 'bg-zinc-900',
      border: 'border-fuchsia-900'
    },
    fontFamily: 'font-mono',
    borderRadius: 'rounded-none'
  },
  {
    id: 'vintage',
    name: 'Vintage',
    colors: {
      background: 'bg-orange-50',
      text: 'text-orange-950',
      primary: 'bg-orange-800',
      secondary: 'bg-orange-200',
      surface: 'bg-orange-100',
      border: 'border-orange-300'
    },
    fontFamily: 'font-serif',
    borderRadius: 'rounded-md'
  },
  {
    id: 'nature',
    name: 'Natureza',
    colors: {
      background: 'bg-green-50',
      text: 'text-green-950',
      primary: 'bg-green-700',
      secondary: 'bg-green-200',
      surface: 'bg-white',
      border: 'border-green-200'
    },
    fontFamily: 'font-sans',
    borderRadius: 'rounded-2xl'
  },
  {
    id: 'corporate',
    name: 'Corporativo',
    colors: {
      background: 'bg-slate-100',
      text: 'text-slate-800',
      primary: 'bg-blue-700',
      secondary: 'bg-blue-100',
      surface: 'bg-white',
      border: 'border-slate-300'
    },
    fontFamily: 'font-sans',
    borderRadius: 'rounded-sm'
  },
  {
    id: 'tech',
    name: 'Tech',
    colors: {
      background: 'bg-slate-900',
      text: 'text-cyan-50',
      primary: 'bg-cyan-500',
      secondary: 'bg-cyan-900',
      surface: 'bg-slate-800',
      border: 'border-slate-700'
    },
    fontFamily: 'font-sans',
    borderRadius: 'rounded-lg'
  }
];
