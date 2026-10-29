import React, { useState, useEffect } from 'react';
import { FileText, FileBadge, Download } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import './DocumentCenter.css';

export default function DocumentCenter() {
  const { t } = useLanguage();
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/candidates');
      const data = await res.json();
      if (data.success) {
        setCandidates(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch candidates', err);
      setError(t('docs.fetch_failed'));
    }
  };

  const handleGenerate = (type) => {
    if (!selectedCandidate) {
      setError(t('docs.select_candidate'));
      return;
    }
    window.open(`/print/${type}/${selectedCandidate}`, '_blank');
  };

  return (
    <div className="doc-center-container">
      <div className="header-titles">
        <h1>{t('docs.center_title')}</h1>
        <p>{t('docs.center_desc')}</p>
      </div>

      <div className="doc-content">
        <div className="candidate-selector-card">
          <label className="selector-label">{t('docs.select_candidate')}</label>
          <select 
            className="candidate-dropdown" 
            value={selectedCandidate} 
            onChange={(e) => {
              setSelectedCandidate(e.target.value);
              setError('');
            }}
          >
            <option value="">-- {t('docs.select_candidate')} --</option>
            {candidates.map(c => (
              <option key={c.id} value={c.id}>
                {c.full_name} ({c.personal_id_number})
              </option>
            ))}
          </select>
          {error && <div className="text-red mt-2">{error}</div>}
        </div>

        <div className="doc-types-grid">
          {/* Prilog 3 Card */}
          <div className={`doc-card ${!selectedCandidate ? 'disabled' : ''}`}>
            <div className="doc-icon-container">
              <FileText className="text-icon-muted" size={32} />
            </div>
            <h3>Prilog br. 3</h3>
            <p>Potvrda o uspješno završenom osposobljavanju iz propisa o sigurnosti saobraćaja.</p>
            <button 
              className="generate-btn btn-primary"
              disabled={!selectedCandidate}
              onClick={() => handleGenerate('prilog3')}
            >
              <FileText size={18} />
              <span>Generate Prilog 3</span>
            </button>
          </div>

          {/* Prilog 4 Card */}
          <div className={`doc-card ${!selectedCandidate ? 'disabled' : ''}`}>
            <div className="doc-icon-container">
              <FileText className="text-icon-muted" size={32} />
            </div>
            <h3>Prilog br. 4</h3>
            <p>Potvrda o uspješno završenom osposobljavanju iz upravljanja motornim vozilom.</p>
            <button 
              className="generate-btn btn-primary"
              disabled={!selectedCandidate}
              onClick={() => handleGenerate('prilog4')}
            >
              <FileText size={18} />
              <span>Generate Prilog 4</span>
            </button>
          </div>

          {/* Prilog 5 Card */}
          <div className={`doc-card ${!selectedCandidate ? 'disabled' : ''}`}>
            <div className="doc-icon-container">
              <FileText className="text-icon-muted" size={32} />
            </div>
            <h3>Prilog br. 5</h3>
            <p>Potvrda o završenom dodatnom osposobljavanju iz upravljanja motornim vozilom.</p>
            <button 
              className="generate-btn btn-primary"
              disabled={!selectedCandidate}
              onClick={() => handleGenerate('prilog5')}
            >
              <FileText size={18} />
              <span>Generate Prilog 5</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
