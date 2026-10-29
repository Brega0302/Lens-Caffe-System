import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Car, 
  DollarSign, 
  AlertCircle,
  Plus,
  CreditCard,
  Calendar,
  Clock
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import './Dashboard.css';

export default function Dashboard() {
  const { t, currencySymbol } = useLanguage();
  const navigate = useNavigate();
  const [data, setData] = useState({
    activeCandidates: 0,
    todaysLessons: 0,
    monthlyRevenue: 0,
    outstandingBalance: 0,
    schedule: [],
    alerts: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/quattrodrive/dashboard/summary');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>{t('dashboard.welcome')}</h1>
        <p>{t('dashboard.subtitle')}</p>
      </div>

      {/* Metric Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon bg-blue-100">
            <Users className="text-blue-600" size={24} />
          </div>
          <div className="metric-content">
            <p className="metric-title">{t('dashboard.activeCandidates')}</p>
            <h3 className="metric-value">{data.activeCandidates}</h3>
          </div>
        </div>
        
        <div className="metric-card">
          <div className="metric-icon bg-green-100">
            <Car className="text-green-600" size={24} />
          </div>
          <div className="metric-content">
            <p className="metric-title">{t('dashboard.todaysLessons')}</p>
            <h3 className="metric-value">{data.todaysLessons}</h3>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon bg-orange-100">
            <DollarSign className="text-orange-600" size={24} />
          </div>
          <div className="metric-content">
            <p className="metric-title">{t('dashboard.monthlyRevenue')}</p>
            <h3 className="metric-value">{data.monthlyRevenue} {currencySymbol}</h3>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon bg-red-100">
            <AlertCircle className="text-red-600" size={24} />
          </div>
          <div className="metric-content">
            <p className="metric-title">{t('dashboard.outstandingBalances')}</p>
            <h3 className="metric-value">{data.outstandingBalance} {currencySymbol}</h3>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>{t('dashboard.quickActions')}</h3>
        <div className="actions-grid">
          <button className="action-btn" onClick={() => navigate('/candidates')}>
            <Plus size={20} />
            <span>{t('dashboard.addCandidate')}</span>
          </button>
          <button className="action-btn" onClick={() => navigate('/candidates')}>
            <CreditCard size={20} />
            <span>{t('dashboard.recordPayment')}</span>
          </button>
          <button className="action-btn" onClick={() => navigate('/candidates')}>
            <Calendar size={20} />
            <span>{t('dashboard.scheduleLesson')}</span>
          </button>
        </div>
      </div>

      <div className="dashboard-main-grid">
        {/* Today's Schedule */}
        <div className="dashboard-panel">
          <div className="panel-header">
            <h3>{t('dashboard.todaysSchedule')}</h3>
            <span className="badge">{data.schedule.length} {t('dashboard.lessons')}</span>
          </div>
          {data.schedule.length === 0 ? (
            <p className="empty-state">{t('dashboard.noLessons')}</p>
          ) : (
            <ul className="schedule-list">
              {data.schedule.map(lesson => (
                <li key={lesson.id} className="schedule-item">
                  <div className="time-col">
                    <Clock size={16} />
                    <span>{lesson.lesson_time || `${lesson.duration_hours} hr`}</span>
                  </div>
                  <div className="info-col">
                    <p className="candidate-name">{lesson.candidate_name}</p>
                    <p className="instructor-name">{t('dashboard.instructor')}: {lesson.instructor_name}</p>
                  </div>
                  <button className="view-btn" onClick={() => navigate(`/candidates/${lesson.id}`)}>
                    {t('profile.tab_overview')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Alerts & Warnings */}
        <div className="dashboard-panel border-warning">
          <div className="panel-header">
            <h3>{t('dashboard.unpaidAlerts')}</h3>
          </div>
          {data.alerts.length === 0 ? (
            <p className="empty-state">{t('dashboard.allPaid')}</p>
          ) : (
            <ul className="alerts-list">
              {data.alerts.map(alert => (
                <li key={alert.id} className="alert-item">
                  <div className="alert-info">
                    <AlertCircle size={18} className="text-red-500" />
                    <span className="candidate-name">{alert.full_name}</span>
                  </div>
                  <div className="alert-amount">
                    {t('dashboard.owes')} {alert.owed} {currencySymbol}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
