import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Camera, Check, ChevronRight,
  Copy, Download, ExternalLink, FileText, Heart, Pencil, Phone, Pill, Plus,
  Search, Shield, Star, Trash2, Upload, X,
} from 'lucide-react';
import { useActiveProfile } from '@/context/ActiveProfileContext';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Loading } from '@/components/feedback/Loading';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { DocumentUploadForm } from '@/components/documents/DocumentUploadForm';
import { DocumentEditForm } from '@/components/documents/DocumentEditForm';
import { useDocuments } from '@/hooks/useDocuments';
import { createShare, shareUrl } from '@/lib/sharing';
import { CATEGORY_LABELS, deleteDocument, formatFileSize, getSignedUrl, PRIMARY_CATEGORIES } from '@/lib/documents';
import { longDate } from '@/lib/health';
import type { DocumentCategory, MedicalDocument } from '@/types';

// ─── Emergency Info (static demo — in production stored in user profile) ─────
const EMERGENCY_INFO = {
  bloodType: 'B+',
  allergies: ['Penicillin', 'Sulfa drugs', 'Peanuts'],
  conditions: ['Type 2 Diabetes (since 2019)', 'Hypertension (controlled)'],
  currentMeds: ['Metformin 500mg (twice daily)', 'Amlodipine 5mg (once daily)', 'Aspirin 100mg (once daily)'],
  emergencyContact: { name: 'Shirpi (Partner)', phone: '+65 9123 4567', relation: 'Partner' },
  doctor: { name: 'Dr. Priya Nair', phone: '+65 6234 5678', clinic: 'SGH Diabetes Clinic' },
};

type Tab = 'records' | 'add' | 'emergency';

// ─── Emergency full-screen overlay ───────────────────────────────────────────
function EmergencyScreen({ onClose, pinnedDocs }: { onClose: () => void; pinnedDocs: MedicalDocument[] }) {
  const [copied, setCopied] = useState(false);
  const info = EMERGENCY_INFO;

  const text = `
EMERGENCY MEDICAL INFORMATION
================================
Patient: Babu (Krishnan Babu)
Blood Type: ${info.bloodType}
DOB: 12 April 1985

ALLERGIES
${info.allergies.map(a=>`• ${a}`).join('\n')}

CURRENT MEDICATIONS
${info.currentMeds.map(m=>`• ${m}`).join('\n')}

CHRONIC CONDITIONS
${info.conditions.map(c=>`• ${c}`).join('\n')}

EMERGENCY CONTACT
${info.emergencyContact.name}: ${info.emergencyContact.phone}

DOCTOR
${info.doctor.name} — ${info.doctor.clinic}: ${info.doctor.phone}
  `.trim();

  return (
    <div style={{ position:'fixed',inset:0,zIndex:9999,background:'#0a0a0a',overflowY:'auto',padding:0 }}>
      {/* Red header bar */}
      <div style={{ background:'linear-gradient(135deg,#dc2626,#991b1b)',padding:'16px 20px',position:'sticky',top:0,zIndex:10 }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',maxWidth:640,margin:'0 auto' }}>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <div style={{ width:40,height:40,borderRadius:'50%',background:'rgba(255,255,255,.2)',display:'flex',alignItems:'center',justifyContent:'center' }}>
              <Shield style={{ width:20,height:20,color:'#fff' }}/>
            </div>
            <div>
              <p style={{ fontSize:18,fontWeight:800,color:'#fff',letterSpacing:'-.02em' }}>Emergency Medical Info</p>
              <p style={{ fontSize:11,color:'rgba(255,255,255,.7)',marginTop:1 }}>Show this screen to paramedics or ER staff</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color:'rgba(255,255,255,.7)',background:'rgba(255,255,255,.15)',border:'none',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:12,fontWeight:600 }}>Close</button>
        </div>
      </div>

      <div style={{ maxWidth:640,margin:'0 auto',padding:'20px 20px 40px' }}>

        {/* Copy button */}
        <button onClick={()=>{ navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
          style={{ display:'flex',alignItems:'center',gap:8,width:'100%',padding:'12px 16px',borderRadius:12,marginBottom:16,border:'1px solid rgba(239,68,68,.4)',background:'rgba(239,68,68,.1)',color:'#fca5a5',cursor:'pointer',fontSize:13,fontWeight:600,justifyContent:'center' }}>
          {copied?<><Check style={{ width:16,height:16 }}/>Copied to clipboard!</>:<><Copy style={{ width:16,height:16 }}/>Copy all info to clipboard</>}
        </button>

        {/* Blood type — largest element */}
        <div style={{ background:'#1a0000',border:'2px solid #dc2626',borderRadius:20,padding:'20px 24px',marginBottom:16,textAlign:'center' }}>
          <p style={{ fontSize:11,fontWeight:700,color:'#fca5a5',letterSpacing:'.12em',textTransform:'uppercase' }}>Blood Type</p>
          <p style={{ fontSize:72,fontWeight:900,color:'#ef4444',lineHeight:1,marginTop:4,letterSpacing:'-.04em' }}>{info.bloodType}</p>
        </div>

        {/* Info blocks */}
        {[
          { icon:<AlertTriangle style={{ width:18,height:18,color:'#fbbf24' }}/>, label:'Allergies', bg:'rgba(251,191,36,.08)', border:'rgba(251,191,36,.3)', items:info.allergies, itemColor:'#fbbf24' },
          { icon:<Pill style={{ width:18,height:18,color:'#60a5fa' }}/>, label:'Current medications', bg:'rgba(96,165,250,.08)', border:'rgba(96,165,250,.3)', items:info.currentMeds, itemColor:'#93c5fd' },
          { icon:<Heart style={{ width:18,height:18,color:'#f87171' }}/>, label:'Chronic conditions', bg:'rgba(248,113,113,.08)', border:'rgba(248,113,113,.3)', items:info.conditions, itemColor:'#fca5a5' },
        ].map(block=>(
          <div key={block.label} style={{ background:block.bg,border:`1px solid ${block.border}`,borderRadius:16,padding:'16px 18px',marginBottom:12 }}>
            <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10 }}>
              {block.icon}
              <p style={{ fontSize:12,fontWeight:700,color:'rgba(255,255,255,.5)',letterSpacing:'.08em',textTransform:'uppercase' }}>{block.label}</p>
            </div>
            {block.items.map((item,i)=>(
              <div key={i} style={{ display:'flex',alignItems:'flex-start',gap:8,marginBottom:i<block.items.length-1?8:0 }}>
                <span style={{ marginTop:5,width:6,height:6,borderRadius:'50%',background:block.itemColor,flexShrink:0 }}/>
                <p style={{ fontSize:16,fontWeight:600,color:'#fff',lineHeight:1.3 }}>{item}</p>
              </div>
            ))}
          </div>
        ))}

        {/* Emergency contact + doctor side by side */}
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12 }}>
          {[
            { label:'Emergency contact', name:info.emergencyContact.name, sub:info.emergencyContact.relation, phone:info.emergencyContact.phone, color:'#34d399', bg:'rgba(52,211,153,.08)', border:'rgba(52,211,153,.3)' },
            { label:'Treating doctor', name:info.doctor.name, sub:info.doctor.clinic, phone:info.doctor.phone, color:'#60a5fa', bg:'rgba(96,165,250,.08)', border:'rgba(96,165,250,.3)' },
          ].map(c=>(
            <div key={c.label} style={{ background:c.bg,border:`1px solid ${c.border}`,borderRadius:16,padding:'14px' }}>
              <p style={{ fontSize:10,fontWeight:700,color:'rgba(255,255,255,.4)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:8 }}>{c.label}</p>
              <p style={{ fontSize:14,fontWeight:700,color:'#fff' }}>{c.name}</p>
              <p style={{ fontSize:11,color:'rgba(255,255,255,.5)',marginTop:2,marginBottom:10 }}>{c.sub}</p>
              <a href={`tel:${c.phone}`} style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 10px',borderRadius:8,background:c.color,color:'#000',textDecoration:'none',fontSize:13,fontWeight:800,justifyContent:'center' }}>
                <Phone style={{ width:14,height:14 }}/>{c.phone}
              </a>
            </div>
          ))}
        </div>

        {/* Pinned documents */}
        {pinnedDocs.length > 0 && (
          <div style={{ background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:16,padding:'14px 16px' }}>
            <p style={{ fontSize:11,fontWeight:700,color:'rgba(255,255,255,.4)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:10 }}>Pinned documents</p>
            {pinnedDocs.map(d=>(
              <div key={d.id} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,.06)' }}>
                <FileText style={{ width:16,height:16,color:'rgba(255,255,255,.4)',flexShrink:0 }}/>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13,fontWeight:600,color:'#fff' }}>{d.document_name??d.file_name}</p>
                  <p style={{ fontSize:11,color:'rgba(255,255,255,.4)' }}>{CATEGORY_LABELS[d.category]}{d.document_date?` · ${longDate(d.document_date)}`:''}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize:11,color:'rgba(255,255,255,.3)',textAlign:'center',marginTop:20 }}>
          PulsePath · Emergency Medical Info · Last updated {longDate(new Date().toISOString().slice(0,10))}
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function DocumentsPage() {
  const { activeProfile } = useActiveProfile();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('records');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<DocumentCategory|''>('');
  const [editDoc, setEditDoc] = useState<MedicalDocument|null>(null);
  const [deleteDoc, setDeleteDoc] = useState<MedicalDocument|null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ doc:MedicalDocument; url:string }|null>(null);
  const [shareDoc, setShareDoc] = useState<MedicalDocument|null>(null);
  const [shareAll, setShareAll] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string|null>(null);
  const [actionLoading, setActionLoading] = useState<string|null>(null);
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [showEmergency, setShowEmergency] = useState(false);
  const [shareLink, setShareLink] = useState<string|null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const { documents, loading, error, reload } = useDocuments({ profileId:activeProfile?.id, category:catFilter||undefined });

  const filtered = useMemo(()=>{
    const q = search.toLowerCase();
    if (!q) return documents;
    return documents.filter(d=>(d.document_name??d.file_name).toLowerCase().includes(q)||d.doctor?.toLowerCase().includes(q)||d.hospital_clinic?.toLowerCase().includes(q)||d.notes?.toLowerCase().includes(q));
  }, [documents, search]);

  const pinnedDocs = useMemo(()=>documents.filter(d=>pinned.has(d.id)),[documents,pinned]);

  const openPreview = useCallback(async(doc:MedicalDocument)=>{
    setActionLoading(doc.id);
    try { const url=await getSignedUrl(doc.file_path); setPreviewDoc({ doc, url }); }
    catch(e) { alert(e instanceof Error?e.message:'Could not open preview.'); }
    finally { setActionLoading(null); }
  },[]);

  const handleDownload = useCallback(async(doc:MedicalDocument)=>{
    setActionLoading(doc.id+'-dl');
    try { const url=await getSignedUrl(doc.file_path); const a=document.createElement('a'); a.href=url; a.download=doc.file_name; a.rel='noopener'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
    catch(e) { alert(e instanceof Error?e.message:'Could not download.'); }
    finally { setActionLoading(null); }
  },[]);

  async function handleDelete(doc:MedicalDocument) {
    setDeleting(true); setDeleteErr(null);
    try { await deleteDocument(doc); setDeleteDoc(null); await reload(); }
    catch(e) { setDeleteErr(e instanceof Error?e.message:'Could not delete.'); }
    finally { setDeleting(false); }
  }

  async function handleShare(doc:MedicalDocument|null) {
    if (!activeProfile||!shareEmail) return;
    setSharing(true);
    try {
      const s = await createShare({ profile_id:activeProfile.id, shared_with_email:shareEmail, resource_type:'documents', label:doc?doc.document_name??doc.file_name:'All Health Vault documents', expires_at:null, document_ids:doc?[doc.id]:undefined });
      setShareLink(shareUrl(s.share_token));
    } catch(e) { alert(e instanceof Error?e.message:'Could not create share link.'); }
    finally { setSharing(false); }
  }

  if (!activeProfile || !user) return <Loading label="Loading"/>;

  const tabs: Array<{ id:Tab; label:string; icon:React.ReactNode }> = [
    { id:'records',   label:'My Records', icon:<FileText style={{ width:14,height:14 }}/> },
    { id:'add',       label:'Add Record', icon:<Plus style={{ width:14,height:14 }}/> },
    { id:'emergency', label:'Emergency Info', icon:<Shield style={{ width:14,height:14 }}/> },
  ];

  const inputStyle: React.CSSProperties = { width:'100%',padding:'8px 12px',borderRadius:8,fontSize:14,border:'1px solid var(--border)',background:'var(--bg-input)',color:'var(--text-primary)',outline:'none' };

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:18 }}>

      {/* ── Header ── */}
      <div style={{ display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12 }}>
        <div>
          <h2 style={{ fontSize:22,fontWeight:800,color:'var(--text-primary)',letterSpacing:'-.02em' }}>Health Vault</h2>
          <p style={{ fontSize:13,color:'var(--text-secondary)',marginTop:2 }}>Records for {activeProfile.display_name} · Stored privately</p>
        </div>
        {/* Emergency button */}
        <button onClick={()=>setShowEmergency(true)} style={{
          display:'flex',alignItems:'center',gap:8,padding:'10px 16px',borderRadius:12,
          background:'linear-gradient(135deg,#dc2626,#b91c1c)',color:'#fff',
          border:'none',cursor:'pointer',fontSize:13,fontWeight:800,flexShrink:0,
          boxShadow:'0 0 16px rgba(220,38,38,.4)',
        }}>
          <Shield style={{ width:16,height:16 }}/> Emergency
        </button>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display:'flex',gap:4,padding:'4px',borderRadius:14,background:'var(--bg-card)',border:'1px solid var(--border)' }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,
            padding:'9px 12px',borderRadius:10,border:'none',cursor:'pointer',
            background:tab===t.id?'var(--accent-bg)':'transparent',
            color:tab===t.id?'var(--accent)':'var(--text-muted)',
            fontSize:13,fontWeight:tab===t.id?700:500,transition:'all .2s',
          }}>
            {t.icon}{t.label}
            {t.id==='emergency'&&<span style={{ width:6,height:6,borderRadius:'50%',background:'#ef4444',marginLeft:2 }}/>}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: MY RECORDS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab==='records' && (<>
        {/* Search + filter */}
        <div style={{ display:'flex',gap:10 }}>
          <div style={{ position:'relative',flex:1 }}>
            <Search style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',width:15,height:15,color:'var(--text-muted)' }}/>
            <input type="search" placeholder="Search name, doctor, hospital…" value={search} onChange={e=>setSearch(e.target.value)}
              style={{ ...inputStyle,paddingLeft:34,height:40 }}/>
          </div>
          <select value={catFilter} onChange={e=>setCatFilter(e.target.value as DocumentCategory|'')}
            style={{ ...inputStyle,width:'auto',height:40,paddingRight:28 }}>
            <option value="">All categories</option>
            {PRIMARY_CATEGORIES.map(c=><option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>

        {/* Share all */}
        <div style={{ display:'flex',justifyContent:'flex-end' }}>
          <button onClick={()=>{ setShareDoc(null); setShareAll(true); setShareEmail(''); setShareLink(null); }}
            style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 14px',borderRadius:10,border:'1px solid var(--border)',background:'transparent',color:'var(--text-secondary)',fontSize:12,fontWeight:600,cursor:'pointer' }}>
            Share all documents →
          </button>
        </div>

        {/* Document list */}
        {error ? <ErrorState message={error} onRetry={reload}/>
          : loading&&documents.length===0 ? <Loading label="Loading documents"/>
          : filtered.length===0 ? (
            <EmptyState icon={<FileText className="h-6 w-6"/>} title={documents.length===0?'No documents yet':'No matches'}
              description={documents.length===0?'Upload your first lab report, prescription, or scan.':'Try a different search or category.'}
              action={<Button onClick={()=>setTab('add')}><Plus className="h-4 w-4"/>Add first record</Button>}/>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {filtered.map(doc=>{
                const name=doc.document_name??doc.file_name;
                const icon=doc.mime_type==='application/pdf'?'📄':doc.mime_type.startsWith('image/')?'🖼️':'📎';
                const isPinned=pinned.has(doc.id);
                return (
                  <div key={doc.id} style={{ padding:'14px 16px',borderRadius:14,background:'var(--bg-card)',border:`1px solid ${isPinned?'rgba(239,68,68,.4)':'var(--border)'}` }}>
                    <div style={{ display:'flex',alignItems:'flex-start',gap:10 }}>
                      <span style={{ fontSize:24,marginTop:2 }}>{icon}</span>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ display:'flex',alignItems:'center',gap:6,flexWrap:'wrap' }}>
                          <p style={{ fontSize:14,fontWeight:700,color:'var(--text-primary)' }}>{name}</p>
                          <Badge variant="neutral">{CATEGORY_LABELS[doc.category]}</Badge>
                          {isPinned && <span style={{ fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:20,background:'rgba(239,68,68,.15)',color:'#ef4444' }}>📌 Pinned to emergency</span>}
                        </div>
                        <div style={{ display:'flex',flexWrap:'wrap',gap:'2px 14px',marginTop:4,fontSize:11,color:'var(--text-muted)' }}>
                          {doc.document_date&&<span>{longDate(doc.document_date)}</span>}
                          {doc.doctor&&<span>Dr. {doc.doctor}</span>}
                          {doc.hospital_clinic&&<span>{doc.hospital_clinic}</span>}
                          <span>{formatFileSize(doc.file_size)}</span>
                        </div>
                        {doc.notes&&<p style={{ fontSize:11,color:'var(--text-muted)',marginTop:4 }}>{doc.notes}</p>}
                      </div>
                      {/* Actions */}
                      <div style={{ display:'flex',gap:4,flexShrink:0 }}>
                        <Btn label="Preview" loading={actionLoading===doc.id} onClick={()=>openPreview(doc)}><ExternalLink style={{ width:14,height:14 }}/></Btn>
                        <Btn label="Download" loading={actionLoading===doc.id+'-dl'} onClick={()=>handleDownload(doc)}><Download style={{ width:14,height:14 }}/></Btn>
                        <Btn label="Edit" onClick={()=>setEditDoc(doc)}><Pencil style={{ width:14,height:14 }}/></Btn>
                        <Btn label={isPinned?'Unpin from emergency':'Pin to emergency'} onClick={()=>setPinned(p=>{ const n=new Set(p); isPinned?n.delete(doc.id):n.add(doc.id); return n; })}
                          style={{ color:isPinned?'#ef4444':'var(--text-muted)' }}>
                          <Star style={{ width:14,height:14,fill:isPinned?'#ef4444':'none' }}/>
                        </Btn>
                        <Btn label="Share" onClick={()=>{ setShareDoc(doc); setShareAll(false); setShareEmail(''); setShareLink(null); }}><ExternalLink style={{ width:14,height:14,transform:'rotate(-45deg)' }}/></Btn>
                        <Btn label="Delete" danger onClick={()=>{ setDeleteErr(null); setDeleteDoc(doc); }}><Trash2 style={{ width:14,height:14 }}/></Btn>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </>)}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: ADD RECORD
      ══════════════════════════════════════════════════════════════════════ */}
      {tab==='add' && (
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          {/* Two add options */}
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
            <button onClick={()=>photoRef.current?.click()} style={{ padding:'20px 14px',borderRadius:16,border:'2px dashed var(--accent-border)',background:'var(--accent-bg)',cursor:'pointer',textAlign:'center' }}>
              <Camera style={{ width:24,height:24,color:'var(--accent)',margin:'0 auto 8px' }}/>
              <p style={{ fontSize:13,fontWeight:700,color:'var(--accent)' }}>Take photo of document</p>
              <p style={{ fontSize:11,color:'var(--text-muted)',marginTop:4 }}>Use your camera to photograph a lab report, prescription or scan</p>
            </button>
            <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={()=>{ /* handled by upload form */ }}/>
            <button style={{ padding:'20px 14px',borderRadius:16,border:'2px dashed var(--border)',background:'transparent',cursor:'pointer',textAlign:'center' }}>
              <Upload style={{ width:24,height:24,color:'var(--text-muted)',margin:'0 auto 8px' }}/>
              <p style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>Upload from device</p>
              <p style={{ fontSize:11,color:'var(--text-muted)',marginTop:4 }}>PDF, JPEG or PNG · Max 10 MB</p>
            </button>
          </div>
          {/* Full upload form */}
          <div style={{ padding:'16px',borderRadius:16,background:'var(--bg-card)',border:'1px solid var(--border)' }}>
            <DocumentUploadForm userId={user.id} profileId={activeProfile.id}
              onUploaded={async()=>{ await reload(); setTab('records'); }}
              onCancel={()=>setTab('records')}/>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: EMERGENCY INFO
      ══════════════════════════════════════════════════════════════════════ */}
      {tab==='emergency' && (
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          {/* Launch emergency screen */}
          <button onClick={()=>setShowEmergency(true)} style={{
            display:'flex',alignItems:'center',gap:12,padding:'16px 20px',borderRadius:16,
            background:'linear-gradient(135deg,rgba(220,38,38,.15),rgba(185,28,28,.1))',
            border:'2px solid rgba(220,38,38,.4)',cursor:'pointer',width:'100%',textAlign:'left',
          }}>
            <div style={{ width:48,height:48,borderRadius:'50%',background:'rgba(220,38,38,.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <Shield style={{ width:24,height:24,color:'#ef4444' }}/>
            </div>
            <div style={{ flex:1 }}>
              <p style={{ fontSize:16,fontWeight:800,color:'#ef4444' }}>Open Emergency Screen</p>
              <p style={{ fontSize:12,color:'var(--text-muted)',marginTop:2 }}>Full-screen view with all medical info for paramedics · includes pinned documents</p>
            </div>
            <ChevronRight style={{ width:20,height:20,color:'#ef4444',flexShrink:0 }}/>
          </button>

          {/* Emergency info preview cards */}
          <div style={{ padding:'14px 16px',borderRadius:14,background:'rgba(251,191,36,.07)',border:'1px solid rgba(251,191,36,.25)' }}>
            <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12 }}>
              <AlertTriangle style={{ width:16,height:16,color:'#fbbf24' }}/>
              <p style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>Allergies</p>
            </div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
              {EMERGENCY_INFO.allergies.map(a=><span key={a} style={{ padding:'4px 10px',borderRadius:20,background:'rgba(251,191,36,.15)',color:'#f59e0b',fontSize:12,fontWeight:600 }}>{a}</span>)}
            </div>
          </div>

          <div style={{ padding:'14px 16px',borderRadius:14,background:'rgba(96,165,250,.07)',border:'1px solid rgba(96,165,250,.25)' }}>
            <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12 }}>
              <Pill style={{ width:16,height:16,color:'#60a5fa' }}/>
              <p style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>Current medications</p>
            </div>
            {EMERGENCY_INFO.currentMeds.map(m=><p key={m} style={{ fontSize:13,color:'var(--text-secondary)',paddingBottom:6,borderBottom:'1px solid var(--border)' }}>💊 {m}</p>)}
          </div>

          <div style={{ padding:'14px 16px',borderRadius:14,background:'rgba(248,113,113,.07)',border:'1px solid rgba(248,113,113,.25)' }}>
            <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:12 }}>
              <Heart style={{ width:16,height:16,color:'#f87171' }}/>
              <p style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>Chronic conditions</p>
            </div>
            {EMERGENCY_INFO.conditions.map(c=><p key={c} style={{ fontSize:13,color:'var(--text-secondary)',paddingBottom:6,borderBottom:'1px solid var(--border)' }}>• {c}</p>)}
          </div>

          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
            <div style={{ padding:'14px',borderRadius:14,background:'rgba(52,211,153,.07)',border:'1px solid rgba(52,211,153,.25)' }}>
              <p style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:8 }}>Blood type</p>
              <p style={{ fontSize:36,fontWeight:900,color:'#34d399',lineHeight:1 }}>{EMERGENCY_INFO.bloodType}</p>
            </div>
            <div style={{ padding:'14px',borderRadius:14,background:'rgba(52,211,153,.07)',border:'1px solid rgba(52,211,153,.25)' }}>
              <p style={{ fontSize:10,fontWeight:700,color:'var(--text-muted)',letterSpacing:'.08em',textTransform:'uppercase',marginBottom:8 }}>Emergency contact</p>
              <p style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>{EMERGENCY_INFO.emergencyContact.name}</p>
              <a href={`tel:${EMERGENCY_INFO.emergencyContact.phone}`} style={{ fontSize:12,color:'#34d399',display:'block',marginTop:4,textDecoration:'none',fontWeight:600 }}>{EMERGENCY_INFO.emergencyContact.phone}</a>
            </div>
          </div>

          {/* Pinned docs */}
          <div style={{ padding:'14px 16px',borderRadius:14,background:'var(--bg-card)',border:'1px solid var(--border)' }}>
            <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10 }}>
              <Star style={{ width:15,height:15,color:'#ef4444' }}/>
              <p style={{ fontSize:13,fontWeight:700,color:'var(--text-primary)' }}>Pinned documents ({pinnedDocs.length})</p>
            </div>
            {pinnedDocs.length===0
              ? <p style={{ fontSize:12,color:'var(--text-muted)' }}>Pin documents from My Records using the ⭐ button — they appear here and on the emergency screen.</p>
              : pinnedDocs.map(d=>(
                <div key={d.id} style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid var(--border)' }}>
                  <FileText style={{ width:14,height:14,color:'var(--text-muted)' }}/>
                  <p style={{ fontSize:13,color:'var(--text-primary)',flex:1 }}>{d.document_name??d.file_name}</p>
                  <button onClick={()=>setPinned(p=>{ const n=new Set(p); n.delete(d.id); return n; })} style={{ color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer',padding:2 }}><X style={{ width:12,height:12 }}/></button>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {/* Edit */}
      <Modal open={!!editDoc} onClose={()=>setEditDoc(null)} title="Edit document" size="lg">
        {editDoc && <DocumentEditForm document={editDoc} onSaved={async()=>{ setEditDoc(null); await reload(); }} onCancel={()=>setEditDoc(null)}/>}
      </Modal>

      {/* Delete */}
      <Modal open={!!deleteDoc} onClose={()=>setDeleteDoc(null)} title="Delete this document?" size="sm"
        footer={<><Button variant="ghost" onClick={()=>setDeleteDoc(null)}>Keep it</Button><Button variant="danger" loading={deleting} onClick={()=>deleteDoc&&handleDelete(deleteDoc)}>Delete permanently</Button></>}>
        {deleteDoc&&<><p style={{ fontSize:13,color:'var(--text-secondary)' }}>"{deleteDoc.document_name??deleteDoc.file_name}" will be permanently removed.</p>{deleteErr&&<p style={{ marginTop:8,fontSize:12,color:'var(--danger)' }}>{deleteErr}</p>}</>}
      </Modal>

      {/* Preview */}
      <Modal open={!!previewDoc} onClose={()=>setPreviewDoc(null)} title={previewDoc?.doc.document_name??previewDoc?.doc.file_name??''} size="lg">
        {previewDoc&&(
          previewDoc.doc.mime_type==='application/pdf'
            ? <iframe src={previewDoc.url} title="Preview" style={{ width:'100%',height:'60vh',border:'1px solid var(--border)',borderRadius:8 }}/>
            : <img src={previewDoc.url} alt="Preview" style={{ maxHeight:'60vh',width:'100%',objectFit:'contain',borderRadius:8 }}/>
        )}
      </Modal>

      {/* Share */}
      <Modal open={!!(shareDoc||shareAll)} onClose={()=>{ setShareDoc(null); setShareAll(false); setShareLink(null); }} title={shareAll?'Share all documents':shareDoc?`Share — ${shareDoc.document_name??shareDoc.file_name}`:'Share'} size="md">
        {shareLink ? (
          <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
            <p style={{ fontSize:13,color:'var(--good-text)',fontWeight:600 }}>✓ Share link created — revocable anytime from Sharing page.</p>
            <div style={{ display:'flex',gap:8 }}>
              <input readOnly value={shareLink} style={{ flex:1,padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-input)',color:'var(--text-primary)',fontSize:12,fontFamily:'monospace',outline:'none' }}/>
              <Button onClick={()=>{ navigator.clipboard.writeText(shareLink); setCopied(true); setTimeout(()=>setCopied(false),2000); }}>
                {copied?<><Check style={{ width:14,height:14 }}/>Copied</>:<><Copy style={{ width:14,height:14 }}/>Copy</>}
              </Button>
            </div>
            <Button onClick={()=>{ setShareDoc(null); setShareAll(false); setShareLink(null); }}>Done</Button>
          </div>
        ) : (
          <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
            <div>
              <label style={{ fontSize:11,fontWeight:700,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'.04em',display:'block',marginBottom:6 }}>Recipient email</label>
              <input type="email" value={shareEmail} onChange={e=>setShareEmail(e.target.value)} placeholder="doctor@clinic.com"
                style={{ width:'100%',padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-input)',color:'var(--text-primary)',fontSize:14,outline:'none' }}/>
            </div>
            <div style={{ display:'flex',justifyContent:'flex-end',gap:10 }}>
              <Button variant="ghost" onClick={()=>{ setShareDoc(null); setShareAll(false); }}>Cancel</Button>
              <Button loading={sharing} onClick={()=>handleShare(shareAll?null:shareDoc)}>Create share link</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Emergency full-screen overlay */}
      {showEmergency && <EmergencyScreen onClose={()=>setShowEmergency(false)} pinnedDocs={pinnedDocs}/>}
    </div>
  );
}

// ─── Icon button atom ─────────────────────────────────────────────────────────
function Btn({ label, onClick, danger, loading, children, style: extraStyle }: {
  label:string; onClick:()=>void; danger?:boolean; loading?:boolean; children:React.ReactNode; style?:React.CSSProperties;
}) {
  return (
    <button onClick={onClick} aria-label={label} title={label} disabled={loading}
      style={{ borderRadius:6,padding:'5px',border:'none',background:'transparent',cursor:'pointer',color:'var(--text-muted)',opacity:loading?.5:1,...extraStyle }}
      onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background=danger?'var(--danger-bg)':'var(--nav-hover-bg)'; }}
      onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background='transparent'; }}>
      {loading ? <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> : children}
    </button>
  );
}
