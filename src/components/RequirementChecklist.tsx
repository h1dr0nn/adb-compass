// RequirementChecklist Component - Shows device requirement status
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { RequirementCheck } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface RequirementChecklistProps {
    deviceId: string;
    isAuthorized: boolean;
}

export function RequirementChecklist({ deviceId, isAuthorized }: RequirementChecklistProps) {
    const [requirements, setRequirements] = useState<RequirementCheck[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const { t } = useLanguage();

    useEffect(() => {
        if (isAuthorized) {
            checkRequirements();
        }
    }, [deviceId, isAuthorized]);

    const checkRequirements = async () => {
        setLoading(true);
        try {
            const checks = await invoke<RequirementCheck[]>('check_device_requirements', { deviceId });
            setRequirements(checks);
        } catch (error) {
            console.error('Failed to check requirements:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthorized) return null;

    const allPassed = requirements.every(r => r.passed);
    const failedCount = requirements.filter(r => !r.passed).length;

    // Pluralization logic for "issue/issues"
    const issueText = failedCount === 1 ? t.issue : t.issues;

    // Helper to translate requirement name based on ID
    // We assume backend returns specific IDs like 'developer_options', 'usb_debugging'
    // If not, we fall back to the name from backend.
    const getTranslatedReqName = (req: RequirementCheck) => {
        // Map backend IDs to translation keys
        // IDs must match src-tauri/src/adb/executor.rs
        if (req.id === 'developer_options') return t.req_developer_options;
        if (req.id === 'usb_debugging') return t.req_usb_debugging;
        if (req.id === 'unknown_sources') return t.req_unknown_sources;
        if (req.id === 'device_authorization') return t.req_auth;

        return req.name; // Fallback
    };

    return (
        <div className="mt-3 pt-3 border-t border-border">
            <button
                className="flex items-center justify-between w-full px-3 py-2 
                           bg-surface-elevated border border-border rounded-lg
                           text-text-secondary text-sm
                           hover:bg-surface-hover hover:border-accent
                           transition-all duration-200"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2">
                    {allPassed ? (
                        <CheckCircle2 size={16} className="text-success" />
                    ) : (
                        <Info size={16} className="text-warning" />
                    )}
                    <span>
                        {loading ? t.checking :
                            allPassed ? t.readyToInstall :
                                `${failedCount} ${issueText} found`}
                    </span>
                </div>
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        className="mt-2 space-y-2 overflow-hidden"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {requirements.map((req) => (
                            <div
                                key={req.id}
                                className={`px-3 py-2.5 rounded-lg bg-surface-elevated
                                           ${req.passed ? 'border-l-2 border-l-success' : 'border-l-2 border-l-error'}`}
                            >
                                <div className="flex items-center gap-2">
                                    {req.passed ? (
                                        <CheckCircle2 size={14} className="text-success" />
                                    ) : (
                                        <XCircle size={14} className="text-error" />
                                    )}
                                    <span className="text-sm font-medium text-text-primary">{getTranslatedReqName(req)}</span>
                                </div>
                                {!req.passed && req.hint && (
                                    <p className="mt-2 ml-5 text-xs text-text-muted leading-relaxed">{req.hint}</p>
                                )}
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
