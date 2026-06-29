import React, { useState, useEffect } from 'react';
import { 
  FileText, Upload, Calendar, Plus, Trash2, Download, 
  User, FolderOpen, Eye, RefreshCcw, FileCheck, X, ChevronRight, 
  Filter, Award, Coins, Settings, ArrowLeft, ShieldAlert, Sparkles
} from 'lucide-react';
import { User as UserType, hasRole } from '../types';

interface PCUFilesProps {
  currentUser: UserType;
}

interface PCUFileItem {
  id: string;
  fullName: string;
  birthday: string;
  gender?: string; // patient's gender
  fileName: string;
  fileData: string;
  uploadDate: string;
  uploadedBy: string; // contains the full name or email of uploader
  folderName?: string; // YYYY-MM-DD folder
}

export default function PCUFiles({ currentUser }: PCUFilesProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'archives' | 'uploader'>('archives');

  const [pcuList, setPcuList] = useState<PCUFileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Single Date Filter Only
  const [filterSingleDate, setFilterSingleDate] = useState<string>('');

  // Active sub-folder state for physical daily folders structure
  const [selectedFolderName, setSelectedFolderName] = useState<string | null>(null);
  
  // Base Rate & settings state
  const [baseRate, setBaseRate] = useState<number>(20);
  const [savingRate, setSavingRate] = useState<boolean>(false);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Selected files queue for upload
  const [uploadQueue, setUploadQueue] = useState<{
    file: File;
    name: string;
    fullName: string;
    birthday: string;
    gender: string;
    base64Data: string;
  }[]>([]);

  // Preview file Modal state
  const [viewingFile, setViewingFile] = useState<PCUFileItem | null>(null);

  // Success indicator message HUD
  const [notif, setNotif] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Checks if user is Master Admin or Manager
  const isMasterAdminOrManager = 
    hasRole(currentUser, 'MANAGER') || 
    ['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'].includes(currentUser.email);

  const fetchPcuFiles = async () => {
    try {
      const res = await fetch('/api/pcu-files', {
        headers: {
          'x-user-email': currentUser.email
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPcuList(data || []);
      }
    } catch (e) {
      console.error('Error fetching PCU files:', e);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data || []);
      }
    } catch (e) {
      console.error('Error fetching accounts:', e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const settings = await res.json();
        if (settings && settings.basePcuRate !== undefined) {
          setBaseRate(Number(settings.basePcuRate));
        }
      }
    } catch (e) {
      console.error('Error fetching settings:', e);
    }
  };

  useEffect(() => {
    fetchPcuFiles();
    fetchAccounts();
    fetchSettings();
  }, [currentUser]);

  // Handle files selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);

    filesArray.forEach((file: any) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadQueue(prev => [
          ...prev,
          {
            file,
            name: file.name,
            fullName: '',
            birthday: '',
            gender: 'Male',
            base64Data: reader.result as string
          }
        ]);
      };
      reader.readAsDataURL(file as Blob);
    });

    e.target.value = '';
  };

  // Update details of file in queue
  const updateQueueItem = (idx: number, field: 'fullName' | 'birthday' | 'gender', value: string) => {
    setUploadQueue(prev => prev.map((item, i) => {
      if (i === idx) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  // Remove file from queue
  const removeQueueItem = (idx: number) => {
    setUploadQueue(prev => prev.filter((_, i) => i !== idx));
  };

  // Save the PCU base rate
  const handleSavePcuBaseRate = async () => {
    try {
      setSavingRate(true);
      const res = await fetch('/api/settings/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ basePcuRate: Number(baseRate) })
      });
      if (res.ok) {
        setNotif({ msg: 'Base PCU rate saved successfully!', type: 'success' });
        setTimeout(() => setNotif(null), 3000);
      } else {
        const data = await res.json();
        setNotif({ msg: data.error || 'Failed to update rate values.', type: 'error' });
        setTimeout(() => setNotif(null), 3000);
      }
    } catch (err: any) {
      setNotif({ msg: err.message, type: 'error' });
      setTimeout(() => setNotif(null), 3000);
    } finally {
      setSavingRate(false);
    }
  };

  // Perform PCU records upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadQueue.length === 0) return;

    // Validate that all items look complete
    for (let i = 0; i < uploadQueue.length; i++) {
      const item = uploadQueue[i];
      if (!item.fullName.trim() || !item.birthday || !item.gender) {
        alert(`Please supply Full Name, Birthday, and Gender for "${item.name}".`);
        return;
      }
    }

    setIsUploading(true);
    try {
      const filesToSend = uploadQueue.map(item => ({
        fullName: item.fullName,
        birthday: item.birthday,
        gender: item.gender,
        fileName: item.name,
        fileData: item.base64Data
      }));

      const res = await fetch('/api/pcu-files/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ files: filesToSend })
      });

      if (res.ok) {
        await fetchPcuFiles();
        setUploadQueue([]);
        setShowUploadModal(false);
        setNotif({ msg: 'PCU Files registered successfully under daily folder!', type: 'success' });
        setTimeout(() => setNotif(null), 4000);
      } else {
        const errData = await res.json();
        alert(errData.error || 'Server rejected file upload');
      }
    } catch (err) {
      console.error(err);
      alert('Network failure uploading PCU files.');
    } finally {
      setIsUploading(false);
    }
  };

  // Helper download trigger
  const triggerDownload = (item: PCUFileItem) => {
    if (!item.fileData) {
      alert('This document contains metadata details only.');
      return;
    }
    const link = document.createElement('a');
    link.href = item.fileData;
    link.download = item.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper check if file is an image
  const isImageFile = (fileName: string, fileData?: string) => {
    const nameLower = fileName.toLowerCase();
    const hasImgExt = nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg') || nameLower.endsWith('.png') || nameLower.endsWith('.gif') || nameLower.endsWith('.webp') || nameLower.endsWith('.bmp');
    const hasImgMime = fileData && (fileData.startsWith('data:image/') || fileData.startsWith('image/'));
    return hasImgExt || hasImgMime;
  };

  // Calendar date view string (e.g. "June 11, 2026")
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Group PCU Files by Daily Folder Date (YYYY-MM-DD)
  const groupedFolders: Record<string, PCUFileItem[]> = {};
  pcuList.forEach(file => {
    // folderName matches date of upload, fell back to uploadDate substring
    const fName = file.folderName || (file.uploadDate ? file.uploadDate.substring(0, 10) : 'Unassigned');
    if (!groupedFolders[fName]) {
      groupedFolders[fName] = [];
    }
    groupedFolders[fName].push(file);
  });

  // Extract folder keys
  const folderNames = Object.keys(groupedFolders).sort((a, b) => b.localeCompare(a));

  // If filterSingleDate is selected, we only show that specific date's folder or open it
  const visibleFolderKeys = filterSingleDate 
    ? folderNames.filter(name => name === filterSingleDate)
    : folderNames;

  // Filter accounts of Field Leaders
  const fieldLeaders = accounts.filter(acc => hasRole(acc, 'LEADER'));

  // Consolidate files by uploader name to prevent duplicate uploader names
  const uploaderSummary = React.useMemo(() => {
    const summaryMap: Record<string, { uploaderName: string; uploaderEmail?: string; uploadCount: number; lastUploadDate: string }> = {};
    pcuList.forEach(file => {
      if (!file.uploadedBy) return;
      // Group by normalized uploader identity (case-insensitive)
      const uploaderKey = file.uploadedBy.trim().toLowerCase();
      if (!summaryMap[uploaderKey]) {
        // Find matching email or details from accounts
        const matchedAcc = accounts.find(acc => 
          (acc.fullName || '').toLowerCase() === uploaderKey || 
          (acc.email || '').toLowerCase() === uploaderKey
        );
        summaryMap[uploaderKey] = {
          uploaderName: matchedAcc ? matchedAcc.fullName : file.uploadedBy,
          uploaderEmail: matchedAcc ? matchedAcc.email : undefined,
          uploadCount: 0,
          lastUploadDate: file.uploadDate
        };
      }
      summaryMap[uploaderKey].uploadCount += 1;
      if (new Date(file.uploadDate) > new Date(summaryMap[uploaderKey].lastUploadDate)) {
        summaryMap[uploaderKey].lastUploadDate = file.uploadDate;
      }
    });

    return Object.values(summaryMap).sort((a, b) => b.uploadCount - a.uploadCount);
  }, [pcuList, accounts]);

  return (
    <div id="pcu_file_manager_root" className="flex flex-col min-h-full bg-slate-50/50 space-y-4 sm:space-y-6">
      
      {/* 1. Header Banner & Branding */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white p-4 sm:p-6 rounded-2xl shadow-sm border border-emerald-600/10">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-y-6 translate-x-6">
          <FileText className="w-32 h-32 sm:w-48 sm:h-48" />
        </div>
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="bg-white/20 text-white text-[9px] uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-full">
              Patient Care Units
            </span>
            <h1 className="text-xl sm:text-2xl font-black mt-2 tracking-tight uppercase">
              PCU Physical Archive
            </h1>
            <p className="text-emerald-55 text-xs mt-1 max-w-xl font-medium">
              Maintain, query, and review digital files and document sheets uploaded for households, nicely categorized into Daily Folders.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            id="btn_upload_pcu"
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-emerald-700 hover:bg-emerald-50 font-extrabold transition duration-200 transform hover:scale-102 shadow-md shrink-0 cursor-pointer w-full sm:w-auto justify-center text-center self-stretch sm:self-center"
          >
            <Upload className="h-4 w-4" />
            Upload PCU Documents
          </button>
        </div>
      </div>

      {/* Persistent Notification Alert */}
      {notif && (
        <div className={`p-4 rounded-xl flex items-center justify-between shadow-xs ${notif.type === 'success' ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' : 'bg-red-50 border border-red-150 text-red-800'}`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            <Sparkles className="h-4 w-4" />
            {notif.msg}
          </div>
        </div>
      )}

      {/* Tabs navigation for Master Admins & Managers */}
      {isMasterAdminOrManager && (
        <div className="flex border-b border-slate-200">
          <button 
            onClick={() => { setActiveTab('archives'); setSelectedFolderName(null); }}
            className={`px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider relative -mb-px transition ${activeTab === 'archives' ? 'border-b-2 border-emerald-600 text-emerald-650' : 'text-slate-450 hover:text-slate-600'}`}
          >
            PCU Archives Directory
          </button>
          <button 
            onClick={() => setActiveTab('uploader')}
            className={`px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider relative -mb-px transition ${activeTab === 'uploader' ? 'border-b-2 border-emerald-600 text-emerald-650' : 'text-slate-450 hover:text-slate-600'}`}
          >
            PCU File Uploader Ledger
          </button>
        </div>
      )}

      {activeTab === 'archives' ? (
        <>
          {/* 2. Filters Widget Box - Single Date Only */}
          <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-emerald-600" />
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Exact Date Filter Widget</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Select a single upload date to open or scope folders directly</p>
                </div>
              </div>

              {/* Single Date date picker only */}
              <div className="relative w-full md:w-auto md:min-w-[200px] flex items-center gap-2">
                <Calendar className="absolute left-3.5 h-4 w-4 text-emerald-600 pointer-events-none" />
                <input
                  type="date"
                  title="Filter by Exact Upload Date Only"
                  value={filterSingleDate}
                  onChange={(e) => {
                    setFilterSingleDate(e.target.value);
                    if (e.target.value) {
                      // Automatically open this date's folder
                      setSelectedFolderName(e.target.value);
                    } else {
                      setSelectedFolderName(null);
                    }
                  }}
                  className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-100/75 border border-slate-205 focus:border-emerald-500 text-xs font-bold font-mono text-slate-700 outline-none transition"
                />
                {filterSingleDate && (
                  <button 
                    onClick={() => { setFilterSingleDate(''); setSelectedFolderName(null); }}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 text-[10.5px] font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3. Archives Directory Grid / Folders View */}
          {selectedFolderName === null ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4.5 w-4.5 text-slate-500" />
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest leading-none">Daily Folder Directories</h3>
              </div>

              {visibleFolderKeys.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 sm:p-16 text-center flex flex-col items-center justify-center space-y-3">
                  <FolderOpen className="h-10 w-10 text-slate-300 stroke-1" />
                  <h4 className="text-xs font-bold text-slate-700">No Folders Available</h4>
                  <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">No folders matches your selected date criteria. Try resetting the exact date picker, or click "Upload PCU Documents".</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {visibleFolderKeys.map(fName => {
                    const filesInFolder = groupedFolders[fName] || [];
                    return (
                      <div 
                        key={fName}
                        onClick={() => setSelectedFolderName(fName)}
                        className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-400 cursor-pointer transition flex items-start gap-4 group"
                      >
                        <div className="p-3 bg-emerald-50 text-emerald-650 rounded-xl group-hover:scale-105 transition duration-250 shrink-0">
                          <FolderOpen className="h-5 w-5 stroke-[2]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">DATE FOLDER</h4>
                          <h3 className="text-xs font-black text-slate-800 tracking-tight mt-0.5 max-w-full truncate">
                            {formatDateDisplay(fName) || 'Unassigned Date'}
                          </h3>
                          <span className="inline-flex items-center gap-1 text-[9px] text-slate-500 font-mono font-semibold mt-1 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
                            {filesInFolder.length} documents
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-350 self-center group-hover:translate-x-1 transition shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Open Folder display view */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex-1 flex flex-col">
              
              {/* Folder open state header */}
              <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                  <button 
                    onClick={() => setSelectedFolderName(null)}
                    className="p-1.5 px-2.5 text-[10px] font-bold text-slate-650 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back
                  </button>
                  <span className="text-slate-300">/</span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 min-w-0">
                    <FolderOpen className="h-4 w-4 text-emerald-600 shrink-0 select-none" />
                    <span className="truncate">Folder: <b className="text-emerald-700 font-black">{formatDateDisplay(selectedFolderName)}</b></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                    {(groupedFolders[selectedFolderName] || []).length} registered records
                  </span>
                </div>
              </div>

              {/* Data list - Responsive Grid for mobile / Table for desktop */}
              <div className="flex-1">
                {(!groupedFolders[selectedFolderName] || groupedFolders[selectedFolderName].length === 0) ? (
                  <div className="p-12 text-center text-slate-400 font-mono text-xs">This physical folder is empty.</div>
                ) : (
                  <>
                    {/* 1. Mobile Grid List (shown only on mobile screens) */}
                    <div className="block md:hidden p-3">
                      <div className="grid grid-cols-2 gap-3 max-h-[75vh] overflow-y-auto p-1">
                        {groupedFolders[selectedFolderName].map((item) => {
                          const isImg = isImageFile(item.fileName, item.fileData);
                          return (
                            <div 
                              key={item.id} 
                              className="bg-white hover:bg-slate-50/60 border border-slate-200/80 rounded-2xl p-3.5 transition flex flex-col justify-between shadow-2xs hover:shadow-xs group duration-200 relative"
                            >
                              {/* Thumbnail Preview */}
                              <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-100 flex items-center justify-center shrink-0">
                                {isImg ? (
                                  <img
                                    src={item.fileData}
                                    alt={item.fileName}
                                    className="h-full w-full object-cover cursor-zoom-in group-hover:scale-105 transition duration-300"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setViewingFile(item);
                                    }}
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="flex flex-col items-center justify-center space-y-1.5 text-rose-500 p-2 text-center select-none">
                                    <FileText className="h-7 w-7 group-hover:scale-110 transition duration-300" />
                                    <span className="text-[8.5px] font-mono font-bold tracking-widest text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                      DOC SHEET
                                    </span>
                                  </div>
                                )}
                                
                                <span className={`absolute top-2 right-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[8px] font-extrabold shadow-2xs ${
                                  item.gender === 'Female' 
                                    ? 'bg-pink-500 text-white' 
                                    : 'bg-blue-500 text-white'
                                }`}>
                                  {item.gender === 'Female' ? 'F' : 'M'}
                                </span>
                              </div>

                              {/* File Metadata Content */}
                              <div className="mt-3 flex-1 flex flex-col justify-between min-w-0">
                                <div>
                                  <h4 
                                    className="font-bold text-slate-800 text-[11px] leading-tight break-all line-clamp-2"
                                    title={item.fileName}
                                  >
                                    {item.fileName}
                                  </h4>
                                  <p className="text-[10px] text-slate-500 font-extrabold truncate mt-1 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-lg flex items-center gap-1">
                                    👤 <span className="truncate">{item.fullName}</span>
                                  </p>
                                </div>
                                
                                <div className="text-[8.5px] text-slate-450 font-medium font-mono mt-2 pt-2 border-t border-slate-100/80 space-y-0.5">
                                  <div className="flex items-center gap-1 justify-between">
                                    <span>B-Day:</span>
                                    <span className="font-bold text-slate-700 truncate max-w-[60px]">{item.birthday ? formatDateDisplay(item.birthday) : 'N/A'}</span>
                                  </div>
                                  <div className="flex items-center gap-1 justify-between truncate">
                                    <span>By:</span>
                                    <span className="font-semibold text-emerald-800 truncate max-w-[50px]">{item.uploadedBy || 'Officer'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Touch Actions min-h-[44px] */}
                              <div className="flex items-center gap-1.5 mt-3 pt-1 border-t border-slate-50">
                                <button
                                  type="button"
                                  onClick={() => setViewingFile(item)}
                                  className="flex-1 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 font-extrabold text-[10px] transition cursor-pointer flex items-center justify-center gap-1 select-none min-h-[44px]"
                                  title="View document metadata"
                                >
                                  <Eye className="h-3.5 w-3.5 shrink-0" />
                                  <span>View</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => triggerDownload(item)}
                                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-150 text-slate-700 font-bold transition cursor-pointer flex items-center justify-center select-none min-h-[44px] min-w-[44px]"
                                  title="Download PCU document"
                                >
                                  <Download className="h-3.5 w-3.5 shrink-0" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Desktop Data list Table (hidden on mobile screens) */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 text-[10px] uppercase font-bold tracking-wider select-none">
                            <th className="py-3 px-5">PCU PHYSICAL DOCUMENT</th>
                            <th className="py-3 px-5">ASSOCIATED CITIZEN</th>
                            <th className="py-3 px-5">GENDER</th>
                            <th className="py-3 px-5">BIRTHDAY</th>
                            <th className="py-3 px-5">UPLOAD TIMESTAMP</th>
                            <th className="py-3 px-5">REGISTERED OFFICER</th>
                            <th className="py-3 px-5 text-center">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          {groupedFolders[selectedFolderName].map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/60 transition group">
                              <td className="py-3.5 px-5">
                                <div className="flex items-center gap-2.5">
                                  {isImageFile(item.fileName, item.fileData) ? (
                                    <img
                                      src={item.fileData}
                                      alt={item.fileName}
                                      className="h-10 w-10 object-cover rounded-lg border border-slate-200 cursor-zoom-in hover:brightness-95 transition shrink-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewingFile(item);
                                      }}
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="p-2 bg-rose-50 rounded-lg group-hover:scale-105 transition-transform shrink-0">
                                      <FileText className="h-4 w-4 text-rose-500" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-800 truncate max-w-[180px] text-xs">
                                      {item.fileName}
                                    </p>
                                    <span className="text-[9px] text-slate-400 font-mono">
                                      ID: {item.id.substring(0,8)}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-5">
                                <div className="flex items-center gap-2">
                                  <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                  <span className="font-extrabold text-slate-700 text-xs truncate max-w-[160px]">{item.fullName}</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-5">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shadow-2xs ${item.gender === 'Female' ? 'bg-pink-50 border border-pink-100 text-pink-700' : 'bg-blue-50 border border-blue-105 text-blue-700'}`}>
                                  {item.gender || 'Male'}
                                </span>
                              </td>
                              <td className="py-3.5 px-5 font-bold text-slate-500">
                                {item.birthday ? formatDateDisplay(item.birthday) : 'Unavailable'}
                              </td>
                              <td className="py-3.5 px-5 font-mono text-[10px] text-slate-450">
                                {item.uploadDate ? new Date(item.uploadDate).toLocaleString() : 'Unavailable'}
                              </td>
                              <td className="py-3.5 px-5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-extrabold border border-emerald-100">
                                  {item.uploadedBy || 'Field Officer'}
                                </span>
                              </td>
                              <td className="py-3.5 px-5 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setViewingFile(item)}
                                    className="p-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 font-bold transition cursor-pointer"
                                    title="View document metadata summary"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => triggerDownload(item)}
                                    className="p-1.5 rounded-lg bg-slate-150 text-slate-700 hover:bg-slate-200 font-bold transition cursor-pointer"
                                    title="Download PCU file attachment"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

            </div>
          )}
        </>
      ) : (
        /* PCU File Uploader Tab available to Master Admin & Manager only */
        <div className="space-y-6">
          
          {/* Base rate edit box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-205 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-3 bg-indigo-50 text-indigo-650 rounded-xl">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Configure Base PCU File Rate</h3>
                <p className="text-[10px] text-slate-400 font-medium">Configure equivalent compensation payment amount per valid physical document uploaded.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-450 text-xs font-bold">₱</span>
                <input 
                  type="number"
                  value={baseRate}
                  onChange={(e) => setBaseRate(parseFloat(e.target.value) || 0)}
                  className="bg-slate-50 border border-slate-200 rounded-xl pl-6 pr-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 w-[120px] outline-none"
                  placeholder="Base rate"
                />
              </div>
              <button 
                onClick={handleSavePcuBaseRate}
                disabled={savingRate}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-755 text-white font-extrabold text-xs rounded-xl shadow-xs hover:shadow transition disabled:bg-slate-300"
              >
                {savingRate ? 'Saving...' : 'Save Base Rate'}
              </button>
            </div>
          </div>          {/* Leaders Ledger of PCU submissions and equivalent wages */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Award className="h-4.5 w-4.5 text-indigo-600" />
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-widest leading-none">PCU File Uploader Ledger</h3>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase text-slate-400">Total Uploaders: {uploaderSummary.length}</span>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold tracking-wider select-none">
                    <th className="py-3 px-5">Uploader Name</th>
                    <th className="py-3 px-5">Base Rate per File</th>
                    <th className="py-3 px-5 font-semibold text-center">Total Uploaded Files</th>
                    <th className="py-3 px-5">Latest Activity</th>
                    <th className="py-3 px-5 text-right">Computed Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs leading-none">
                  {uploaderSummary.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 px-5 text-center text-slate-400 font-mono">
                        No PCU uploads recorded yet.
                      </td>
                    </tr>
                  ) : (
                    uploaderSummary.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/40 transition">
                        
                        <td className="py-3.5 px-5 font-bold text-slate-800">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 bg-rose-50 text-rose-650 rounded-full flex items-center justify-center font-bold text-[10px] uppercase select-none">
                              {item.uploaderName ? item.uploaderName.substring(0, 2) : 'FL'}
                            </div>
                            <div className="min-w-0">
                              <span className="block font-bold text-slate-800 text-xs">{item.uploaderName}</span>
                              {item.uploaderEmail && (
                                <span className="block font-mono text-[9px] text-slate-400">{item.uploaderEmail}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-5 text-slate-600 font-medium font-mono text-xs">
                          ₱{baseRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        <td className="py-3.5 px-5 text-center">
                          <span className="inline-flex items-center justify-center gap-1 font-extrabold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-150 font-mono">
                            {item.uploadCount} files
                          </span>
                        </td>

                        <td className="py-3.5 px-5 font-mono text-[10.5px] text-slate-500">
                          {item.lastUploadDate ? new Date(item.lastUploadDate).toLocaleString() : 'N/A'}
                        </td>

                        <td className="py-3.5 px-5 text-right font-mono font-black text-indigo-650 text-xs">
                          ₱{(item.uploadCount * baseRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* 4. Multi File Upload Modal Dialog */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[10005] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scale-up">
            
            <div className="px-6 py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Upload className="h-5 w-5" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">Multi PCU Document Uploader</h3>
                  <p className="text-[10px] text-emerald-100 font-medium">Add paper charts, scan sheets, and PDF index folders</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setUploadQueue([]);
                  setShowUploadModal(false);
                }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                
                {/* File Attachment Selector Box */}
                <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-5 text-center cursor-pointer transition relative bg-slate-50 bg-gradient-to-b from-slate-50 to-slate-100/30">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    id="inp_pcu_file_select"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    title="Select clinical PCU sheets"
                  />
                  <div className="space-y-2 pointer-events-none">
                    <div className="mx-auto h-10 w-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 animate-pulse">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 uppercase">Drag & Drop Files here or Click to Browse</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Select multiple document pages, scan images or PDFs</p>
                    </div>
                  </div>
                </div>

                {/* Queue List of selected files mapped with Full Name and Birthday */}
                {uploadQueue.length > 0 && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10.5px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <FileCheck className="h-4 w-4 text-emerald-600" />
                        Files to Index Stack ({uploadQueue.length})
                      </h4>
                      <button
                        type="button"
                        onClick={() => setUploadQueue([])}
                        className="text-[10px] font-bold text-red-650 hover:text-red-700 hover:underline"
                      >
                        Clear All List
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                      {uploadQueue.map((item, idx) => (
                        <div 
                          key={idx} 
                          className="p-3.5 bg-slate-50 rounded-2xl border border-slate-205 flex flex-col space-y-2 relative group"
                        >
                          {/* Top File Name */}
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                              <span className="font-extrabold text-slate-800 text-[11px] truncate max-w-[320px]">
                                {item.name}
                              </span>
                              <span className="text-[9px] text-slate-405 font-mono">
                                ({(item.file.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeQueueItem(idx)}
                              className="text-slate-400 hover:text-red-650 p-1 rounded-lg hover:bg-red-50 transition"
                              title="Delete sheet"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Detail inputs required for upload */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                            {/* Full Name field */}
                            <div>
                              <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">
                                Patient Full Name <span className="text-red-500">*</span>
                              </label>
                              <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-400">
                                  <User className="h-3 w-3" />
                                </span>
                                <input
                                  type="text"
                                  required
                                  value={item.fullName}
                                  placeholder="Enter exact full name..."
                                  onChange={(e) => updateQueueItem(idx, 'fullName', e.target.value)}
                                  className="w-full pl-7 pr-3 py-1.5 rounded-xl border border-slate-205 bg-white text-[11px] outline-none focus:border-emerald-500 transition"
                                />
                              </div>
                            </div>

                            {/* Birthday field */}
                            <div>
                              <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">
                                Patient Birthday <span className="text-red-500">*</span>
                              </label>
                              <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-slate-405">
                                  <Calendar className="h-3 w-3" />
                                </span>
                                <input
                                  type="date"
                                  required
                                  value={item.birthday}
                                  onChange={(e) => updateQueueItem(idx, 'birthday', e.target.value)}
                                  className="w-full pl-7 pr-3 py-1.5 rounded-xl border border-slate-205 bg-white text-[11px] outline-none focus:border-emerald-500 text-slate-700 transition"
                                />
                              </div>
                            </div>

                            {/* Gender field */}
                            <div>
                              <label className="block text-[9px] uppercase font-bold text-slate-500 mb-1">
                                Patient Gender <span className="text-red-500">*</span>
                              </label>
                              <select
                                required
                                value={item.gender || 'Male'}
                                onChange={(e) => updateQueueItem(idx, 'gender', e.target.value)}
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-205 bg-white text-[11px] outline-none focus:border-emerald-500 text-slate-700 transition"
                              >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                )}

              </div>

              {/* Action Sheet buttons */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setUploadQueue([]);
                    setShowUploadModal(false);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadQueue.length === 0 || isUploading}
                  className={`px-5 py-2.5 rounded-xl shadow-md text-xs font-extrabold text-white transition ${
                    uploadQueue.length === 0 || isUploading
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 cursor-pointer'
                  }`}
                >
                  {isUploading ? 'Registering Uploads...' : `Upload ${uploadQueue.length || ''} PCU Document(s)`}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 5. Document Viewer / Details Metadata Modal */}
      {viewingFile && (
        <div className="fixed inset-0 z-[10005] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`bg-white rounded-3xl border border-slate-100 shadow-2xl w-full ${isImageFile(viewingFile.fileName, viewingFile.fileData) ? 'max-w-2xl' : 'max-w-md'} overflow-hidden animate-scale-up`}>
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-rose-50 text-rose-500 rounded-lg">
                  <FileText className="h-4.5 w-4.5" />
                </div>
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Indexed File Sheet</h3>
              </div>
              <button 
                type="button"
                onClick={() => setViewingFile(null)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-205 cursor-pointer transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {isImageFile(viewingFile.fileName, viewingFile.fileData) && viewingFile.fileData && (
                <div id="pcu-image-preview-container" className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center p-2 shadow-xs group relative">
                  <img
                    src={viewingFile.fileData}
                    alt={viewingFile.fileName}
                    className="max-h-[350px] max-w-full object-contain rounded-lg transition-transform group-hover:scale-[1.01]"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 right-3 bg-slate-950/75 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-1 rounded-lg">
                    Full Preview
                  </div>
                </div>
              )}

              <div className="bg-slate-100/50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
                <FileText className="h-8 w-8 text-rose-500 select-none shrink-0" />
                <div className="truncate flex-1 min-w-0">
                  <h4 className="font-extrabold text-slate-800 text-xs truncate">{viewingFile.fileName}</h4>
                  <span className="text-[9px] text-slate-400 font-mono block mt-0.5">DB ARCHIVE ID: {viewingFile.id}</span>
                </div>
              </div>

              <div className="divide-y divide-slate-100 space-y-3 text-[11px]">
                
                <div className="pt-2 flex justify-between items-center gap-2">
                  <span className="text-slate-450 uppercase tracking-wider text-[9px] font-bold">Associated Member</span>
                  <span className="font-extrabold text-slate-900 text-[11.5px] text-right">{viewingFile.fullName}</span>
                </div>

                <div className="pt-3 flex justify-between items-center gap-2">
                  <span className="text-slate-455 uppercase tracking-wider text-[9px] font-bold">Gender</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-black ${viewingFile.gender === 'Female' ? 'bg-pink-50 border border-pink-100 text-pink-700 animate-pulse' : 'bg-blue-50 border border-blue-105 text-blue-700'}`}>
                    {viewingFile.gender || 'Male'}
                  </span>
                </div>

                <div className="pt-3 flex justify-between items-center gap-2">
                  <span className="text-slate-455 uppercase tracking-wider text-[9px] font-bold">Birthdate</span>
                  <span className="font-bold text-slate-800">
                    {viewingFile.birthday ? formatDateDisplay(viewingFile.birthday) : 'N/A'}
                  </span>
                </div>

                <div className="pt-3 flex justify-between items-center gap-2">
                  <span className="text-slate-455 uppercase tracking-wider text-[9px] font-bold">Registration Timestamp</span>
                  <span className="font-semibold text-slate-700">
                    {viewingFile.uploadDate ? new Date(viewingFile.uploadDate).toLocaleString() : 'N/A'}
                  </span>
                </div>

                <div className="pt-3 flex justify-between items-center gap-2">
                  <span className="text-slate-455 uppercase tracking-wider text-[9px] font-bold">Registered Officer</span>
                  <span className="font-bold text-slate-800">{viewingFile.uploadedBy}</span>
                </div>

              </div>

              {/* Action triggers */}
              <div className="pt-4 flex items-center justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setViewingFile(null)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Close Metadata
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerDownload(viewingFile);
                    setViewingFile(null);
                  }}
                  className="flex items-center gap-1.5 px-4.5 py-2 bg-emerald-600 hover:bg-emerald-505 text-white font-extrabold rounded-xl shadow-xs hover:shadow transition cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Fetch File Download
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
