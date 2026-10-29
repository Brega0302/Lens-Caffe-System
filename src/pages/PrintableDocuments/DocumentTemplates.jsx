import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './DocumentTemplates.css';

const AutoFillText = ({ value, label, minWidth = '100px' }) => (
  <span className="fillable-field" style={{ minWidth }}>
    <span className="field-value">{value || ''}</span>
    {label && <span className="field-label">{label}</span>}
  </span>
);

export const Prilog3 = () => {
  const { id } = useParams();
  const [candidate, setCandidate] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:3001/api/candidates/${id}`)
      .then(res => res.json())
      .then(data => {
        if(data.success) {
          setCandidate(data.data);
          setTimeout(() => window.print(), 500);
        }
      });
  }, [id]);

  if (!candidate) return <div className="loading-print">Loading...</div>;

  const dob = candidate.dob ? new Date(candidate.dob).toLocaleDateString('bs-BA') : '';
  const currentDate = new Date().toLocaleDateString('bs-BA');

  const TemplateContent = () => (
    <div className="doc-template">
      <div className="doc-header">
        <div className="header-left">
          <div className="header-row"><span>Naziv autoškole:</span><AutoFillText value="AS Quattro" minWidth="200px" /></div>
          <div className="header-row"><span>Opština:</span><AutoFillText value="_______________" minWidth="200px" /></div>
          <div className="header-row"><span>Broj:</span><AutoFillText value="_______________" minWidth="200px" /></div>
          <div className="header-row"><span>Datum:</span><AutoFillText value={currentDate} minWidth="200px" /></div>
        </div>
        <div className="header-right text-right">
          <div className="font-bold text-lg mb-2">Prilog br. 3.</div>
          <div className="mb-4">Serijski broj T 00000001</div>
          <div className="header-row justify-end"><span>Predavač:</span><AutoFillText value="_______________" minWidth="200px" /></div>
          <div className="header-row justify-end mt-1"><span>Period trajanja osposobljavanja:</span></div>
          <div className="header-row justify-end"><AutoFillText value="_______________" minWidth="250px" label="(datum od – datum do)" /></div>
        </div>
      </div>

      <div className="doc-title text-center my-6">
        <div className="font-bold text-xl uppercase">POTVRDA</div>
        <div className="font-bold text-md">o uspješno završenom osposobljavanju iz propisa o<br/>sigurnosti saobraćaja na cestama</div>
      </div>

      <div className="doc-body text-justify leading-relaxed">
        <AutoFillText value={candidate.full_name} minWidth="300px" label="(ime i prezime)" />
        {' '}kandidat/kinja za vozača motornog vozila kategorije/
        <br/>potkategorije{' '}
        <AutoFillText value={candidate.license_category} minWidth="100px" />
        {' '}rođen/a{' '}
        <AutoFillText value={dob} minWidth="120px" />
        {' '}godine, sa prebivalištem u{' '}
        <AutoFillText value={candidate.address} minWidth="250px" />,
        <br/>
        osposobljavao/la se u ovoj autoškoli u trajanju od <AutoFillText minWidth="50px" /> nastavnih časova i uspješno završio/la obuku
        <br/>
        iz propisa o sigurnosti saobraćaja na cestama za kategoriju/potkategoriju:{' '}
        <AutoFillText value={candidate.license_category} minWidth="100px" />.
        
        <p className="mt-4">
          Ova potvrda se izdaje u svrhu polaganja ispita za vozača iz propisa o sigurnosti saobraćaja na cestama.
        </p>
      </div>

      <div className="doc-footer mt-8 flex justify-between items-end">
        <div className="footer-left text-center">
          <div className="mt-8">M.P.</div>
        </div>
        <div className="footer-right text-center">
          <div>Potpis odgovornog lica</div>
          <div>u autoškoli</div>
          <div className="border-b border-black w-48 mt-8 mx-auto"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="print-page">
      <TemplateContent />
      <div className="cut-line"></div>
      <TemplateContent />
    </div>
  );
};

export const Prilog4 = () => {
  const { id } = useParams();
  const [candidate, setCandidate] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:3001/api/candidates/${id}`)
      .then(res => res.json())
      .then(data => {
        if(data.success) {
          setCandidate(data.data);
          setTimeout(() => window.print(), 500);
        }
      });
  }, [id]);

  if (!candidate) return <div className="loading-print">Loading...</div>;

  const dob = candidate.dob ? new Date(candidate.dob).toLocaleDateString('bs-BA') : '';
  const currentDate = new Date().toLocaleDateString('bs-BA');

  const TemplateContent = () => (
    <div className="doc-template">
      <div className="doc-header">
        <div className="header-left">
          <div className="header-row"><span>Naziv autoškole:</span><AutoFillText value="AS Quattro" minWidth="200px" /></div>
          <div className="header-row"><span>Opština:</span><AutoFillText value="_______________" minWidth="200px" /></div>
          <div className="header-row"><span>Broj:</span><AutoFillText value="_______________" minWidth="200px" /></div>
          <div className="header-row"><span>Datum:</span><AutoFillText value={currentDate} minWidth="200px" /></div>
        </div>
        <div className="header-right text-right">
          <div className="font-bold text-lg mb-2">Prilog br. 4.</div>
          <div className="mb-4">Serijski broj U 00000001</div>
          <div className="header-row justify-end"><span>Instruktor vožnje:</span><AutoFillText value="_______________" minWidth="200px" /></div>
          <div className="header-row justify-end mt-1"><span>Period trajanja osposobljavanja:</span></div>
          <div className="header-row justify-end"><AutoFillText value="_______________" minWidth="250px" label="(datum od – datum do)" /></div>
          <div className="header-row justify-end mt-2"><span>Broj pređenih kilometara:</span></div>
          <div className="header-row justify-end"><AutoFillText value="_______________" minWidth="200px" /></div>
        </div>
      </div>

      <div className="doc-title text-center my-4">
        <div className="font-bold text-xl uppercase">POTVRDA</div>
        <div className="font-bold text-md">o uspješno završenom osposobljavanju iz upravljanja<br/>motornim vozilom</div>
      </div>

      <div className="doc-body text-justify leading-relaxed text-sm">
        <AutoFillText value={candidate.full_name} minWidth="250px" label="(ime i prezime)" />
        {' '}kandidat/kinja za vozača motornog vozila kategorije/
        <br/>potkategorije{' '}
        <AutoFillText value={candidate.license_category} minWidth="80px" />
        {' '}rođen/a{' '}
        <AutoFillText value={dob} minWidth="100px" />
        {' '}godine, sa prebivalištem u{' '}
        <AutoFillText value={candidate.address} minWidth="200px" />,
        osposobljavao/la se u ovoj autoškoli u trajanju od <AutoFillText minWidth="50px" /> nastavnih časova i uspješno završio/la
        obuku iz upravljanja motornim vozilom. Kandidat/kinja se osposobljavao/la na motornom vozilu sa
        ručnim/automatskim mjenjačem (zaokružiti).
        <br/>
        Kandidat/kinja je prethodno položio/la ispit iz propisa o sigurnosti saobraćaja na cestama, o čemu
        mu/joj je nadležno tijelo <AutoFillText minWidth="150px" /> izdalo uvjerenje broj <AutoFillText minWidth="100px" /> od __/__/20__.
        godine, i ispit iz pružanja prve pomoći, o čemu mu/joj je nadležno tijelo <AutoFillText minWidth="150px" /> izdalo
        uvjerenje broj <AutoFillText minWidth="100px" /> od __/__/20__. godine.
        
        <p className="mt-3">
          Ova potvrda se izdaje radi polaganja ispita iz upravljanja motornim vozilom.
        </p>
      </div>

      <div className="doc-footer mt-6 flex justify-between items-end">
        <div className="footer-left text-center">
          <div className="mt-8">M.P.</div>
        </div>
        <div className="footer-right text-center">
          <div>Potpis odgovornog lica</div>
          <div>u autoškoli</div>
          <div className="border-b border-black w-48 mt-6 mx-auto"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="print-page">
      <TemplateContent />
      <div className="cut-line"></div>
      <TemplateContent />
    </div>
  );
};

export const Prilog5 = () => {
  const { id } = useParams();
  const [candidate, setCandidate] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:3001/api/candidates/${id}`)
      .then(res => res.json())
      .then(data => {
        if(data.success) {
          setCandidate(data.data);
          setTimeout(() => window.print(), 500);
        }
      });
  }, [id]);

  if (!candidate) return <div className="loading-print">Loading...</div>;

  const dob = candidate.dob ? new Date(candidate.dob).toLocaleDateString('bs-BA') : '';
  const currentDate = new Date().toLocaleDateString('bs-BA');

  const TemplateContent = () => (
    <div className="doc-template">
      <div className="doc-header">
        <div className="header-left">
          <div className="header-row"><span>Naziv autoškole:</span><AutoFillText value="AS Quattro" minWidth="200px" /></div>
          <div className="header-row"><span>Opština:</span><AutoFillText value="_______________" minWidth="200px" /></div>
          <div className="header-row"><span>Broj:</span><AutoFillText value="_______________" minWidth="200px" /></div>
          <div className="header-row"><span>Datum:</span><AutoFillText value={currentDate} minWidth="200px" /></div>
        </div>
        <div className="header-right text-right">
          <div className="font-bold text-lg mb-2">Prilog br. 5.</div>
          <div className="mb-4">Serijski broj D 00000001</div>
          <div className="header-row justify-end"><span>Instruktor vožnje:</span><AutoFillText value="_______________" minWidth="200px" /></div>
          <div className="header-row justify-end mt-1"><span>Period trajanja osposobljavanja:</span></div>
          <div className="header-row justify-end"><AutoFillText value="_______________" minWidth="250px" label="(datum od – datum do)" /></div>
        </div>
      </div>

      <div className="doc-title text-center my-6">
        <div className="font-bold text-xl uppercase">POTVRDA</div>
        <div className="font-bold text-md">o završenom dodatnom osposobljavanju iz upravljanja<br/>motornim vozilom</div>
      </div>

      <div className="doc-body text-justify leading-relaxed">
        <AutoFillText value={candidate.full_name} minWidth="300px" label="(ime i prezime)" />
        {' '}kandidat/kinja za vozača motornog vozila kategorije/
        <br/>potkategorije{' '}
        <AutoFillText value={candidate.license_category} minWidth="100px" />
        {' '}rođen/a{' '}
        <AutoFillText value={dob} minWidth="120px" />
        {' '}godine, sa prebivalištem u{' '}
        <AutoFillText value={candidate.address} minWidth="250px" />,
        <br/>
        osposobljavao/la se u ovoj autoškoli u trajanju od <AutoFillText minWidth="50px" /> dodatnih nastavnih časova.
        
        <p className="mt-6">
          Ova potvrda se izdaje radi polaganja ispita iz upravljanja motornim vozilom.
        </p>
      </div>

      <div className="doc-footer mt-10 flex justify-between items-end">
        <div className="footer-left text-center">
          <div className="mt-8">M.P.</div>
        </div>
        <div className="footer-right text-center">
          <div>Potpis odgovornog lica</div>
          <div>u autoškoli</div>
          <div className="border-b border-black w-48 mt-8 mx-auto"></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="print-page">
      <TemplateContent />
      <div className="cut-line"></div>
      <TemplateContent />
    </div>
  );
};
