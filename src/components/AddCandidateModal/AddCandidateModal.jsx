import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import './AddCandidateModal.css';

const LICENSE_CATEGORIES = ['A', 'B', 'C', 'D', 'E'];

export default function AddCandidateModal({ isOpen, onClose, onCandidateAdded }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    full_name: '',
    dob: '',
    personal_id_number: '',
    address: '',
    phone_number: '',
    email: '',
    license_category: 'B'
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
      const response = await fetch('http://localhost:3001/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();

      if (data.success) {
        setFormData({
          full_name: '', dob: '', personal_id_number: '', address: '', phone_number: '', email: '', license_category: 'B'
        });
        onCandidateAdded(data.data);
        onClose();
      } else {
        setError(data.message || 'Failed to add candidate');
      }
    } catch (err) {
      setError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{t('modal.add_candidate')}</h2>
          <button className="close-btn" onClick={onClose}><X size={24} /></button>
        </div>
        
        {error && <div className="modal-error">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="input-group">
              <label>{t('table.fullname')} *</label>
              <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>{t('table.personal_id')} *</label>
              <input 
                type="text" 
                name="personal_id_number" 
                value={formData.personal_id_number} 
                onChange={handleChange} 
                pattern="\d{13}"
                minLength="13"
                maxLength="13"
                title="JMBG must be exactly 13 digits"
                required 
              />
            </div>
          </div>

          <div className="form-row">
            <div className="input-group">
              <label>{t('modal.dob')} *</label>
              <input type="date" name="dob" value={formData.dob} onChange={handleChange} required />
            </div>
            <div className="input-group">
              <label>{t('table.category')} *</label>
              <select name="license_category" value={formData.license_category} onChange={handleChange} required>
                {LICENSE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="input-group full-width">
            <label>{t('modal.address')}</label>
            <input type="text" name="address" value={formData.address} onChange={handleChange} />
          </div>

          <div className="form-row">
            <div className="input-group">
              <label>{t('modal.phone')}</label>
              <input type="tel" name="phone_number" value={formData.phone_number} onChange={handleChange} />
            </div>
            <div className="input-group">
              <label>{t('modal.email')}</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="cancel-btn" onClick={onClose}>{t('global.cancel')}</button>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? t('global.saving') : t('modal.add_candidate')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
