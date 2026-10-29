import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import '../../components/AddCandidateModal/AddCandidateModal.css';

export default function LogLessonModal({ isOpen, onClose, candidateId, onLessonLogged }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    candidate_id: candidateId,
    lesson_date: new Date().toISOString().split('T')[0],
    lesson_time: '',
    instructor_name: '',
    duration_hours: 1,
    notes: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          duration_hours: parseFloat(formData.duration_hours)
        })
      });
      
      const data = await response.json();

      if (data.success) {
        onLessonLogged();
        setFormData({ ...formData, notes: '' });
        onClose();
      } else {
        setError(data.message || 'Failed to log lesson');
      }
    } catch (err) {
      setError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h2>{t('modal.log_lesson')}</h2>
          <button className="close-btn" onClick={onClose}><X size={24} /></button>
        </div>
        
        {error && <div className="modal-error">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="input-group full-width">
            <label>{t('modal.lesson_date')} *</label>
            <input 
              type="date" 
              name="lesson_date" 
              value={formData.lesson_date} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div className="input-group full-width">
            <label>{t('modal.lesson_time')}</label>
            <input 
              type="text" 
              name="lesson_time" 
              placeholder={t('modal.lesson_time_placeholder')}
              value={formData.lesson_time} 
              onChange={handleChange} 
            />
          </div>

          <div className="input-group full-width">
            <label>{t('modal.instructor_name')} *</label>
            <input 
              type="text" 
              name="instructor_name" 
              value={formData.instructor_name} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div className="input-group full-width">
            <label>{t('modal.duration_hours')} *</label>
            <input 
              type="number" 
              name="duration_hours" 
              value={formData.duration_hours} 
              onChange={handleChange} 
              min="0.5" 
              step="0.5" 
              required 
            />
          </div>

          <div className="input-group full-width">
            <label>{t('table.notes')}</label>
            <input type="text" name="notes" value={formData.notes} onChange={handleChange} />
          </div>

          <div className="modal-footer">
            <button type="button" className="cancel-btn" onClick={onClose}>{t('global.cancel')}</button>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? t('global.saving') : t('modal.log_lesson')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
