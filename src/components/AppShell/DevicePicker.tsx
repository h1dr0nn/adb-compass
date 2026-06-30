import { Smartphone } from "lucide-react";
import { Select } from "../ui/Select";
import { useDeviceStore } from "../../stores/deviceStore";
import { useLanguage } from "../../hooks/useLanguage";

/** Global device selector shown in the top bar. Drives `selectedDeviceId`
 * which Logcat, Terminal and quick actions read from. */
export function DevicePicker() {
  const { t } = useLanguage();
  const devices = useDeviceStore((s) => s.devices);
  const selectedDeviceId = useDeviceStore((s) => s.selectedDeviceId);
  const setSelectedDevice = useDeviceStore((s) => s.setSelectedDevice);
  const removeDevice = useDeviceStore((s) => s.removeDevice);

  const options = devices.map((d) => ({
    value: d.id,
    label: d.model || d.id,
    disabled: d.status !== "Device",
    onRemove: () => removeDevice(d.id),
    icon: (
      <Smartphone
        size={14}
        className={d.status === "Device" ? "text-accent" : "text-text-muted"}
      />
    ),
  }));

  return (
    <div className="w-44">
      <Select
        size="sm"
        options={options}
        value={selectedDeviceId ?? ""}
        onChange={setSelectedDevice}
        placeholder={devices.length ? t.selectDevicePlaceholder : t.noDevicesShort}
        disabled={devices.length === 0}
      />
    </div>
  );
}
