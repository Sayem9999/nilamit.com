'use client';

import { useState } from 'react';
import { Trash2, AlertTriangle, AlertCircle, Download, FileText, Database, Upload, Loader2, Megaphone, Landmark } from 'lucide-react';
import { adminWipeTestData, exportTransactionsCSV, exportDatabaseBackup, importDatabaseBackup } from '@/actions/admin-system';
import { getSystemConfig, updateSystemConfig } from '@/actions/admin-content';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { SystemConfig } from '@/types';

export function SystemTab() {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Operational Config State
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Backup & Restore states
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [wipeBeforeRestore, setWipeBeforeRestore] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [backupEntries, setBackupEntries] = useState<unknown[] | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      setIsLoadingConfig(true);
      const res = await getSystemConfig();
      if (res.success && res.data) {
        setConfig(res.data);
      }
      setIsLoadingConfig(false);
    };
    fetchConfig();
  }, []);

  const handleToggle = async (field: keyof SystemConfig, value: boolean | number | null) => {
    if (!config) return;
    const previousValue = config[field];
    const updatedConfig = { ...config, [field]: value } as SystemConfig;
    setConfig(updatedConfig);
    
    const loadingToast = toast.loading(`Updating ${field}...`);
    try {
      const res = await updateSystemConfig({
        [field]: value
      });
      if (res.success) {
        toast.success('Operational mode updated!', { id: loadingToast });
      } else {
        toast.error(res.error?.message || 'Failed to update setting', { id: loadingToast });
        setConfig({ ...config, [field]: previousValue });
      }
    } catch {
      toast.error('An error occurred while updating setting', { id: loadingToast });
      setConfig({ ...config, [field]: previousValue });
    }
  };

  const handleTextChange = async (field: keyof SystemConfig, value: string | null) => {
    if (!config) return;
    const previousValue = config[field];
    const updatedConfig = { ...config, [field]: value } as SystemConfig;
    setConfig(updatedConfig);
    
    try {
      const res = await updateSystemConfig({ [field]: value });
      if (res.success) {
        toast.success(`${field} updated successfully!`);
      } else {
        toast.error(res.error?.message || 'Failed to update setting');
        setConfig({ ...config, [field]: previousValue });
      }
    } catch {
      toast.error('An error occurred while updating setting');
      setConfig({ ...config, [field]: previousValue });
    }
  };

  const handleWipe = async () => {
    setIsPending(true);
    try {
      const result = await adminWipeTestData();
      if (result.success) {
        setStatus('success');
        setMessage(result.data?.message || 'Success');
      } else {
        setStatus('error');
        setMessage(result.error?.message || 'Failed to wipe data');
      }
    } catch (e: unknown) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Unknown error');
    } finally {
        setIsPending(false);
        setIsConfirmOpen(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportTransactionsCSV();
      if (result.success && result.data?.data) {
        const blob = new Blob([result.data.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nilamit-transactions-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert(result.error?.message || 'Export failed');
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setBackupEntries(null);
      return;
    }
    setSelectedFile(file);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          setBackupEntries(json);
        } else {
          toast.error('Invalid backup format: Must be a JSON array of documents');
          setSelectedFile(null);
          setBackupEntries(null);
        }
      } catch {
        toast.error('Failed to parse JSON file');
        setSelectedFile(null);
        setBackupEntries(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExportBackup = async () => {
    setIsExportingBackup(true);
    try {
      const result = await exportDatabaseBackup();
      if (result.success && result.data?.data) {
        const blob = new Blob([result.data.data], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nilamit-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('Database backup exported successfully');
      } else {
        toast.error(result.error?.message || 'Backup failed');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Backup failed');
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!backupEntries) {
      toast.error('No backup data loaded');
      return;
    }
    setIsImportingBackup(true);
    setIsRestoreConfirmOpen(false);
    try {
      const result = await importDatabaseBackup({
        entries: backupEntries,
        wipeFirst: wipeBeforeRestore,
      });
      
      if (result.success) {
        toast.success(`Successfully restored ${result.data?.successCount} documents!`);
        setSelectedFile(null);
        setBackupEntries(null);
        const fileInput = document.getElementById('backup-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        toast.error(result.error?.message || 'Restore failed');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setIsImportingBackup(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Global Announcement */}
      <div className="bg-white rounded-md border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-300 mt-6">
        <div className="flex items-start gap-4">
          <div className="bg-orange-50 p-3 rounded-xl">
            <Megaphone className="w-8 h-8 text-orange-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-lg text-gray-900">Global Announcement Banner</h3>
            <p className="text-sm text-gray-500 mt-1">
              Push a site-wide alert banner across all pages.
            </p>

            {isLoadingConfig ? (
              <div className="mt-8 flex items-center justify-center py-6 text-sm text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading...
              </div>
            ) : !config ? null : (
              <div className="mt-8 space-y-6 border-t border-gray-50 pt-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between p-4 bg-gray-50/50 hover:bg-gray-50 rounded-md border border-gray-100/80 transition-all duration-200">
                    <div className="space-y-1 pr-4">
                      <span className="font-semibold text-gray-900 text-sm">Enable Announcement</span>
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Toggle the visibility of the global announcement banner.
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggle('showAnnouncement', !(config.showAnnouncement ?? false))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        (config.showAnnouncement ?? false) ? 'bg-primary-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          (config.showAnnouncement ?? false) ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-gray-700">Announcement Text</label>
                    <textarea
                      value={config.announcement || ''}
                      onChange={(e) => setConfig({ ...config, announcement: e.target.value })}
                      onBlur={(e) => handleTextChange('announcement', e.target.value)}
                      placeholder="Enter the announcement message..."
                      className="w-full min-h-[100px] p-3 text-sm border border-gray-200 rounded-xl focus:ring-primary-500 focus:border-primary-500 text-gray-900"
                    />
                    <p className="text-xs text-gray-500">Saves automatically when you click outside the box.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Treasury Configuration */}
      <div className="bg-white rounded-md border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow duration-300 mt-6">
        <div className="flex items-start gap-4">
          <div className="bg-emerald-50 p-3 rounded-xl">
            <Landmark className="w-8 h-8 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-lg text-gray-900">Treasury Configuration</h3>
            <p className="text-sm text-gray-500 mt-1">
              Set the official MFS numbers used for receiving advance-payment deposits.
            </p>

            {isLoadingConfig ? (
              <div className="mt-8 flex items-center justify-center py-6 text-sm text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading...
              </div>
            ) : !config ? null : (
              <div className="mt-8 space-y-6 border-t border-gray-50 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-gray-700">bKash Treasury Number</label>
                    <input
                      type="text"
                      value={config.treasuryBkash || ''}
                      onChange={(e) => setConfig({ ...config, treasuryBkash: e.target.value })}
                      onBlur={(e) => handleTextChange('treasuryBkash', e.target.value)}
                      placeholder="e.g. 01700000000"
                      className="w-full p-3 text-sm border border-gray-200 rounded-xl focus:ring-primary-500 focus:border-primary-500 text-gray-900 font-bold"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-gray-700">Nagad Treasury Number</label>
                    <input
                      type="text"
                      value={config.treasuryNagad || ''}
                      onChange={(e) => setConfig({ ...config, treasuryNagad: e.target.value })}
                      onBlur={(e) => handleTextChange('treasuryNagad', e.target.value)}
                      placeholder="e.g. 01600000000"
                      className="w-full p-3 text-sm border border-gray-200 rounded-xl focus:ring-primary-500 focus:border-primary-500 text-gray-900 font-bold"
                    />
                  </div>

                </div>
                <p className="text-xs text-gray-500 mt-2">Saves automatically when you click outside the box.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-100 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="bg-primary-50 p-3 rounded-xl">
            <FileText className="w-8 h-8 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-lg text-gray-900">Reports & Exports</h3>
            <p className="text-sm text-gray-500 mt-1">
              Generate and download data for auditing and accounting.
            </p>

            <div className="mt-6 border-t border-gray-50 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">Transaction Report (CSV)</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm">
                    Downloads all closed auctions, final prices, winner details, and calculated commissions.
                  </p>
                </div>
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 border border-gray-200 shadow-sm"
                >
                  {isExporting ? (
                    <span className="animate-spin w-4 h-4 border-2 border-primary-600/30 border-t-primary-600 rounded-full" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isExporting ? 'Generating...' : 'Export CSV'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-100 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="bg-primary-50 p-3 rounded-xl">
            <Database className="w-8 h-8 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-lg text-gray-900">Database Backup & Restore</h3>
            <p className="text-sm text-gray-500 mt-1">
              Download complete database backups as JSON or restore database state from a backup file.
            </p>

            <div className="mt-6 space-y-6 border-t border-gray-50 pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-gray-900">Export Database Backup</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm">
                    Downloads all collections recursively, preserving original types (timestamps, references, geopoints).
                  </p>
                </div>
                <button
                  onClick={handleExportBackup}
                  disabled={isExportingBackup}
                  className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 border border-gray-200 shadow-sm active:scale-95 disabled:opacity-50"
                >
                  {isExportingBackup ? (
                    <span className="animate-spin w-4 h-4 border-2 border-primary-600/30 border-t-primary-600 rounded-full" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isExportingBackup ? 'Exporting...' : 'Export JSON'}
                </button>
              </div>

              <div className="border-t border-gray-50 pt-6">
                <h4 className="font-semibold text-gray-900">Restore Database Backup</h4>
                <p className="text-xs text-gray-500 mt-1 max-w-lg">
                  Select a previously exported JSON backup file to restore. Note that restoring may overwrite existing documents.
                </p>

                <div className="mt-4 flex flex-col md:flex-row md:items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex-1">
                    <input
                      type="file"
                      id="backup-file-input"
                      accept=".json"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="backup-file-input"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 cursor-pointer shadow-sm transition-all active:scale-95"
                    >
                      <Upload className="w-4 h-4 text-gray-500" />
                      {selectedFile ? 'Change File' : 'Select Backup File'}
                    </label>
                    {selectedFile && (
                      <span className="ml-3 text-xs font-medium text-gray-600 bg-white border border-gray-200 px-2 py-1 rounded">
                        {selectedFile.name} ({backupEntries?.length ?? 0} docs)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-600 select-none">
                      <input
                        type="checkbox"
                        checked={wipeBeforeRestore}
                        onChange={(e) => setWipeBeforeRestore(e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      Wipe DB before restoring
                    </label>

                    <button
                      onClick={() => setIsRestoreConfirmOpen(true)}
                      disabled={!backupEntries || isImportingBackup}
                      className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                      {isImportingBackup ? (
                        <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {isImportingBackup ? 'Restoring...' : 'Restore DB'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-md border border-red-100 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="bg-red-50 p-3 rounded-xl">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-lg text-gray-900">Danger Zone</h3>
            <p className="text-sm text-gray-500 mt-1">
              Destructive actions that cannot be undone. Proceed with caution.
            </p>

            <div className="mt-6 border-t border-red-50 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">Wipe All Test Data</h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm">
                    Permanently deletes ALL auctions, bids, and related images. User accounts are preserved.
                  </p>
                </div>
                <button
                  onClick={() => setIsConfirmOpen(true)}
                  disabled={isPending}
                  className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 border border-red-200"
                >
                  <Trash2 className="w-4 h-4" />
                  Wipe Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Toasts */}
      {status === 'success' && (
        <div className="bg-green-50 text-green-700 p-4 rounded-xl flex items-center gap-2 border border-green-200">
            <AlertCircle className="w-5 h-5" /> {message}
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-md shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 text-red-600 mb-4">
              <AlertTriangle className="w-8 h-8" />
              <h3 className="text-lg font-bold">Confirm Data Wipe</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you absolutely sure? This will delete <strong>ALL</strong> auctions, bids, and reports. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsConfirmOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWipe}
                disabled={isPending}
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                {isPending ? 'Wiping...' : 'Yes, Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {isRestoreConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-md shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 text-primary-600 mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
              <h3 className="text-lg font-bold">Confirm Database Restore</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Are you sure you want to restore the database from <strong>{selectedFile?.name}</strong>?
            </p>
            {wipeBeforeRestore && (
              <div className="text-red-600 text-sm font-semibold mb-6 flex items-start gap-2 bg-red-50 p-3 rounded-lg border border-red-100">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>Warning: This will permanently delete ALL current database records in all root collections and subcollections before writing the backup data.</span>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsRestoreConfirmOpen(false)}
                disabled={isImportingBackup}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreBackup}
                disabled={isImportingBackup}
                className="px-4 py-2 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
              >
                {isImportingBackup ? 'Restoring...' : 'Yes, Restore Backup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
