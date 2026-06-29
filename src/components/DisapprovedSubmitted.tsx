import React, { useEffect, useState } from 'react';
import { User, Household } from '../types';
import { 
  ShieldAlert, Edit3, CheckCircle2, MessageSquare, AlertTriangle, 
  RefreshCw, MapPin, Phone, User as UserIcon, Calendar, Check, X, ClipboardList, AlertCircle, Paperclip, FileText
} from 'lucide-react';
import SignaturePad from './SignaturePad';

const BARANGAY_COORDS_MAP: { [key: string]: [number, number] } = {
  'San Francisco': [7.8284, 123.4332],
  'Santa Lucia': [7.8320, 123.4410],
  'Tuburan': [7.8150, 123.4280],
  'Lumbia': [7.8420, 123.4250],
  'Balangasan': [7.8240, 123.4450]
};

const PUROK_COORDS_MAP: { [key: string]: [number, number] } = {
  'Purok Mangga': [7.8290, 123.4310],
  'Purok Durian': [7.8275, 123.4350],
  'Purok Santol': [7.8300, 123.4340],
  'Purok Sampaguita': [7.8330, 123.4420],
  'Purok Rosal': [7.8310, 123.4390],
  'Purok Bougainvillea': [7.8160, 123.4290],
  'Purok Mahogany': [7.8440, 123.4240],
  'Purok Narra': [7.8400, 123.4260]
};

interface DisapprovedProps {
  currentUser: User;
}

export default function DisapprovedSubmitted({ currentUser }: DisapprovedProps) {
  const [items, setItems] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const isRealMasterAdmin = currentUser && currentUser.email && (
    currentUser.email.toLowerCase() === 'elthrone1233@gmail.com' ||
    currentUser.email.toLowerCase() === 'saintfrancisclinic2026@gmail.com'
  );

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const handleDeleteDisapproved = (id: string, headName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Disapproved Record?',
      description: `Caution: This will permanently delete the disapproved household record for "${headName}" and send it to the Recycle Bin. This action cannot be easily undone.`,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const res = await fetch('/api/households/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-user-email': currentUser.email
            },
            body: JSON.stringify({ id })
          });
          if (res.ok) {
            setAlertModal({
              isOpen: true,
              title: 'Record Deleted Successfully',
              description: `Household record for "${headName}" has been successfully deleted.`,
              type: 'success'
            });
            fetchDisapproved();
          } else {
            const err = await res.json();
            setAlertModal({
              isOpen: true,
              title: 'Deletion Failed',
              description: err.error || 'Failed to delete the disapproved record.',
              type: 'error'
            });
          }
        } catch (e: any) {
          setAlertModal({
            isOpen: true,
            title: 'Communication Error',
            description: e.message || 'Handshake failed with database.',
            type: 'error'
          });
        }
      }
    });
  };
  
  // Edit form states
  const [editingItem, setEditingItem] = useState<Household | null>(null);
  const [editHeadName, setEditHeadName] = useState('');
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [editContact, setEditContact] = useState('');
  const [editBarangay, setEditBarangay] = useState('');
  const [editPurok, setEditPurok] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editPmrf, setEditPmrf] = useState<'Willing' | 'Not Willing' | 'Pending'>('Willing');
  const [editYakap, setEditYakap] = useState<'Willing' | 'Not Willing' | 'Pending'>('Willing');
  
  // PMRF details nested edit
  const [editPurpose, setEditPurpose] = useState<'REGISTRATION' | 'UPDATING'>('REGISTRATION');
  const [editPin, setEditPin] = useState('');
  const [editMotherMaiden, setEditMotherMaiden] = useState('');
  const [editSpouseName, setEditSpouseName] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editBirthPlace, setEditBirthPlace] = useState('');
  const [editSex, setEditSex] = useState<'Male' | 'Female'>('Male');
  const [editCivilStatus, setEditCivilStatus] = useState<'Single' | 'Married' | 'Annulled' | 'Widowed' | 'Legally Separated'>('Single');
  const [editCitizenship, setEditCitizenship] = useState<'FILIPINO' | 'FOREIGN' | 'DUAL'>('FILIPINO');
  const [editSignature, setEditSignature] = useState<string | null>(null);
  const [editAttachments, setEditAttachments] = useState<string[]>([]);
  const [selectedAttachmentFile, setSelectedAttachmentFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  
  const [puroks, setPuroks] = useState<any[]>([]);
  const [barangayList, setBarangayList] = useState<any[]>([]);

  const fetchPuroksAndBarangays = async () => {
    try {
      const resP = await fetch('/api/puroks');
      if (resP.ok) {
        const dataP = await resP.json();
        setPuroks(dataP);
      }
      const resB = await fetch('/api/barangays');
      if (resB.ok) {
        const dataB = await resB.json();
        setBarangayList(dataB.barangays || []);
      }
    } catch (e) {
      console.warn('Failed to load locations', e);
    }
  };

  const fetchDisapproved = async () => {
    if (!currentUser || !currentUser.email) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/households/disapproved', {
        headers: {
          'x-user-email': currentUser.email
        }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to fetch disapproved submissions.');
      }
    } catch (e) {
      setErrorMsg('Network error checking disapproved logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisapproved();
    fetchPuroksAndBarangays();
  }, [currentUser]);

  const handleRandomCoordinates = () => {
    const fallbackLat = PUROK_COORDS_MAP[editPurok]?.[0] || BARANGAY_COORDS_MAP[editBarangay]?.[0] || 7.8284;
    const fallbackLng = PUROK_COORDS_MAP[editPurok]?.[1] || BARANGAY_COORDS_MAP[editBarangay]?.[1] || 123.4332;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setEditLat(position.coords.latitude.toFixed(5));
          setEditLng(position.coords.longitude.toFixed(5));
        },
        (error) => {
          console.warn("Geolocation skipped or denied, fallback to recorded coordinates:", error);
          setEditLat(fallbackLat.toFixed(5));
          setEditLng(fallbackLng.toFixed(5));
        },
        { enableHighAccuracy: true, timeout: 3500 }
      );
    } else {
      setEditLat(fallbackLat.toFixed(5));
      setEditLng(fallbackLng.toFixed(5));
    }
  };

  const handleOpenEdit = (h: Household) => {
    setEditingItem(h);
    setEditHeadName(h.householdHead);
    setEditContact(h.contactNumber);
    setEditBarangay(h.barangay);
    setEditPurok(h.purok);
    setEditLat(h.latitude.toString());
    setEditLng(h.longitude.toString());
    setEditPmrf(h.pmrfStatus);
    setEditYakap(h.yakapWillingStatus);

    // Load nested details
    const det = h.pmrfDetails || {};
    setEditPurpose(det.purpose || 'REGISTRATION');
    setEditPin(det.pin || '');
    setEditMotherMaiden(det.motherMaiden || '');
    setEditSpouseName(det.spouseName || '');
    setEditBirthDate(det.birthDate || '');
    setEditBirthPlace(det.birthPlace || 'Pagadian City');
    setEditSex(det.sex || 'Male');
    setEditCivilStatus(det.civilStatus || 'Single');
    setEditCitizenship(det.citizenship || 'FILIPINO');
    setEditSignature((h as any).patientSignature || det.patientSignature || null);
    setEditAttachments(h.attachments || []);
  };

  const handleUploadAttachment = () => {
    if (!selectedAttachmentFile) return;
    setUploadProgress(10);
    
    let progressValue = 10;
    const interval = setInterval(() => {
      progressValue += Math.floor(Math.random() * 20) + 15;
      if (progressValue >= 100) {
        progressValue = 100;
        setUploadProgress(100);
        clearInterval(interval);
        
        const reader = new FileReader();
        const currentFile = selectedAttachmentFile;
        reader.onloadend = () => {
          const newAttachment = {
            fileData: reader.result as string,
            fullName: editHeadName || 'Unassigned Member',
            documentType: 'ID PROOF',
            fileName: currentFile.name
          };
          setEditAttachments(prev => [...prev, newAttachment]);
          setSelectedAttachmentFile(null);
          setUploadProgress(null);
        };
        reader.readAsDataURL(selectedAttachmentFile);
      } else {
        setUploadProgress(progressValue);
      }
    }, 120);
  };

  const handleSaveAndResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editingItem.isFpePcsfOnly && !editMotherMaiden.trim()) {
      setAlertModal({
        isOpen: true,
        title: "Mother's Maiden Name Required",
        description: "Please fill out the Mother's Maiden Name in the PMRF details section before resubmitting.",
        type: "error"
      });
      return;
    }

    setIsResubmitting(true);
    try {
      const updatedData = {
        householdHead: editHeadName,
        contactNumber: editContact,
        barangay: editBarangay,
        purok: editPurok,
        latitude: parseFloat(editLat) || editingItem.latitude,
        longitude: parseFloat(editLng) || editingItem.longitude,
        pmrfStatus: editPmrf,
        yakapWillingStatus: editYakap,
        patientSignature: editSignature || undefined,
        attachments: editAttachments,
        pmrfDetails: {
          ...(editingItem.pmrfDetails || {}),
          patientSignature: editSignature || undefined,
          purpose: editPurpose,
          pin: editPin,
          motherMaiden: editMotherMaiden,
          spouseName: editSpouseName,
          birthDate: editBirthDate,
          birthPlace: editBirthPlace,
          sex: editSex,
          civilStatus: editCivilStatus,
          citizenship: editCitizenship
        }
      };

      const res = await fetch('/api/households/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          id: editingItem.id,
          householdData: updatedData,
          // keep existing members & dependents
          membersData: null,
          dependentsData: null
        })
      });

      if (res.ok) {
        setAlertModal({
          isOpen: true,
          title: 'Resubmitted Successfully',
          description: 'The household data has been updated and successfully resubmitted to the Verification Queue!',
          type: 'success'
        });
        setEditingItem(null);
        fetchDisapproved();
      } else {
        const err = await res.json();
        setAlertModal({
          isOpen: true,
          title: 'Resubmission Failed',
          description: err.error || 'Failed to resubmit the corrected file details.',
          type: 'error'
        });
      }
    } catch (err) {
      setAlertModal({
        isOpen: true,
        title: 'Communication Error',
        description: 'Network communication handshake error with the Saint Francis Database.',
        type: 'error'
      });
    } finally {
      setIsResubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans text-xs">
      {/* Dynamic Header banner */}
      <div className="bg-gradient-to-r from-red-900 to-slate-900 p-6 rounded-2xl text-white shadow-md border border-red-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse" />
            Disapproved Submissions Portal
          </h2>
          <p className="text-slate-350 text-[10px] mt-1 font-medium">
            Active view of submitted household profiles sent back by evaluators due to missing data, incorrect attachments, or invalid formats.
          </p>
        </div>
        <button 
          onClick={fetchDisapproved}
          className="bg-white/10 hover:bg-white/20 text-white font-bold py-2 p-3 rounded-lg flex items-center gap-1.5 transition active:scale-95 text-[10px] uppercase cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Force Sync
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-red-650 border-r-transparent mb-1.5"></div>
          <p className="text-slate-400 font-medium">Scanning disapproved files and synchronizing records...</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-red-50 text-red-700 border-l-4 border-red-500 p-4 rounded-xl font-medium shadow-xs">
          {errorMsg}
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
          <ClipboardList className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-700 text-sm">No records found.</h3>
          <p className="text-[10px] text-slate-500 mt-1 max-w-sm mx-auto">
            All submissions are either pending validation, successfully verified in Saint Francis Database, or belong to other users.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {items.map((h) => {
            const hasAttachment = h.attachments && h.attachments.length > 0;
            return (
              <div 
                key={h.id} 
                className="bg-white border-2 border-red-100 rounded-2xl p-5 shadow-sm space-y-4 hover:shadow-md transition relative overflow-hidden"
              >
                {/* Visual red tag in top corners */}
                <div className="absolute top-0 right-0 bg-red-600 text-white font-extrabold uppercase text-[8px] font-mono tracking-widest px-3 py-1 rounded-bl-xl shadow-xs">
                  DISAPPROVED
                </div>

                <div className="flex items-start gap-3.5 border-b pb-3">
                  <div className="h-11 w-11 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center font-bold text-sm shrink-0">
                    🏠
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono bg-red-100 text-red-800 text-[10px] px-1.5 py-0.5 rounded font-extrabold">
                        {h.householdNumber}
                      </span>
                      <span className="text-slate-400 font-mono text-[9.5px]">
                        Created: {h.createdAt ? new Date(h.createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-slate-900 text-base mt-1">
                      {h.householdHead}
                    </h3>
                  </div>
                </div>

                {/* CRITICAL REASON DISAPPROVED INSIDE HIGH VISIBILITY CARD */}
                <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-3.5 space-y-1">
                  <span className="text-red-550 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" /> Feedbacks on Lacking / Missing items:
                  </span>
                  <p className="text-red-900 font-extrabold text-[11px] leading-snug">
                    {h.remarks || 'No detailed review log provided yet.'}
                  </p>
                </div>

                {/* Key metadata */}
                <div className="bg-slate-50/70 border rounded-xl p-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" /> Loc: <strong>{h.barangay}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-slate-400" /> Phone: <strong className="font-mono">{h.contactNumber || 'N/A'}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <UserIcon className="h-3.5 w-3.5 text-slate-400" /> Field Personnel: <strong>{h.createdBy}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" /> Submitter: <strong className="text-slate-700">{h.createdBy}</strong>
                  </span>
                </div>

                {/* Action buttons */}
                <div className="pt-2 border-t flex justify-between items-center gap-3">
                  <div className="text-[10px]">
                    {hasAttachment ? (
                      <span className="text-emerald-600 font-bold">📎 ID Scans Attached</span>
                    ) : (
                      <span className="text-red-600 font-bold animate-pulse">⚠️ Missing Scanned ID Attachments</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {isRealMasterAdmin && (
                      <button
                        onClick={() => handleDeleteDisapproved(h.id, h.householdHead)}
                        className="bg-red-650 hover:bg-red-700 text-white font-bold px-3 py-2.5 rounded-lg active:scale-95 transition cursor-pointer text-[10px] uppercase tracking-wider flex items-center gap-1.5"
                        title="Delete this disapproved submission permanently"
                      >
                        🗑️ Delete
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenEdit(h)}
                      className="btn-3d-primary font-bold px-4 py-2.5 flex items-center gap-1 cursor-pointer text-[10px] uppercase tracking-wider"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Correct & Resubmit
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QUICK CORRECT MODAL DIALOG */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[10010] p-4 text-xs font-sans text-slate-800">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative border overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Edit3 className="h-5 w-5 text-blue-600" />
                  Revise Submission Details
                </h2>
                <p className="text-slate-400 text-[10px] mt-0.5">Solve discrepancies to stamp record clear of gaps and resubmit.</p>
              </div>
              <button 
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Prominent Disapproval details metadata audit trail card */}
            <div className="bg-slate-50 border-2 border-red-200 rounded-xl p-4.5 mb-5 space-y-3 text-xs leading-relaxed">
              <div className="border-b pb-2 mb-2 flex items-center justify-between">
                <span className="text-red-700 font-extrabold uppercase text-[9px] tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" /> Official Disapproval Audit Trail Dossier
                </span>
                <span className="text-[10px] bg-red-100 text-red-800 font-mono font-bold px-2 py-0.5 rounded-full">
                  {editingItem.submissionReferenceNumber || editingItem.householdNumber}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-755 font-sans">
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px] block leading-none">Submission Ref Number</span>
                  <strong className="font-mono text-slate-900 mt-1 block">{editingItem.submissionReferenceNumber || editingItem.householdNumber}</strong>
                </div>
                
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px] block leading-none">Household Name</span>
                  <strong className="text-slate-900 mt-1 block">{editingItem.householdHead}</strong>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px] block leading-none">Date Submitted</span>
                  <strong className="text-slate-950 mt-1 block">
                    {editingItem.dateSubmitted ? new Date(editingItem.dateSubmitted).toLocaleString() : (editingItem.createdAt ? new Date(editingItem.createdAt).toLocaleString() : 'N/A')}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px] block leading-none">Date Disapproved</span>
                  <strong className="text-slate-950 mt-1 block">
                    {editingItem.updatedAt ? new Date(editingItem.updatedAt).toLocaleString() : 'N/A'}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px] block leading-none">Disapproved By</span>
                  <strong className="text-slate-900 mt-1 block">{editingItem.updatedBy || 'Clinical Evaluator'}</strong>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px] block leading-none">Attached Files</span>
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {editingItem.attachments && editingItem.attachments.length > 0 ? (
                      editingItem.attachments.map((img: any, idx: number) => {
                        const src = typeof img === 'string' ? img : (img?.fileData || img?.url || '');
                        const name = typeof img === 'object' && img?.fileName ? img.fileName : `File ${idx + 1}`;
                        return (
                          <a 
                            key={idx} 
                            href={src} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-[9.5px] text-blue-600 hover:underline flex items-center gap-0.5 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 font-semibold"
                          >
                            📎 {name}
                          </a>
                        );
                      })
                    ) : (
                      <span className="text-red-650 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-100 text-[9.5px]">No files attached</span>
                    )}
                  </div>
                </div>
                
                <div className="sm:col-span-2 bg-white border border-red-100 rounded-lg p-2.5 mt-1">
                  <span className="text-red-750 font-bold uppercase tracking-wider text-[8.5px] block leading-none mb-1">Reason for Disapproval</span>
                  <p className="text-red-950 font-semibold leading-relaxed text-[11px]">
                    {editingItem.remarks || 'No detailed review feedback log provided yet.'}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveAndResubmit} className="space-y-4">
              <span className="font-bold text-blue-800 block uppercase tracking-wider text-[10px] border-b pb-1">1. Demographics & Geotag</span>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">Household Head Name</label>
                  <input
                    type="text"
                    value={editHeadName}
                    onChange={(e) => setEditHeadName(e.target.value)}
                    className="w-full mt-1.5 border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:border-blue-500 bg-slate-50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">Contact Phone Number</label>
                  <input
                    type="text"
                    value={editContact}
                    onChange={(e) => setEditContact(e.target.value)}
                    className="w-full mt-1.5 border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:border-blue-500 bg-slate-50 font-mono"
                    placeholder="e.g. 09123456789"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">Select Barangay Position</label>
                  <select
                    value={editBarangay}
                    onChange={(e) => {
                      const newBarangay = e.target.value;
                      setEditBarangay(newBarangay);
                      const selectedBrg = barangayList.find(b => b.name === newBarangay);
                      const filteredPuroks = puroks.filter(p => (p.barangay_id && p.barangay_id === selectedBrg?.id) || p.barangay === newBarangay);
                      if (filteredPuroks.length > 0) {
                        setEditPurok(filteredPuroks[0].purokName || filteredPuroks[0].name);
                      } else {
                        setEditPurok('');
                      }
                    }}
                    className="w-full mt-1.5 border border-slate-300 rounded px-2.5 py-1.5 outline-none bg-white focus:border-blue-500"
                    required
                  >
                    {barangayList.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                    {barangayList.length === 0 && (
                      ['San Francisco', 'Santa Lucia', 'Tuburan', 'Lumbia', 'Balangasan'].map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">Assign Purok Sector</label>
                  <select
                    value={editPurok}
                    onChange={(e) => setEditPurok(e.target.value)}
                    className="w-full mt-1.5 border border-slate-300 rounded px-2.5 py-1.5 outline-none bg-white focus:border-blue-500"
                    required
                  >
                    {(() => {
                      const selectedBrg = barangayList.find(b => b.name === editBarangay);
                      const filtered = puroks.filter(p => (p.barangay_id && p.barangay_id === selectedBrg?.id) || p.barangay === editBarangay);
                      return filtered.map(p => {
                        const pName = p.purokName || p.name;
                        return <option key={p.id} value={pName}>{pName}</option>;
                      });
                    })()}
                    {(() => {
                      const selectedBrg = barangayList.find(b => b.name === editBarangay);
                      const filtered = puroks.filter(p => (p.barangay_id && p.barangay_id === selectedBrg?.id) || p.barangay === editBarangay);
                      if (filtered.length === 0) {
                        return <option value="">No Puroks Registered</option>;
                      }
                      return null;
                    })()}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none mb-1.5">Geotag Coordinates (Lat & Lng Index)</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="grid grid-cols-2 gap-2 flex-1 min-w-0">
                      <input 
                        type="text" 
                        value={editLat} 
                        onChange={(e) => setEditLat(e.target.value)} 
                        placeholder="Latitude"
                        className="w-full bg-white border p-2 border-slate-300 rounded text-center text-[10px] font-mono outline-none focus:border-blue-500"
                      />
                      <input 
                        type="text" 
                        value={editLng} 
                        onChange={(e) => setEditLng(e.target.value)} 
                        placeholder="Longitude"
                        className="w-full bg-white border p-2 border-slate-300 rounded text-center text-[10px] font-mono outline-none font-semibold focus:border-blue-500"
                      />
                    </div>
                    <button 
                      type="button" 
                      onClick={handleRandomCoordinates}
                      title="Auto Tag Coordinates"
                      className="btn-3d-primary w-full sm:w-auto px-4 py-2 sm:py-1.5 text-white font-bold text-[10px] uppercase rounded-lg shrink-0 flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
                    >
                      📍 Tag Coords
                    </button>
                  </div>
                </div>
              </div>

              <span className="font-bold text-blue-800 block uppercase tracking-wider text-[10px] border-b pb-1 pt-2">2. PhilHealth PMRF Duplicate Form fields</span>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">Filing Purpose</label>
                  <select
                    value={editPurpose}
                    onChange={(e: any) => setEditPurpose(e.target.value)}
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 outline-none font-semibold bg-white"
                  >
                    <option value="REGISTRATION">REGISTRATION</option>
                    <option value="UPDATING">UPDATING</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">PIN Identification No.</label>
                  <input
                    type="text"
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value)}
                    placeholder="PhilHealth PIN"
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">Spouse Full Name</label>
                  <input
                    type="text"
                    value={editSpouseName}
                    onChange={(e) => setEditSpouseName(e.target.value)}
                    placeholder="Spouse Name"
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">Mother's Maiden Name <span className="text-red-500 font-extrabold">*</span></label>
                  <input
                    type="text"
                    value={editMotherMaiden}
                    onChange={(e) => setEditMotherMaiden(e.target.value)}
                    placeholder="Mother's Maiden"
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">Date of Birth</label>
                  <input
                    type="date"
                    value={editBirthDate}
                    onChange={(e) => setEditBirthDate(e.target.value)}
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">Sex</label>
                  <select
                    value={editSex}
                    onChange={(e: any) => setEditSex(e.target.value)}
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">Civil Status</label>
                  <select
                    value={editCivilStatus}
                    onChange={(e: any) => setEditCivilStatus(e.target.value)}
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 bg-white font-semibold"
                  >
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Annulled">Annulled</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Legally Separated">Legally Separated</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">Citizenship</label>
                  <select
                    value={editCitizenship}
                    onChange={(e: any) => setEditCitizenship(e.target.value)}
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 bg-white font-semibold"
                  >
                    <option value="FILIPINO">FILIPINO</option>
                    <option value="FOREIGN">FOREIGN</option>
                    <option value="DUAL">DUAL CITIZEN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-500 uppercase">Birth Place</label>
                  <input
                    type="text"
                    value={editBirthPlace}
                    onChange={(e) => setEditBirthPlace(e.target.value)}
                    placeholder="City or Municipality"
                    className="w-full mt-1 border border-slate-300 rounded px-2 py-1 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5 pt-2 border-t">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">PhilHealth Program Willingness</label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="radio" 
                        name="editPmrfVal" 
                        checked={editPmrf === 'Willing'} 
                        onChange={() => setEditPmrf('Willing')} 
                      />
                      <span className="font-bold text-emerald-600">Willing</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="radio" 
                        name="editPmrfVal" 
                        checked={editPmrf === 'Not Willing'} 
                        onChange={() => setEditPmrf('Not Willing')} 
                      />
                      <span className="font-bold text-red-600">Not Willing</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="radio" 
                        name="editPmrfVal" 
                        checked={editPmrf === 'Pending'} 
                        onChange={() => setEditPmrf('Pending')} 
                      />
                      <span className="font-bold text-slate-500">Pending</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase leading-none">Yakap Willingness Status</label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="radio" 
                        name="editYakapVal" 
                        checked={editYakap === 'Willing'} 
                        onChange={() => setEditYakap('Willing')} 
                      />
                      <span className="font-bold text-emerald-600">Willing</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="radio" 
                        name="editYakapVal" 
                        checked={editYakap === 'Not Willing'} 
                        onChange={() => setEditYakap('Not Willing')} 
                      />
                      <span className="font-bold text-red-600">Not Willing</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input 
                        type="radio" 
                        name="editYakapVal" 
                        checked={editYakap === 'Pending'} 
                        onChange={() => setEditYakap('Pending')} 
                      />
                      <span className="font-bold text-slate-500">Pending</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* UNIFIED SIGNATURE BLOCK IN DISAPPROVED/REVISE DIALOG */}
              <div className="border border-slate-305 bg-blue-900 text-white font-bold text-[10px] py-1.5 px-3 uppercase tracking-wider block mt-4">
                📝 Unified Patient / Representative Signature (Auto-Stamps on all 3 Forms)
              </div>
              <div className="p-4 border border-slate-300 bg-white flex flex-col md:flex-row gap-4 items-center justify-between shadow-xs mb-4 rounded-b-lg">
                <div className="flex-1 space-y-1">
                  <h4 className="font-bold text-slate-800 text-sm">Patient Sworn Signature Seal</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                    The patient signature is required to authorize PhilHealth PMRF, clinical FPE intake, and PCSF provider selection. Review or re-draw a clean signature if the previous one was rejected or is missing.
                  </p>
                </div>
                <div className="shrink-0">
                  <SignaturePad 
                    onChange={(sig) => setEditSignature(sig)} 
                    defaultValue={editSignature}
                  />
                </div>
              </div>

              {/* ATTACHMENT SECTION - HIGH EMPHASIS IF NONE WAS ATTACHED PREVIOUSLY */}
              <div className="border border-slate-305 bg-emerald-900 text-white font-bold text-[10px] py-1.5 px-3 uppercase tracking-wider block mt-4">
                📂 Attachments (Dossier Identity Verification Logs)
              </div>
              <div className="p-4 border border-slate-300 bg-slate-50/50 rounded-b-lg space-y-3">
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                  Provide verified ID card scans or document proofs to complete requirements.
                  {(!editingItem.attachments || editingItem.attachments.length === 0) ? (
                    <span className="block mt-1.5 font-bold text-red-650 animate-pulse bg-red-50 p-2 rounded border border-red-200">
                      ⚠️ Crucial: This submission has NO ID attachments. If you do not attach a clear scan of the primary ID now, verification may be delayed.
                    </span>
                  ) : (
                    <span className="block mt-1.5 text-emerald-600 font-bold bg-emerald-50 p-2 rounded border border-emerald-100">
                      📎 Current record contains {editingItem.attachments.length} attachment(s). You may add additional documents below if needed.
                    </span>
                  )}
                </p>
                
                <div className="flex items-center justify-center p-5 border-2 border-dashed border-slate-300 bg-white hover:border-emerald-500 rounded-xl hover:bg-slate-50/70 transition cursor-pointer relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedAttachmentFile(e.target.files[0]);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="text-center space-y-1">
                    <span className="text-slate-600 text-xs font-bold block">Click or Drag & Drop local image here to select</span>
                    <span className="text-[9px] text-slate-400 block font-medium">PNG, JPG, JPEG, WEBP files</span>
                  </div>
                </div>

                {selectedAttachmentFile && (
                  <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-700">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Paperclip className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-bold truncate" id="disapproved-selected-upload-file-name">{selectedAttachmentFile.name}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">({(selectedAttachmentFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      {uploadProgress === null && (
                        <button
                          type="button"
                          onClick={() => setSelectedAttachmentFile(null)}
                          className="text-rose-600 hover:text-rose-700 font-extrabold text-[10px] uppercase tracking-wide cursor-pointer p-0.5"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {uploadProgress !== null ? (
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-bold text-emerald-800">
                          <span>Uploading to Secure Server...</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-600 transition-all duration-120 ease-out rounded-full" 
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleUploadAttachment}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 active:translate-y-[1px] select-none text-[10px] font-black uppercase text-white p-2 rounded-lg border-b-[2.5px] border-emerald-850 hover:border-emerald-705 transition cursor-pointer shadow-sm shadow-emerald-950/20 text-center"
                      >
                        Upload Attachment
                      </button>
                    )}
                  </div>
                )}

                {editAttachments.length > 0 && (
                  <div className="space-y-1.5 bg-white p-3 rounded-lg border border-slate-200">
                    <span className="block text-[9.5px] font-bold text-slate-600 uppercase tracking-widest">Selected Attachments ({editAttachments.length}):</span>
                    <div className="flex gap-2.5 flex-wrap">
                      {editAttachments.map((img: any, idx: number) => {
                        const isObj = img && typeof img === 'object';
                        const fileData = isObj ? img.fileData : img;
                        const fileName = isObj ? img.fileName : '';
                        const isPdf = fileData?.startsWith('data:application/pdf') || (fileName && fileName.toLowerCase().endsWith('.pdf'));
                        
                        return (
                          <div key={idx} className="relative h-16 w-16 rounded-lg overflow-hidden border-2 border-emerald-500 hover:scale-105 transition bg-slate-50 flex items-center justify-center">
                            {isPdf ? (
                              <div className="h-full w-full bg-white flex flex-col items-center justify-center p-1 text-center">
                                <FileText className="h-6 w-6 text-red-500 mb-0.5" />
                                <span className="text-[6.5px] font-black text-slate-500 truncate max-w-full font-mono">{fileName || 'PDF Doc'}</span>
                              </div>
                            ) : (
                              <img src={fileData} alt="attached doc scan" className="h-full w-full object-cover" />
                            )}
                            <button
                              type="button"
                              onClick={() => setEditAttachments(editAttachments.filter((_, i) => i !== idx))}
                              className="absolute inset-0 bg-red-650/75 text-white font-bold flex items-center justify-center hover:bg-red-700 shadow text-xs cursor-pointer opacity-0 hover:opacity-100 transition duration-150"
                              title="Delete Attachment"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-3.5 border-t border-slate-100 text-[10.5px]">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 btn-3d-secondary font-bold uppercase cursor-pointer text-[10px] rounded-xl"
                >
                  Discard Changes
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 btn-3d-primary btn-pulse-save text-white font-extrabold uppercase rounded-xl flex items-center gap-1.5 cursor-pointer text-[10px]"
                >
                  <Check className="h-4 w-4" /> Save Variations & Resubmit File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HIGH-DESIGN CUSTOM CONFIRMATION POPUP MODAL */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setConfirmModal(null)}
          ></div>
          
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl relative max-w-md w-full overflow-hidden transform transition-all scale-100 duration-300 p-6 space-y-5">
            <div className="flex items-start gap-4 text-left">
              <span className="p-3 bg-rose-50 text-rose-600 rounded-2xl shadow-sm border border-rose-100 mt-1 block">
                <ShieldAlert className="h-6 w-6 animate-pulse" />
              </span>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  {confirmModal.title}
                </h3>
                <span className="text-[10px] font-bold text-red-650 uppercase bg-red-50 border border-red-100 px-2.5 py-0.5 rounded tracking-wider">
                  Critical Action Required
                </span>
                <p className="text-slate-500 text-xs leading-relaxed pt-2">
                  {confirmModal.description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 border border-slate-200 text-slate-605 hover:text-slate-905 hover:bg-slate-50 hover:border-slate-305 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all duration-200 hover:shadow-sm"
              >
                Cancel Action
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-rose-500 text-white rounded-xl font-extrabold text-[10px] uppercase tracking-wider transition-all duration-300 shadow-lg shadow-red-200/50 hover:shadow-red-300/80 hover:scale-[1.03] active:scale-95 cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CENTERING ALERT POPUP MODAL */}
      {alertModal?.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-md" onClick={() => setAlertModal(null)}></div>
          <div className="bg-white rounded-3xl border border-slate-150 shadow-2xl relative max-w-sm w-full overflow-hidden p-6 space-y-4 text-center z-[10001] animate-fade-in animate-scale-up">
            <div className="flex flex-col items-center gap-3 text-center">
              {alertModal.type === 'success' ? (
                <span className="p-3 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 block">
                  <CheckCircle2 className="h-8 w-8 animate-bounce" />
                </span>
              ) : (
                <span className="p-3 bg-rose-50 text-rose-650 rounded-full border border-rose-100 block">
                  <AlertCircle className="h-8 w-8 animate-pulse" />
                </span>
              )}
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{alertModal.title}</h3>
              <p className="text-slate-500 text-xs leading-relaxed">{alertModal.description}</p>
            </div>
            <button
              onClick={() => setAlertModal(null)}
              className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-850 hover:shadow-md transition duration-150 cursor-pointer text-xs uppercase tracking-wide font-sans text-center"
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {/* Processing resubmission loading screen overlay */}
      {isResubmitting && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex flex-col items-center justify-center z-[11000] text-white font-sans animate-fade-in">
          <div className="bg-slate-900/90 border border-slate-700/50 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <div className="h-14 w-14 rounded-full border-4 border-rose-500/20 border-t-rose-500 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-rose-450 animate-pulse text-lg">📁</span>
              </div>
            </div>
            <div>
              <h3 className="font-extrabold text-base tracking-tight text-white uppercase">Resubmitting File</h3>
              <p className="text-xs text-slate-400 mt-1.5 font-medium leading-relaxed">
                Updating variations and resubmitting household records to the clinical verification queue. Please do not close or reload this window.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
