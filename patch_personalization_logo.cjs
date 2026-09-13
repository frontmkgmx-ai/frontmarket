const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/Personalization.tsx', 'utf8');

const oldLogoBlock = `              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  URL da Logo (PNG, SVG, JPG ou ICO)
                </label>
                
                <div className="flex gap-2 mb-2">
                  <input
                    type="url"
                    placeholder="https://exemplo.com/logo.png"
                    value={formData.logoUrl}
                    onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-slate-50 focus:bg-white"
                  />
                  <label className="flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-xl cursor-pointer hover:bg-slate-800 transition-colors">
                    {uploadingLogo ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      'Upload'
                    )}
                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} />
                  </label>
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Insira o link direto para a imagem. Deixe em branco para usar o nome da loja.
                </p>
                {formData.logoUrl && (
                  <div className="mt-4 p-4 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center h-24">
                    <img src={formData.logoUrl} alt="Preview" className="max-h-full max-w-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>`;

const newLogoBlock = `              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Logotipo da Loja
                </label>
                
                <div className="flex gap-2 mb-2">
                  <label className="flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-xl cursor-pointer hover:bg-slate-800 transition-colors text-sm font-medium">
                    {uploadingLogo ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      'Fazer Upload'
                    )}
                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} />
                  </label>
                  {formData.logoUrl && (
                    <button
                      onClick={() => setFormData({ ...formData, logoUrl: '' })}
                      className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-sm font-medium"
                    >
                      Remover
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  Recomendado: Imagem PNG com fundo transparente. Deixe em branco para usar o nome da loja.
                </p>
                {formData.logoUrl && (
                  <div className="mt-4 p-4 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center h-24 relative group overflow-hidden">
                    <img src={formData.logoUrl} alt="Preview" className="max-h-full max-w-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                )}
              </div>`;

code = code.replace(oldLogoBlock, newLogoBlock);

fs.writeFileSync('src/pages/admin/Personalization.tsx', code);
