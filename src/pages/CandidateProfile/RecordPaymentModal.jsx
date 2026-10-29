import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import '../../components/AddCandidateModal/AddCandidateModal.css';

export default function RecordPaymentModal({ isOpen, onClose, candidateId, onPaymentRecorded }) {
  const { t, currencySymbol } = useLanguage();
  const [formData, setFormData] = useState({
    candidate_id: candidateId,
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Cash',
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
      const response = await fetch('http://localhost:3001/api/quattrodrive/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount)
        })
      });
      
      const data = await response.json();

      if (data.success) {
        onPaymentRecorded();
        setFormData({ ...formData, amount: '', notes: '' }); 
        onClose();
      } else {
        setError(data.message || 'Failed to record payment');
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
          <h2>{t('modal.record_payment')}</h2>
          <button className="close-btn" onClick={onClose}><X size={24} /></button>
        </div>
        
        {error && <div className="modal-error">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="input-group full-width">
            <label>{t('modal.amount')} ({currencySymbol}) *</label>
            <input 
              type="number" 
              name="amount" 
              value={formData.amount} 
              onChange={handleChange} 
              min="0.01" 
              step="0.01" 
              required 
            />
          </div>

          <div className="input-group full-width">
            <label>{t('modal.payment_date')} *</label>
            <input 
              type="date" 
              name="payment_date" 
              value={formData.payment_date} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div className="input-group full-width">
            <label>{t('modal.payment_method')} *</label>
            <select name="payment_method" value={formData.payment_method} onChange={handleChange} required>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
            </select>
          </div>

          <div className="input-group full-width">
            <label>{t('table.notes')}</label>
            <input type="text" name="notes" value={formData.notes} onChange={handleChange} />
          </div>

          <div className="modal-footer">
            <button type="button" className="cancel-btn" onClick={onClose}>{t('global.cancel')}</button>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? t('global.saving') : t('modal.record_payment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
