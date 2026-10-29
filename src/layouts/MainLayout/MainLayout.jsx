import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  FileText, 
  LogOut,
  Shield,
  Globe
} from 'lucide-react';
import './MainLayout.css';
import logo from '../../assets/logo.png';

export default function MainLayout() {
  const { user, logout } = useAuth();
  const { t, language, changeLanguage } = useLanguage();

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src={logo} alt="AS Quattro Logo" className="sidebar-logo-img" />
          <h2>AS Quattro</h2>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <LayoutDashboard size={20} />
            <span>{t('sidebar.dashboard')}</span>
          </NavLink>
          <NavLink to="/candidates" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <Users size={20} />
            <span>{t('sidebar.candidates')}</span>
          </NavLink>
          <NavLink to="/payments" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <CreditCard size={20} />
            <span>{t('sidebar.payments')}</span>
          </NavLink>
          <NavLink to="/documents" className={({isActive}) => isActive ? "nav-item active" : "nav-item"}>
            <FileText size={20} />
            <span>{t('sidebar.documents')}</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="language-toggle">
            <Globe size={16} className="lang-icon" />
            <button className={language === 'en' ? 'lang-btn active' : 'lang-btn'} onClick={() => changeLanguage('en')}>EN</button>
            <span className="lang-divider">|</span>
            <button className={language === 'bs' ? 'lang-btn active' : 'lang-btn'} onClick={() => changeLanguage('bs')}>BS</button>
          </div>
          <div className="user-info">
            <div className="user-avatar">{user?.username?.[0]?.toUpperCase()}</div>
            <span className="username">{user?.username}</span>
          </div>
          <button onClick={logout} className="logout-btn">
            <LogOut size={18} />
            <span>{t('sidebar.logout')}</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title">{t('sidebar.overview')}</div>
        </header>
        <div className="content-area">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
