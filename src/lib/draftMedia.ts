const DB_NAME = 'SFC_DraftMediaDB';
const STORE_NAME = 'draft_media';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDraftMedia(
  draftId: string, 
  mediaData: { 
    attachmentsList?: any[]; 
    patientSignature?: string; 
    pmrfBackSignature?: string; 
    pmrfBackThumbmark?: string; 
  }
): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Read existing to keep track of other attributes if any
    const existingReq = store.get(draftId);
    const existing = await new Promise<any>((resolve) => {
      existingReq.onsuccess = () => resolve(existingReq.result || {});
      existingReq.onerror = () => resolve({});
    });

    const merged = {
      ...existing,
      ...mediaData
    };

    store.put(merged, draftId);
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('[IndexedDB] Failed to backup high-quality media:', err);
  }
}

export async function getDraftMedia(draftId: string): Promise<any | null> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(draftId);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.error('[IndexedDB] Failed to read backup media:', err);
    return null;
  }
}

export async function deleteDraftMedia(draftId: string): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(draftId);
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('[IndexedDB] Failed to delete backup media:', err);
  }
}

/**
 * Transparently restores any discarded/compacted media assets inside draft objects
 */
export async function restoreDraftMedia(draftObj: any): Promise<any> {
  if (!draftObj || !draftObj.id) return draftObj;
  
  const savedMedia = await getDraftMedia(draftObj.id);
  if (!savedMedia) return draftObj;

  const restored = { ...draftObj };
  restored.formData = { ...restored.formData };

  const hasCompactedAttachments = Array.isArray(restored.formData.attachmentsList) && 
    restored.formData.attachmentsList.some((att: any) => att && att.fileData === "[File Data Preserved in Cloud Upload]");

  if (hasCompactedAttachments && Array.isArray(savedMedia.attachmentsList)) {
    restored.formData.attachmentsList = savedMedia.attachmentsList;
  }

  const compactedSig = "[Signature Preserved in Cloud Upload]";
  const compactedThumb = "[Thumbmark Preserved in Cloud Upload]";

  if (restored.formData.patientSignature === compactedSig && savedMedia.patientSignature) {
    restored.formData.patientSignature = savedMedia.patientSignature;
  }
  if (restored.formData.pmrfBackSignature === compactedSig && savedMedia.pmrfBackSignature) {
    restored.formData.pmrfBackSignature = savedMedia.pmrfBackSignature;
  }
  if (restored.formData.pmrfBackThumbmark === compactedThumb && savedMedia.pmrfBackThumbmark) {
    restored.formData.pmrfBackThumbmark = savedMedia.pmrfBackThumbmark;
  }

  return restored;
}

export async function restoreDraftsList(drafts: any[]): Promise<any[]> {
  if (!Array.isArray(drafts)) return drafts;
  return Promise.all(drafts.map(d => restoreDraftMedia(d)));
}
