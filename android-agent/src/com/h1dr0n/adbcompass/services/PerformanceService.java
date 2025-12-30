package com.h1dr0n.adbcompass.services;

import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.InputStreamReader;

public class PerformanceService {
    private long lastTotalCpu = 0;
    private long lastIdleCpu = 0;

    public JSONObject getSystemStats() {
        JSONObject stats = new JSONObject();
        try {
            stats.put("cpu", getCpuUsage());
            stats.put("ram", getMemoryInfo());
            stats.put("battery", getBatteryInfo());
        } catch (Exception e) {
            try {
                stats.put("error", e.getMessage());
            } catch (Exception ignored) {
            }
        }
        return stats;
    }

    private double getCpuUsage() {
        try (BufferedReader reader = new BufferedReader(new FileReader("/proc/stat"))) {
            String line = reader.readLine();
            if (line != null && line.startsWith("cpu")) {
                String[] parts = line.split("\\s+");
                long user = Long.parseLong(parts[1]);
                long nice = Long.parseLong(parts[2]);
                long system = Long.parseLong(parts[3]);
                long idle = Long.parseLong(parts[4]);
                long iowait = Long.parseLong(parts[5]);
                long irq = Long.parseLong(parts[6]);
                long softirq = Long.parseLong(parts[7]);

                long currentTotal = user + nice + system + idle + iowait + irq + softirq;
                long currentIdle = idle;

                if (lastTotalCpu != 0) {
                    long totalDiff = currentTotal - lastTotalCpu;
                    long idleDiff = currentIdle - lastIdleCpu;
                    double usage = (1.0 - (double) idleDiff / totalDiff) * 100.0;

                    lastTotalCpu = currentTotal;
                    lastIdleCpu = currentIdle;
                    return Math.round(usage * 100.0) / 100.0;
                }

                lastTotalCpu = currentTotal;
                lastIdleCpu = currentIdle;
            }
        } catch (Exception e) {
            return -1.0;
        }
        return 0.0;
    }

    private JSONObject getMemoryInfo() {
        JSONObject ram = new JSONObject();
        try (BufferedReader reader = new BufferedReader(new FileReader("/proc/meminfo"))) {
            String line;
            long total = 0, free = 0, buffers = 0, cached = 0;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("MemTotal:"))
                    total = parseMemLine(line);
                if (line.startsWith("MemFree:"))
                    free = parseMemLine(line);
                if (line.startsWith("Buffers:"))
                    buffers = parseMemLine(line);
                if (line.startsWith("Cached:"))
                    cached = parseMemLine(line);
            }
            long used = total - free - buffers - cached;
            ram.put("total", total);
            ram.put("used", used);
            ram.put("free", free);
        } catch (Exception e) {
            // fallback
        }
        return ram;
    }

    private long parseMemLine(String line) {
        return Long.parseLong(line.replaceAll("\\D+", ""));
    }

    private JSONObject getBatteryInfo() {
        JSONObject battery = new JSONObject();
        try {
            // Reading from sysfs as a fallback since we might not have a full
            // Context/Intent system
            battery.put("level", readSysFile("/sys/class/power_supply/battery/capacity"));
            battery.put("temp", Double.parseDouble(readSysFile("/sys/class/power_supply/battery/temp")) / 10.0);
            battery.put("status", readSysFile("/sys/class/power_supply/battery/status"));
        } catch (Exception e) {
            // ignore
        }
        return battery;
    }

    private String readSysFile(String path) {
        try (BufferedReader reader = new BufferedReader(new FileReader(path))) {
            return reader.readLine().trim();
        } catch (Exception e) {
            return "unknown";
        }
    }
}
