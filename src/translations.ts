export const translations = {
    en: {
        // Global
        appName: 'ADB Compass',
        version: 'v0.1.0',

        // App.tsx
        selectDeviceToInstall: 'Select a device to install',
        connectDevices: 'Connect Android devices to get started',

        // Settings
        settings: 'Settings',
        managePrefs: 'Manage application preferences',
        appearance: 'Appearance',
        appTheme: 'App Theme',
        selectTheme: 'Select your preferred interface style',
        adbConfig: 'ADB Configuration',
        customPath: 'Custom ADB Path',
        bundledAdb: 'Using bundled ADB',
        browse: 'Browse',
        leaveEmpty: 'Leave empty to use the bundled Android Debug Bridge',
        general: 'General',
        language: 'Language',
        changeLang: 'Change application language',
        notifications: 'Notifications',
        showNotif: 'Show system notifications for device events',
        about: 'About',
        aboutDesc: 'ADB Compass is a modern tool for managing Android devices.',
        checkUpdates: 'Check for updates',
        logs: 'Logs',
        viewLogs: 'View Application Logs',
        reportIssue: 'Report an Issue',
        light: 'Light',
        dark: 'Dark',
        system: 'System',

        // Device List & Status
        noDevices: 'No devices connected',
        refresh: 'Refresh',
        authorizing: 'Authorizing...',
        unauthorized: 'Unauthorized',
        offline: 'Offline',
        connecting: 'Connecting...',
        searching: 'Searching for devices...',
        ready: 'Ready',
        installApk: 'Install APK',
        dropApkHere: 'Drop APK here',
        selectApk: 'Select APK',
        installing: 'Installing...',
        installSuccess: 'Installed successfully',
        installFailed: 'Installation failed',
        deviceConnected: 'Device connected',
        deviceDisconnected: 'Device disconnected',
        connectionError: 'Connection Error',
        connectedDevices: 'Connected Devices',

        // Hints
        hint1: 'Enable Developer Options on your device',
        hint2: 'Turn on USB Debugging',
        hint3: 'Connect device via USB cable',
        hint4: 'Accept the debugging prompt on device',

        // Requirement Checklist
        checking: 'Checking...',
        readyToInstall: 'Ready to install',
        issuesFound: 'issues found',
        issue: 'issue',
        issues: 'issues',

        // Requirement Names (IDs mapped to keys)
        req_developer_options: 'Developer Options',
        req_usb_debugging: 'USB Debugging',
        req_unknown_sources: 'Install Unknown Apps',
        req_auth: 'Device Authorization',

        // Install Button
        btnInstall: 'Install',
        btnInstalling: 'Installing...',
        btnInstalled: 'Installed',
        btnFailed: 'Failed',
        apkInstalled: 'APK installed successfully',
        apkInstallFailed: 'Installation failed'
    },
    vi: {
        // Global
        appName: 'ADB Compass',
        version: 'v0.1.0',

        // App.tsx
        selectDeviceToInstall: 'Chọn thiết bị để cài đặt',
        connectDevices: 'Kết nối thiết bị Android để bắt đầu',

        // Settings
        settings: 'Cài đặt',
        managePrefs: 'Quản lý tùy chọn ứng dụng',
        appearance: 'Giao diện',
        appTheme: 'Chủ đề',
        selectTheme: 'Chọn phong cách giao diện của bạn',
        adbConfig: 'Cấu hình ADB',
        customPath: 'Đường dẫn ADB tùy chỉnh',
        bundledAdb: 'Sử dụng ADB tích hợp',
        browse: 'Chọn',
        leaveEmpty: 'Để trống để sử dụng Android Debug Bridge tích hợp',
        general: 'Chung',
        language: 'Ngôn ngữ',
        changeLang: 'Thay đổi ngôn ngữ ứng dụng',
        notifications: 'Thông báo',
        showNotif: 'Hiển thị thông báo hệ thống cho các sự kiện thiết bị',
        about: 'Giới thiệu',
        aboutDesc: 'ADB Compass là công cụ hiện đại để quản lý thiết bị Android.',
        checkUpdates: 'Kiểm tra cập nhật',
        logs: 'Nhật ký',
        viewLogs: 'Xem nhật ký ứng dụng',
        reportIssue: 'Báo cáo sự cố',
        light: 'Sáng',
        dark: 'Tối',
        system: 'Hệ thống',

        // Device List & Status
        noDevices: 'Không có thiết bị nào',
        refresh: 'Làm mới',
        authorizing: 'Đang xác thực...',
        unauthorized: 'Chưa xác thực',
        offline: 'Ngoại tuyến',
        connecting: 'Đang kết nối...',
        searching: 'Đang tìm kiếm thiết bị...',
        ready: 'Sẵn sàng',
        installApk: 'Cài đặt APK',
        dropApkHere: 'Thả file APK vào đây',
        selectApk: 'Chọn APK',
        installing: 'Đang cài đặt...',
        installSuccess: 'Cài đặt thành công',
        installFailed: 'Cài đặt thất bại',
        deviceConnected: 'Thiết bị đã kết nối',
        deviceDisconnected: 'Thiết bị đã ngắt kết nối',
        connectionError: 'Lỗi kết nối',
        connectedDevices: 'Thiết bị đã kết nối',

        // Hints
        hint1: 'Bật Tùy chọn nhà phát triển trên thiết bị',
        hint2: 'Bật Gỡ lỗi USB (USB Debugging)',
        hint3: 'Kết nối thiết bị bằng cáp USB',
        hint4: 'Chấp nhận lời nhắc gỡ lỗi trên thiết bị',

        // Requirement Checklist
        checking: 'Đang kiểm tra...',
        readyToInstall: 'Sẵn sàng cài đặt',
        issuesFound: 'vấn đề được tìm thấy',
        issue: 'vấn đề',
        issues: 'vấn đề',

        // Requirement Names
        req_developer_options: 'Tùy chọn nhà phát triển',
        req_usb_debugging: 'Gỡ lỗi USB',
        req_unknown_sources: 'Cài đặt ứng dụng không rõ nguồn gốc',
        req_auth: 'Xác thực thiết bị',

        // Install Button
        btnInstall: 'Cài đặt',
        btnInstalling: 'Đang cài...',
        btnInstalled: 'Đã cài xong',
        btnFailed: 'Thất bại',
        apkInstalled: 'APK đã được cài đặt thành công',
        apkInstallFailed: 'Cài đặt thất bại'
    }
};

export type Language = keyof typeof translations;
