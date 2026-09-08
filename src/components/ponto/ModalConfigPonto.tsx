// src/components/ponto/ModalConfigPonto.tsx
import { useState } from 'react';
import { X, Save, MapPin, Map } from 'lucide-react';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import Button from '../ui/Button';
import Input from '../ui/Input';

interface Props {
  aberto: boolean;
  onClose: () => void;
  configEdit: any;
  setConfigEdit: (val: any) => void;
  salvarConfiguracao: () => void;
  isMobile: boolean;
}

// 🗺️ INTEGRAÇÃO GOOGLE MAPS: Configuração padrão de visualização inicial do mapa (Centro de São Paulo)
const centroPadrao = { lat: -23.5505, lng: -46.6333 };
const mapContainerStyle = { width: '100%', height: '300px', borderRadius: '12px', marginTop: '10px' };

export default function ModalConfigPonto({ aberto, onClose, configEdit, setConfigEdit, salvarConfiguracao, isMobile }: Props) {
  // 🗺️ INTEGRAÇÃO GOOGLE MAPS: Carregamento do script oficial (Cole sua API KEY aqui)
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: "SUA_API_KEY_DO_GOOGLE_AQUI" 
  });

  // Estado para controlar qual galpão estamos escolhendo no mapa no momento
  const [selecionandoMapa, setSelecionandoMapa] = useState<'local1' | 'local2' | null>(null);

  if (!aberto) return null;

  // Função disparada quando você clica em cima de uma rua ou prédio no mapa
  const lidarComCliqueNoMapa = (evento: any) => {
    const lat = evento.latLng.lat().toFixed(6);
    const lng = evento.latLng.lng().toFixed(6);

    if (selecionandoMapa === 'local1') {
      setConfigEdit({ ...configEdit, latOficial: lat, lngOficial: lng });
    } else if (selecionandoMapa === 'local2') {
      setConfigEdit({ ...configEdit, latOficial2: lat, lngOficial2: lng });
    }
    
    // Fecha o mapa após a escolha
    setSelecionandoMapa(null);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', padding: '15px' }}>
      <div style={{ backgroundColor: 'white', width: '100%', maxWidth: '550px', borderRadius: '24px', padding: isMobile ? '24px' : '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '20px', marginBottom: '25px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: '20px', fontWeight: '800' }}>Configurações Globais</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Edite as regras do ponto para toda a empresa.</p>
          </div>
          <button onClick={onClose} style={{ background: '#f8fafc', border: 'none', cursor: 'pointer', padding: '10px', borderRadius: '50%' }}><X size={20} color="#64748b" /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <Input type="time" label="Hora de Entrada" value={configEdit.entrada || ''} onChange={e => setConfigEdit({...configEdit, entrada: e.target.value})} />
          <Input type="time" label="Saída Almoço" value={configEdit.saidaAlmoco || ''} onChange={e => setConfigEdit({...configEdit, saidaAlmoco: e.target.value})} />
          <Input type="time" label="Retorno Almoço" value={configEdit.retornoAlmoco || ''} onChange={e => setConfigEdit({...configEdit, retornoAlmoco: e.target.value})} />
          <Input type="time" label="Saída Fim" value={configEdit.saidaFim || ''} onChange={e => setConfigEdit({...configEdit, saidaFim: e.target.value})} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div style={{ backgroundColor: '#fffbeb', padding: '10px', borderRadius: '12px', border: '1px solid #fde68a' }}>
            <Input type="time" label="Limite para Atraso" value={configEdit.limiteAtraso || ''} onChange={e => setConfigEdit({...configEdit, limiteAtraso: e.target.value})} />
          </div>
          <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
            <Input type="time" label="Carga Horária" value={configEdit.cargaHoraria || ''} onChange={e => setConfigEdit({...configEdit, cargaHoraria: e.target.value})} />
          </div>
        </div>

        {/* 🗺️ MÓDULO DE CERCA VIRTUAL INTERATIVO */}
        <div style={{ backgroundColor: '#eff6ff', padding: '15px', borderRadius: '12px', border: '1px solid #bfdbfe', marginBottom: '30px' }}>
          <h4 style={{ margin: '0 0 15px 0', fontSize: '14px', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={16} /> Locais Permitidos (Geocerca)
          </h4>
          
          {/* GALPÃO 1 */}
          <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{fontSize: '12px', color: '#3b82f6'}}>📌 Galpão Principal (Local 1)</strong>
              <Button type="button" onClick={() => setSelecionandoMapa('local1')} style={{ padding: '6px 12px', fontSize: '11px', height: 'auto', backgroundColor: '#e0e7ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}>
                <Map size={12} style={{marginRight: '4px'}}/> Buscar no Mapa
              </Button>
            </div>
            
            {selecionandoMapa === 'local1' && isLoaded ? (
              <div style={{ marginBottom: '15px' }}>
                <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: '#ef4444', fontWeight: 'bold' }}>Toque no local desejado no mapa abaixo:</p>
                <GoogleMap mapContainerStyle={mapContainerStyle} zoom={13} center={centroPadrao} onClick={lidarComCliqueNoMapa}>
                  {configEdit.latOficial && configEdit.lngOficial && (
                    <Marker position={{ lat: Number(configEdit.latOficial), lng: Number(configEdit.lngOficial) }} />
                  )}
                </GoogleMap>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Input label="Latitude 1" value={configEdit.latOficial || ''} onChange={e => setConfigEdit({...configEdit, latOficial: e.target.value})} placeholder="Ex: -23.5489" />
                <Input label="Longitude 1" value={configEdit.lngOficial || ''} onChange={e => setConfigEdit({...configEdit, lngOficial: e.target.value})} placeholder="Ex: -46.6166" />
              </div>
            )}
          </div>

          {/* GALPÃO 2 */}
          <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{fontSize: '12px', color: '#3b82f6'}}>📌 Galpão Secundário (Local 2)</strong>
              <Button type="button" onClick={() => setSelecionandoMapa('local2')} style={{ padding: '6px 12px', fontSize: '11px', height: 'auto', backgroundColor: '#e0e7ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}>
                <Map size={12} style={{marginRight: '4px'}}/> Buscar no Mapa
              </Button>
            </div>
            
            {selecionandoMapa === 'local2' && isLoaded ? (
              <div style={{ marginBottom: '15px' }}>
                <p style={{ margin: '0 0 5px 0', fontSize: '11px', color: '#ef4444', fontWeight: 'bold' }}>Toque no local desejado no mapa abaixo:</p>
                <GoogleMap mapContainerStyle={mapContainerStyle} zoom={13} center={centroPadrao} onClick={lidarComCliqueNoMapa}>
                  {configEdit.latOficial2 && configEdit.lngOficial2 && (
                    <Marker position={{ lat: Number(configEdit.latOficial2), lng: Number(configEdit.lngOficial2) }} />
                  )}
                </GoogleMap>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Input label="Latitude 2" value={configEdit.latOficial2 || ''} onChange={e => setConfigEdit({...configEdit, latOficial2: e.target.value})} placeholder="Ex: -23.5500" />
                <Input label="Longitude 2" value={configEdit.lngOficial2 || ''} onChange={e => setConfigEdit({...configEdit, lngOficial2: e.target.value})} placeholder="Ex: -46.6200" />
              </div>
            )}
          </div>

          <Input label="Raio Permitido (Metros)" type="number" value={configEdit.raioMetros || '50'} onChange={e => setConfigEdit({...configEdit, raioMetros: e.target.value})} />
        </div>

        <Button onClick={salvarConfiguracao} style={{ width: '100%', height: '56px', fontSize: '16px', backgroundColor: '#0f172a', display: 'flex', justifyContent: 'center', gap: '10px', borderRadius: '14px', fontWeight: 'bold' }}>
          <Save size={20} /> Salvar Regras
        </Button>
      </div>
    </div>
  );
}