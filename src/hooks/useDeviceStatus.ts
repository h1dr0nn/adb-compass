import { useLanguage } from '../contexts/LanguageContext';
import { DeviceStatus, getDeviceStatusText } from '../types';

export function useDeviceStatus() {
    const { t } = useLanguage();

    const getStatusTranslation = (status: DeviceStatus) => {
        if (status === 'Device') return t.ready;
        if (status === 'Unauthorized') return t.unauthorized;
        if (status === 'Offline') return t.offline;

        if (typeof status === 'object' && 'Unknown' in status) {
            const unknown = status.Unknown;
            if (unknown === 'authorizing') return t.authorizing;
            if (unknown === 'connecting') return t.connecting;
            // Capitalize for other unknown states
            return unknown.charAt(0).toUpperCase() + unknown.slice(1);
        }

        // Fallback to the basic helper if needed, but it mostly returns "Connected/Offline/Unauthorized"
        const basicText = getDeviceStatusText(status);
        if (basicText === 'Connected') return t.ready;
        if (basicText === 'Unauthorized') return t.unauthorized;
        if (basicText === 'Offline') return t.offline;

        return basicText;
    };

    return { getStatusTranslation };
}
