const fs = require('fs');

let code = fs.readFileSync('src/pages/admin/Personalization.tsx', 'utf8');

// Add import
if (!code.includes('uploadFileToStreamx')) {
  code = code.replace(/import \{ Link \} from 'react-router';/, "import { Link } from 'react-router';\nimport { uploadFileToStreamx } from '../../lib/streamx';");
}

// Add state for uploading
if (!code.includes('const [uploadingLogo, setUploadingLogo]')) {
  code = code.replace(/const \[submitting, setSubmitting\] = useState\(false\);/, "const [submitting, setSubmitting] = useState(false);\n  const [uploadingLogo, setUploadingLogo] = useState(false);");
}

// Add handle upload function
if (!code.includes('handleLogoUpload')) {
  code = code.replace(/const handleSubmit = async \(e: React\.FormEvent\) => \{/, 
`  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    setUploadingLogo(true);
    try {
      const url = await uploadFileToStreamx(e.target.files[0]);
      setFormData(prev => ({ ...prev, logoUrl: url }));
    } catch (err) {
      console.error(err);
      alert('Erro ao fazer upload da logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {`);
}

// Add file input UI
const logoUI = `
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
                </div>`;

code = code.replace(/<input\s+type="url"\s+placeholder="https:\/\/exemplo.com\/logo.png"\s+value=\{formData\.logoUrl\}\s+onChange=\{\(e\) => setFormData\(\{ \.\.\.formData, logoUrl: e\.target\.value \}\)\}\s+className="[^"]+"\s+\/>/g, logoUI);

fs.writeFileSync('src/pages/admin/Personalization.tsx', code);
