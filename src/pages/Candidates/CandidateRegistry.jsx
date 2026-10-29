import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Filter } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import AddCandidateModal from '../../components/AddCandidateModal/AddCandidateModal';
import './CandidateRegistry.css';

export default function CandidateRegistry() {
  const { t } = useLanguage();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:3001/api/candidates');
      const data = await res.json();
      if (data.success) {
        setCandidates(data.data);
      } else {
        setError('Failed to load candidates');
      }
    } catch (err) {
      setError('Error connecting to backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleAddCandidate = (newCandidate) => {
    setCandidates([newCandidate, ...candidates]);
  };

  const filteredCandidates = candidates.filter(candidate => {
    const matchesSearch = 
      candidate.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidate.personal_id_number.includes(searchQuery);
    
    const matchesCategory = filterCategory === 'All' || candidate.license_category === filterCategory;
    
    // Status in DB is English, so we filter by the English status
    const matchesStatus = filterStatus === 'All' || candidate.status === filterStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="registry-container">
      <div className="registry-header">
        <div className="header-titles">
          <h1>{t('registry.title')}</h1>
          <p>{t('registry.desc')}</p>
        </div>
        <button className="primary-btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={20} />
          <span>{t('registry.add_btn')}</span>
        </button>
      </div>

      <div className="controls-bar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder={t('registry.search_ph')} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filters">
          <div className="filter-group">
            <Filter size={16} className="filter-icon" />
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="All">{t('registry.filter_all_cat')}</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
          </div>
          <div className="filter-group">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="All">{t('registry.filter_all_status')}</option>
              <option value="In Progress">{t('status.inprogress')}</option>
              <option value="Completed">{t('status.completed')}</option>
              <option value="On Hold">{t('status.onhold')}</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('table.fullname')}</th>
              <th>{t('table.personal_id')}</th>
              <th>{t('table.category')}</th>
              <th>{t('table.status')}</th>
              <th>{t('table.registered')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="table-loading">{t('global.loading')}</td></tr>
            ) : filteredCandidates.length === 0 ? (
              <tr><td colSpan="5" className="table-empty">No candidates found matching criteria.</td></tr>
            ) : (
              filteredCandidates.map(candidate => (
                <tr key={candidate.id} onClick={() => navigate(`/candidates/${candidate.id}`)}>
                  <td className="font-medium">{candidate.full_name}</td>
                  <td className="text-muted">{candidate.personal_id_number}</td>
                  <td>
                    <span className="category-badge">{candidate.license_category}</span>
                  </td>
                  <td>
                    <span className={`status-badge status-${candidate.status.replace(' ', '').toLowerCase()}`}>
                      {t(`status.${candidate.status.replace(' ', '').toLowerCase()}`)}
                    </span>
                  </td>
                  <td className="text-muted">{new Date(candidate.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddCandidateModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onCandidateAdded={handleAddCandidate}
      />
    </div>
  );
}
