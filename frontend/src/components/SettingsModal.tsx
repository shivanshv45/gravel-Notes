import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [theme, setTheme] = useState(localStorage.getItem('gravel_theme') || 'dark');
  const [customBg, setCustomBg] = useState(localStorage.getItem('gravel_custom_bg') || '');
  const [customTextColor, setCustomTextColor] = useState(localStorage.getItem('gravel_custom_text_color') || '');

  // Handle changes immediately
  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTheme = e.target.value;
    setTheme(newTheme);
    localStorage.setItem('gravel_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  };

  const handleBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newBg = e.target.value;
    setCustomBg(newBg);
    localStorage.setItem('gravel_custom_bg', newBg);
    if (newBg) {
      document.documentElement.style.setProperty('--custom-bg', newBg);
    } else {
      document.documentElement.style.removeProperty('--custom-bg');
    }
  };

  const handleTextColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setCustomTextColor(newColor);
    localStorage.setItem('gravel_custom_text_color', newColor);
    if (newColor) {
      document.documentElement.style.setProperty('--text-primary', newColor);
    } else {
      document.documentElement.style.removeProperty('--text-primary');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Theme</label>
            <select
              value={theme}
              onChange={handleThemeChange}
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--bg-app)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
              }}
            >
              <option value="dark">Dark (Default)</option>
              <option value="light">Light</option>
              <option value="contrast">High Contrast</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Custom Background (Color or URL)</label>
            <input
              type="text"
              value={customBg}
              onChange={handleBgChange}
              placeholder="e.g. #ff0000 or url(https://...)"
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--bg-app)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
              }}
            />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Leave blank to use the theme default.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Custom Text Color</label>
            <input
              type="text"
              value={customTextColor}
              onChange={handleTextColorChange}
              placeholder="e.g. #00ff00 or white"
              style={{
                width: '100%',
                padding: '8px',
                background: 'var(--bg-app)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
              }}
            />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Overrides the main text color. Leave blank for theme default. You can also use tags like &lt;blue&gt;text&lt;/blue&gt; in your notes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
