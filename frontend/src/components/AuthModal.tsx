import React, { useState } from 'react';
import { X, Cloud } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const { user, signInWithEmail, signUpWithEmail, signOut } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter email and password');
      return;
    }
    
    setLoading(true);
    setErrorMsg('');

    let error = null;
    if (isSignUp) {
      const res = await signUpWithEmail(email, password);
      error = res.error;
    } else {
      const res = await signInWithEmail(email, password);
      error = res.error;
    }

    if (error) {
      setErrorMsg(error.message);
    } else if (isSignUp) {
      setErrorMsg('Success! Please check your email to confirm your account before signing in.');
      setIsSignUp(false);
      setPassword('');
    } else {
      onClose(); // Close on successful login
    }
    
    setLoading(false);
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    background: 'var(--bg-app)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    fontSize: '13px',
    outline: 'none',
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cloud size={16} />
            {user ? 'Account' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!user ? (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.5' }}>
                {isSignUp 
                  ? 'Create an account to sync notes across devices and share them.' 
                  : 'Sign in to access your synced notes and shared workspaces.'}
              </p>
              
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                />
                
                {errorMsg && (
                  <p style={{ color: errorMsg.includes('Success') ? '#4db6a0' : '#dc3c3c', fontSize: '13px' }}>
                    {errorMsg}
                  </p>
                )}
                
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '8px 14px',
                    background: 'var(--accent-color)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '13px',
                    cursor: loading ? 'wait' : 'pointer',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </button>
              </form>
              
              <p 
                style={{ fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }} 
                onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); }}
              >
                {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
              </p>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
                  Signed in as
                </span>
                <p style={{ color: 'var(--text-primary)', fontSize: '14px', marginTop: '4px' }}>
                  {user.email}
                </p>
              </div>
              
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.5' }}>
                Your notes are being synced to the cloud. You can safely close this window.
              </p>
              
              <button
                onClick={handleSignOut}
                style={{
                  padding: '8px 14px',
                  background: 'transparent',
                  color: '#dc3c3c',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  width: 'fit-content'
                }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
