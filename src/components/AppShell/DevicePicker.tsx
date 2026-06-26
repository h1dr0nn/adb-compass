import { Smartphone } from "lucide-react";
import { Select } from "../ui/Select";
import { useDeviceStore } from "../../stores/deviceStore";

/** Global device selector shown in the top bar. Drives `selectedDeviceId`
 * which Logcat, Terminal and quick actions read from. */
export function DevicePicker() {
  const devices = useDeviceStore((s) => s.devices);
  const selectedDeviceId = useDeviceStore((s) => s.selectedDeviceId);
  const setSelectedDevice = useDeviceStore((s) => s.setSelectedDevice);

  const options = devices.map((d) => ({
    value: d.id,
    label: d.model || d.id,
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
        placeholder={devices.length ? "Select device..." : "No devices"}
        disabled={devices.length === 0}
      />
    </div>
  );
}
