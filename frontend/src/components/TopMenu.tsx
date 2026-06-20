import React, { useState, useRef, useEffect } from 'react';
import type { MenuActions } from '../types';

// Top menu bar — modeled after Photopea's menu system.
// Click to open a dropdown, hover across to switch between menus,
// click elsewhere or mouse-leave to close. Standard desktop-app behavior.

interface TopMenuProps {
  actions: MenuActions;
  hasActiveNote: boolean;
}

// Keyboard shortcut labels shown next to menu items (display only, actual shortcuts handled in App)
const SHORTCUTS: Record<string, string> = {
  'New Note': 'Ctrl+N',
  'Save': 'Ctrl+S',
  'Undo': 'Ctrl+Z',
  'Redo': 'Ctrl+Shift+Z',
};

export const TopMenu: React.FC<TopMenuProps> = ({ actions, hasActiveNote }) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  // Fire the action and close the menu in one go
  const handleAction = (action: () => void) => {
    setActiveMenu(null);
    action();
  };

  const Separator = () => (
    <div style={{ borderBottom: '1px solid var(--border-color)', margin: '4px 0' }} />
  );

  return (
    <div className="top-menu" ref={menuRef}>
      {/* ─── File ─── */}
      <div
        className="menu-item"
        onMouseEnter={() => activeMenu && setActiveMenu('File')}
        onClick={() => toggleMenu('File')}
      >
        File
        {activeMenu === 'File' && (
          <div className="menu-dropdown">
            <div className="dropdown-item" onClick={() => handleAction(actions.onNewNote)}>
              <span>New Note</span>
              <span className="shortcut-label">{SHORTCUTS['New Note']}</span>
            </div>
            <div className="dropdown-item" onClick={() => handleAction(actions.onOpenFile)}>
              Open from Computer...
            </div>
            <Separator />
            <div
              className={`dropdown-item ${!hasActiveNote ? 'disabled' : ''}`}
              onClick={() => hasActiveNote && handleAction(actions.onSave)}
            >
              <span>Save</span>
              <span className="shortcut-label">{SHORTCUTS['Save']}</span>
            </div>
            <div
              className={`dropdown-item ${!hasActiveNote ? 'disabled' : ''}`}
              onClick={() => hasActiveNote && handleAction(actions.onRenameNote)}
            >
              Rename Note...
            </div>
            <div
              className={`dropdown-item ${!hasActiveNote ? 'disabled' : ''}`}
              onClick={() => hasActiveNote && handleAction(actions.onDeleteNote)}
            >
              Delete Note
            </div>
            <Separator />
            <div
              className={`dropdown-item ${!hasActiveNote ? 'disabled' : ''}`}
              onClick={() => hasActiveNote && handleAction(actions.onExportMd)}
            >
              Export as .md
            </div>
            <div
              className={`dropdown-item ${!hasActiveNote ? 'disabled' : ''}`}
              onClick={() => hasActiveNote && handleAction(actions.onExportTxt)}
            >
              Export as .txt
            </div>
            <div
              className={`dropdown-item ${!hasActiveNote ? 'disabled' : ''}`}
              onClick={() => hasActiveNote && handleAction(actions.onExportHtml)}
            >
              Export as .html
            </div>
            <div
              className={`dropdown-item ${!hasActiveNote ? 'disabled' : ''}`}
              onClick={() => hasActiveNote && handleAction(actions.onExportPdf)}
            >
              Export as .pdf
            </div>
          </div>
        )}
      </div>

      {/* ─── Edit ─── */}
      <div
        className="menu-item"
        onMouseEnter={() => activeMenu && setActiveMenu('Edit')}
        onClick={() => toggleMenu('Edit')}
      >
        Edit
        {activeMenu === 'Edit' && (
          <div className="menu-dropdown">
            <div className="dropdown-item" onClick={() => handleAction(actions.onUndo)}>
              <span>Undo</span>
              <span className="shortcut-label">{SHORTCUTS['Undo']}</span>
            </div>
            <div className="dropdown-item" onClick={() => handleAction(actions.onRedo)}>
              <span>Redo</span>
              <span className="shortcut-label">{SHORTCUTS['Redo']}</span>
            </div>
            <div style={{ borderBottom: '1px solid var(--border-color)', margin: '4px 0' }} />
            <div
              className={`dropdown-item ${!hasActiveNote ? 'disabled' : ''}`}
              onClick={() => hasActiveNote && handleAction(actions.onShowVersionHistory)}
            >
              Version History...
            </div>
          </div>
        )}
      </div>

      {/* ─── View ─── */}
      <div
        className="menu-item"
        onMouseEnter={() => activeMenu && setActiveMenu('View')}
        onClick={() => toggleMenu('View')}
      >
        View
        {activeMenu === 'View' && (
          <div className="menu-dropdown">
            <div className="dropdown-item" onClick={() => handleAction(actions.onToggleSidebar)}>
              Toggle Sidebar
            </div>
            <div className="dropdown-item" onClick={() => handleAction(actions.onTogglePreview)}>
              Toggle Preview Pane
            </div>
          </div>
        )}
      </div>

      {/* ─── Help ─── */}
      <div
        className="menu-item"
        onMouseEnter={() => activeMenu && setActiveMenu('Help')}
        onClick={() => toggleMenu('Help')}
      >
        Help
        {activeMenu === 'Help' && (
          <div className="menu-dropdown">
            <div className="dropdown-item" onClick={() => handleAction(actions.onShowMarkdownGuide)}>
              Markdown Guide
            </div>
            <div className="dropdown-item" onClick={() => handleAction(actions.onShowAbout)}>
              About Gravel
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
