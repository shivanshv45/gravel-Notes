import React, { useState } from 'react';
import { X, LogIn, LogOut, Cloud, CloudOff } from 'lucide-react';
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

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <h2>{user ? 'Account' : 'Sign In'}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', padding: '30px 20px' }}>
          {!user ? (
            <>
              <CloudOff size={40} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '13px', lineHeight: '1.6' }}>
                Sign in to sync your notes to the cloud, share them with others, and access them from any device.
              </p>
              
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '10px', marginTop: '10px' }}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ padding: '10px', background: 'var(--bg-app)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ padding: '10px', background: 'var(--bg-app)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                />
                
                {errorMsg && <p style={{ color: errorMsg.includes('Success') ? '#4db6a0' : '#dc3c3c', fontSize: '13px', textAlign: 'center' }}>{errorMsg}</p>}
                
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    padding: '10px 24px',
                    background: 'var(--accent-color)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: loading ? 'wait' : 'pointer',
                    marginTop: '8px',
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  <LogIn size={16} />
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </button>
              </form>
              
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '10px', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); }}>
                {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
              </p>
            </>
          ) : (
            <>
              <Cloud size={40} style={{ color: 'var(--accent-color)', marginBottom: '8px' }} />
              <p style={{ color: 'var(--text-highlight)', fontWeight: 600, fontSize: '15px' }}>
                {user.user_metadata?.full_name || user.email}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                {user.email}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', lineHeight: '1.5' }}>
                Your notes are being synced to the cloud.
              </p>
              <button
                onClick={handleSignOut}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 20px',
                  background: 'transparent',
                  color: '#dc3c3c',
                  border: '1px solid #dc3c3c',
                  borderRadius: '4px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  marginTop: '8px',
                }}
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
