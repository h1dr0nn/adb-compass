import { useLanguage } from "./useLanguage";
import { DeviceStatus, getDeviceStatusText } from "../types";

export function useDeviceStatus() {
  const { t } = useLanguage();

  const getStatusTranslation = (status: DeviceStatus) => {
    if (status === "Device") return t.ready;
    if (status === "Unauthorized") return t.unauthorized;
    if (status === "Offline") return t.offline;

    if (typeof status === "object" && "Unknown" in status) {
      const unknown = status.Unknown;
      if (unknown === "authorizing") return t.authorizing;
      if (unknown === "connecting") return t.connecting;
      return unknown.charAt(0).toUpperCase() + unknown.slice(1);
    }

    const basicText = getDeviceStatusText(status);
    if (basicText === "Connected") return t.ready;
    if (basicText === "Unauthorized") return t.unauthorized;
    if (basicText === "Offline") return t.offline;

    return basicText;
  };

  return { getStatusTranslation };
}
