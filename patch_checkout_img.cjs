const fs = require('fs');
let code = fs.readFileSync('src/pages/storefront/Checkout.tsx', 'utf8');

// add StreamxImage import if not present
if (!code.includes('StreamxImage')) {
  code = code.replace(
    "import { formatCurrency } from '../../lib/utils';",
    "import { formatCurrency } from '../../lib/utils';\nimport { StreamxImage } from '../../components/StreamxImage';"
  );
  code = code.replace(
    "import { ShoppingBag, ChevronRight, CheckCircle2, ShieldCheck, MapPin, Truck, Copy, Check, QrCode, CreditCard, Lock, Mail, User, Phone, ArrowLeft, Plus } from 'lucide-react';",
    "import { ShoppingBag, ChevronRight, CheckCircle2, ShieldCheck, MapPin, Truck, Copy, Check, QrCode, CreditCard, Lock, Mail, User, Phone, ArrowLeft, Plus, Image as ImageIcon } from 'lucide-react';"
  );
}

// Add the image in the item list
const oldLi = `<li key={item.productId} className="py-2.5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                      {item.quantity}x
                    </span>
                    <span className="text-slate-800 line-clamp-1 font-medium">{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-900 ml-2 shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                </li>`;

const newLi = `<li key={item.productId} className="py-3 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-12 aspect-video shrink-0 bg-slate-100 rounded overflow-hidden flex items-center justify-center border border-slate-200">
                      {(item as any).image ? (
                        <StreamxImage src={(item as any).image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">
                        {item.quantity}x
                      </span>
                      <span className="text-slate-800 line-clamp-2 font-medium leading-snug">{item.name}</span>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 ml-2 shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                </li>`;

code = code.replace(oldLi, newLi);

fs.writeFileSync('src/pages/storefront/Checkout.tsx', code);
