import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Save, User, MapPin, Phone, Mail, Award, CreditCard, Activity, Plus, FileText } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import RecordPaymentModal from './RecordPaymentModal';
import LogLessonModal from './LogLessonModal';
import './CandidateProfile.css';

const LICENSE_CATEGORIES = ['A', 'B', 'C', 'D', 'E'];

export default function CandidateProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, currencySymbol } = useLanguage();
  
  const [activeTab, setActiveTab] = useState('Overview');
  const [candidate, setCandidate] = useState(null);
  const [paymentsData, setPaymentsData] = useState({ data: [], summary: {} });
  const [lessonsData, setLessonsData] = useState({ data: [], summary: {} });
  
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);

  useEffect(() => {
    fetchCandidateData();
  }, [id]);

  const fetchCandidateData = async () => {
    setLoading(true);
    try {
      const [candRes, payRes, lessRes] = await Promise.all([
        fetch(`http://localhost:3001/api/candidates/${id}`),
        fetch(`http://localhost:3001/api/quattrodrive/payments/candidate/${id}`),
        fetch(`http://localhost:3001/api/lessons/candidate/${id}`)
      ]);

      const candData = await candRes.json();
      const payData = await payRes.json();
      const lessData = await lessRes.json();

      if (candData.success) {
        setCandidate(candData.data);
        setFormData(candData.data);
      } else {
        setError(candData.message);
      }

      if (payData.success) setPaymentsData(payData);
      if (lessData.success) setLessonsData(lessData);

    } catch (err) {
      setError('Error connecting to backend');
    } finally {
      setLoading(false);
    }
  };

  const reloadFinancials = async () => {
    const res = await fetch(`http://localhost:3001/api/quattrodrive/payments/candidate/${id}`);
    const data = await res.json();
    if (data.success) setPaymentsData(data);
  };

  const reloadLessons = async () => {
    const res = await fetch(`http://localhost:3001/api/lessons/candidate/${id}`);
    const data = await res.json();
    if (data.success) setLessonsData(data);
  };

  const handleInputChange = (e) => {
    const { name, type, checked, value } = e.target;
    let newValue = type === 'checkbox' ? checked : value;
    
    let updatedForm = { ...formData, [name]: newValue };

    // Validation: uncheck practical if theory is unchecked
    if (name === 'theory_test_passed' && !newValue) {
      updatedForm.practical_test_passed = false;
    }

    setFormData(updatedForm);
  };

  const handleSave = async () => {
    setSaveLoading(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:3001/api/candidates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (data.success) {
        setCandidate(data.data);
        setEditMode(false);
        reloadFinancials(); // Refresh balance in case total_course_fee changed
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Unable to save changes');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm(t('profile.confirm_delete'))) {
      try {
        const res = await fetch(`http://localhost:3001/api/candidates/${id}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
          navigate('/candidates');
        } else {
          setError(data.message);
        }
      } catch (err) {
        setError('Failed to delete candidate');
      }
    }
  };



  if (loading) return <div className="profile-loading">{t('global.loading')}</div>;
  if (error && !candidate) return <div className="profile-error">{error}</div>;

  return (
    <div className="profile-container">
      <div className="profile-header">
        <button className="back-btn" onClick={() => navigate('/candidates')}>
          <ArrowLeft size={20} />
          <span>{t('profile.back')}</span>
        </button>
        
        <div className="header-actions">
          {activeTab === 'Overview' && (
            editMode ? (
              <button className="save-btn" onClick={handleSave} disabled={saveLoading}>
                <Save size={18} />
                <span>{saveLoading ? t('global.saving') : t('global.save')}</span>
              </button>
            ) : (
              <>
                <button className="edit-btn" onClick={() => setEditMode(true)}>
                  <Edit2 size={18} />
                  <span>{t('global.edit')}</span>
                </button>
                <button className="delete-btn" onClick={handleDelete} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                  <span>{t('profile.delete')}</span>
                </button>
              </>
            )
          )}
          {activeTab === 'Payments' && (
            <button className="save-btn" onClick={() => setIsPaymentModalOpen(true)}>
              <Plus size={18} />
              <span>{t('profile.record_payment')}</span>
            </button>
          )}
          {activeTab === 'Lessons' && (
            <button className="save-btn" onClick={() => setIsLessonModalOpen(true)}>
              <Plus size={18} />
              <span>{t('profile.log_lesson')}</span>
            </button>
          )}
        </div>
      </div>

      {error && editMode && <div className="error-banner">{error}</div>}

      <div className="profile-tabs">
        <button className={activeTab === 'Overview' ? 'tab active' : 'tab'} onClick={() => setActiveTab('Overview')}>{t('profile.tab_overview')}</button>
        <button className={activeTab === 'Payments' ? 'tab active' : 'tab'} onClick={() => setActiveTab('Payments')}>{t('profile.tab_payments')}</button>
        <button className={activeTab === 'Lessons' ? 'tab active' : 'tab'} onClick={() => setActiveTab('Lessons')}>{t('profile.tab_lessons')}</button>
      </div>

      {activeTab === 'Overview' && (
        <div className="profile-grid">
          {/* Basic Info Card */}
          <div className="profile-card">
            <div className="card-header">
              <User size={20} />
              <h3>{t('profile.personal_info')}</h3>
            </div>
            <div className="card-body">
              <div className="info-group">
                <label>{t('table.fullname')}</label>
                {editMode ? (
                  <input type="text" name="full_name" value={formData.full_name} onChange={handleInputChange} />
                ) : (
                  <p className="font-medium">{candidate.full_name}</p>
                )}
              </div>
              <div className="info-row">
                <div className="info-group">
                  <label>{t('table.personal_id')} (JMBG)</label>
                  {editMode ? (
                    <input 
                      type="text" 
                      name="personal_id_number" 
                      value={formData.personal_id_number} 
                      onChange={handleInputChange} 
                      pattern="\d{13}"
                      minLength="13"
                      maxLength="13"
                      title="JMBG must be exactly 13 digits"
                      required
                    />
                  ) : (
                    <p>{candidate.personal_id_number}</p>
                  )}
                </div>
                <div className="info-group">
                  <label>{t('modal.dob')}</label>
                  {editMode ? (
                    <input type="date" name="dob" value={formData.dob} onChange={handleInputChange} />
                  ) : (
                    <p>{new Date(candidate.dob).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Contact Info Card */}
          <div className="profile-card">
            <div className="card-header">
              <Phone size={20} />
              <h3>{t('profile.contact_details')}</h3>
            </div>
            <div className="card-body">
              <div className="info-group">
                <label><MapPin size={14} className="inline-icon" /> {t('modal.address')}</label>
                {editMode ? (
                  <input type="text" name="address" value={formData.address || ''} onChange={handleInputChange} />
                ) : (
                  <p>{candidate.address || '-'}</p>
                )}
              </div>
              <div className="info-row">
                <div className="info-group">
                  <label><Phone size={14} className="inline-icon" /> {t('modal.phone')}</label>
                  {editMode ? (
                    <input type="tel" name="phone_number" value={formData.phone_number || ''} onChange={handleInputChange} />
                  ) : (
                    <p>{candidate.phone_number || '-'}</p>
                  )}
                </div>
                <div className="info-group">
                  <label><Mail size={14} className="inline-icon" /> {t('modal.email')}</label>
                  {editMode ? (
                    <input type="email" name="email" value={formData.email || ''} onChange={handleInputChange} />
                  ) : (
                    <p>{candidate.email || '-'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Training Status Card */}
          <div className="profile-card">
            <div className="card-header">
              <Activity size={20} />
              <h3>{t('profile.training_status')}</h3>
            </div>
            <div className="card-body">
              <div className="info-row">
                <div className="info-group">
                  <label>{t('table.category')}</label>
                  {editMode ? (
                    <select name="license_category" value={formData.license_category} onChange={handleInputChange}>
                      {LICENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  ) : (
                    <span className="category-badge">{candidate.license_category}</span>
                  )}
                </div>
                <div className="info-group">
                  <label>{t('table.status')}</label>
                  {editMode ? (
                    <select name="status" value={formData.status} onChange={handleInputChange}>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="On Hold">On Hold</option>
                    </select>
                  ) : (
                    <span className={`status-badge status-${candidate.status.replace(' ', '').toLowerCase()}`}>
                      {t(`status.${candidate.status.replace(' ', '').toLowerCase()}`)}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="tests-container">
                <label>{t('profile.examinations')}</label>
                <div className="test-checkboxes">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      name="theory_test_passed" 
                      checked={editMode ? formData.theory_test_passed : candidate.theory_test_passed === 1} 
                      onChange={handleInputChange}
                      disabled={!editMode}
                    />
                    <span>{t('profile.theory')}</span>
                  </label>
                  <label className="checkbox-label" style={(!editMode || !formData.theory_test_passed) && editMode ? {opacity: 0.5} : {}}>
                    <input 
                      type="checkbox" 
                      name="practical_test_passed" 
                      checked={editMode ? formData.practical_test_passed : candidate.practical_test_passed === 1} 
                      onChange={handleInputChange}
                      disabled={!editMode || !formData.theory_test_passed}
                    />
                    <span>{t('profile.practical')}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Setup Card */}
          <div className="profile-card">
            <div className="card-header">
              <CreditCard size={20} />
              <h3>{t('profile.financial_overview')}</h3>
            </div>
            <div className="card-body">
              <div className="info-group">
                <label>{t('modal.fee')} ({currencySymbol})</label>
                {editMode ? (
                  <input type="number" name="total_course_fee" value={formData.total_course_fee} onChange={handleInputChange} min="0" step="0.01" />
                ) : (
                  <p className="fee-display">{candidate.total_course_fee.toFixed(2)} {currencySymbol}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Payments' && (
        <div className="tab-content">
          <div className="summary-cards">
            <div className="summary-card">
              <label>{t('modal.fee')}</label>
              <h3>{paymentsData.summary.totalCourseFee?.toFixed(2) || '0.00'} {currencySymbol}</h3>
            </div>
            <div className="summary-card">
              <label>{t('profile.total_paid')}</label>
              <h3 className="text-green">{paymentsData.summary.totalPaid?.toFixed(2) || '0.00'} {currencySymbol}</h3>
            </div>
            <div className="summary-card">
              <label>{t('profile.outstanding')}</label>
              <h3 className={paymentsData.summary.outstandingBalance > 0 ? "text-red" : ""}>
                {paymentsData.summary.outstandingBalance?.toFixed(2) || '0.00'} {currencySymbol}
              </h3>
            </div>
          </div>
          
          <div className="table-wrapper mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('table.date')}</th>
                  <th>{t('table.method')}</th>
                  <th>{t('table.amount')}</th>
                  <th>{t('table.notes')}</th>
                </tr>
              </thead>
              <tbody>
                {paymentsData.data.length === 0 ? (
                  <tr><td colSpan="4" className="table-empty">No payments recorded yet.</td></tr>
                ) : (
                  paymentsData.data.map(payment => (
                    <tr key={payment.id}>
                      <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                      <td>
                        <span className={`method-badge method-${payment.payment_method.toLowerCase()}`}>
                          {payment.payment_method}
                        </span>
                      </td>
                      <td className="font-medium text-green">{payment.amount.toFixed(2)} {currencySymbol}</td>
                      <td className="text-muted">{payment.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Lessons' && (
        <div className="tab-content">
          <div className="summary-cards">
            <div className="summary-card">
              <label>{t('profile.total_lessons')}</label>
              <h3>{lessonsData.summary.totalLessons || 0}</h3>
            </div>
            <div className="summary-card">
              <label>{t('profile.total_hours')}</label>
              <h3>{lessonsData.summary.totalDuration?.toFixed(1) || '0.0'}</h3>
            </div>
          </div>

          <div className="table-wrapper mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('table.date')}</th>
                  <th>{t('table.time')}</th>
                  <th>{t('table.instructor')}</th>
                  <th>{t('table.duration')}</th>
                  <th>{t('table.notes')}</th>
                </tr>
              </thead>
              <tbody>
                {lessonsData.data.length === 0 ? (
                  <tr><td colSpan="5" className="table-empty">No lessons logged yet.</td></tr>
                ) : (
                  lessonsData.data.map(lesson => (
                    <tr key={lesson.id}>
                      <td>{new Date(lesson.lesson_date).toLocaleDateString()}</td>
                      <td>{lesson.lesson_time || '-'}</td>
                      <td className="font-medium">{lesson.instructor_name}</td>
                      <td>{lesson.duration_hours}</td>
                      <td className="text-muted">{lesson.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RecordPaymentModal 
        isOpen={isPaymentModalOpen} 
        onClose={() => setIsPaymentModalOpen(false)} 
        candidateId={id} 
        onPaymentRecorded={reloadFinancials} 
      />
      <LogLessonModal 
        isOpen={isLessonModalOpen} 
        onClose={() => setIsLessonModalOpen(false)} 
        candidateId={id} 
        onLessonLogged={reloadLessons} 
      />
    </div>
  );
}
