import React, { useState, useEffect } from 'react';
import { Banknote } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import './PaymentRegistry.css';

export default function PaymentRegistry() {
  const { t, currencySymbol } = useLanguage();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/quattrodrive/payments');
      const data = await res.json();
      if (data.success) {
        setPayments(data.data);
      } else {
        setError('Failed to load payments');
      }
    } catch (err) {
      setError('Error connecting to backend');
    } finally {
      setLoading(false);
    }
  };

  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="payment-registry">
      <div className="header-titles">
        <h1>{t('payments.ledger_title')}</h1>
        <p>{t('payments.ledger_desc')}</p>
      </div>

      <div className="revenue-card">
        <div className="revenue-icon">
          <Banknote size={24} />
        </div>
        <div className="revenue-details">
          <h3>{t('payments.total_revenue')}</h3>
          <p className="revenue-amount">{totalRevenue.toFixed(2)} {currencySymbol}</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="table-wrapper mt-4">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('table.date')}</th>
              <th>{t('table.fullname')}</th>
              <th>{t('table.personal_id')}</th>
              <th>{t('table.method')}</th>
              <th>{t('table.amount')}</th>
              <th>{t('table.notes')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="table-loading">{t('global.loading')}</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan="6" className="table-empty">No payments recorded yet.</td></tr>
            ) : (
              payments.map(payment => (
                <tr key={payment.id}>
                  <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                  <td className="font-medium">{payment.candidate_name}</td>
                  <td className="text-muted">{payment.personal_id_number}</td>
                  <td>
                    <span className={`method-badge method-${payment.payment_method.toLowerCase()}`}>
                      {payment.payment_method}
                    </span>
                  </td>
                  <td className="font-medium text-green">{payment.amount.toFixed(2)} {currencySymbol}</td>
                  <td className="text-muted text-sm">{payment.notes || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
