import packageJson from '../package.json';

export const translations = {
    en: {
        // Global
        appName: 'ADB Compass',
        version: `Version: ${packageJson.version}`,

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
        req_usb_debug_security: 'USB Debugging (Security)',
        advancedActions: 'Advanced Actions',

        // Install Button
        btnInstall: 'Install',
        btnInstalling: 'Installing...',
        btnInstalled: 'Installed',
        btnFailed: 'Failed',
        apkInstalled: 'APK installed successfully',
        apkInstallFailed: 'Installation failed',

        // Device Actions
        deviceInfo: 'Device Info',
        model: 'Model',
        androidVersion: 'Android Version',
        sdkVersion: 'SDK Version',
        battery: 'Battery',
        charging: 'Charging',
        deviceId: 'Device ID',

        // Uninstall Modal
        uninstallApp: 'Uninstall App',
        searchPackages: 'Search packages...',
        showSystemApps: 'Show system apps',
        noPackagesFound: 'No packages found',
        confirmUninstall: 'Are you sure you want to uninstall',
        uninstalling: 'Uninstalling...',
        uninstallSuccess: 'Uninstalled successfully',
        uninstallFailed: 'Uninstall failed',
        cancel: 'Cancel',
        confirm: 'Confirm',

        // Reboot Modal
        rebootDevice: 'Reboot Device',
        normalReboot: 'Normal Reboot',
        normalRebootDesc: 'Restart the device normally',
        recoveryMode: 'Recovery Mode',
        recoveryModeDesc: 'Boot into recovery mode',
        bootloaderMode: 'Bootloader Mode',
        bootloaderModeDesc: 'Boot into bootloader/fastboot',
        confirmReboot: 'The device will restart. Continue?',

        // Input Text Modal
        inputText: 'Input Text',
        textPlaceholder: 'Enter text to send to device...',
        sendText: 'Send',
        textSent: 'Text sent successfully',
        textFailed: 'Failed to send text',

        // File Transfer Modal
        fileTransfer: 'File Transfer',
        uploadFile: 'Upload',
        downloadFile: 'Download',
        deleteFile: 'Delete',
        createFolder: 'New Folder',
        emptyFolder: 'This folder is empty',
        confirmDelete: 'Are you sure you want to delete',
        folderName: 'Folder name',
        create: 'Create',

        // Advanced/Tools Tab
        tabAdvanced: 'Advanced',
        selectFolder: 'Select Folder',
        wirelessAdb: 'Wireless ADB',
        wirelessAdbDesc: 'Connect devices over WiFi',
        logcat: 'Logcat',
        logcatDesc: 'View device logs',
        terminal: 'Terminal',
        terminalDesc: 'Execute shell commands'
    },
    vi: {
        // Global
        appName: 'ADB Compass',
        version: `Phiên bản: ${packageJson.version}`,

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
        req_usb_debug_security: 'Gỡ lỗi USB (Bảo mật)',
        advancedActions: 'Tính năng nâng cao',

        // Install Button
        btnInstall: 'Cài đặt',
        btnInstalling: 'Đang cài...',
        btnInstalled: 'Đã cài xong',
        btnFailed: 'Thất bại',
        apkInstalled: 'APK đã được cài đặt thành công',
        apkInstallFailed: 'Cài đặt thất bại',

        // Device Actions
        deviceInfo: 'Thông tin thiết bị',
        model: 'Model',
        androidVersion: 'Phiên bản Android',
        sdkVersion: 'Phiên bản SDK',
        battery: 'Pin',
        charging: 'Đang sạc',
        deviceId: 'ID thiết bị',

        // Uninstall Modal
        uninstallApp: 'Gỡ cài đặt',
        searchPackages: 'Tìm ứng dụng...',
        showSystemApps: 'Hiển thị ứng dụng hệ thống',
        noPackagesFound: 'Không tìm thấy ứng dụng',
        confirmUninstall: 'Bạn có chắc muốn gỡ cài đặt',
        uninstalling: 'Đang gỡ...',
        uninstallSuccess: 'Gỡ cài đặt thành công',
        uninstallFailed: 'Gỡ cài đặt thất bại',
        cancel: 'Hủy',
        confirm: 'Xác nhận',

        // Reboot Modal
        rebootDevice: 'Khởi động lại',
        normalReboot: 'Khởi động lại thường',
        normalRebootDesc: 'Khởi động lại thiết bị bình thường',
        recoveryMode: 'Chế độ Recovery',
        recoveryModeDesc: 'Khởi động vào chế độ recovery',
        bootloaderMode: 'Chế độ Bootloader',
        bootloaderModeDesc: 'Khởi động vào bootloader/fastboot',
        confirmReboot: 'Thiết bị sẽ khởi động lại. Tiếp tục?',

        // Input Text Modal
        inputText: 'Nhập văn bản',
        textPlaceholder: 'Nhập văn bản để gửi đến thiết bị...',
        sendText: 'Gửi',
        textSent: 'Gửi văn bản thành công',
        textFailed: 'Gửi văn bản thất bại',

        // File Transfer Modal
        fileTransfer: 'Truyền tệp',
        uploadFile: 'Tải lên',
        downloadFile: 'Tải xuống',
        deleteFile: 'Xóa',
        createFolder: 'Thư mục mới',
        emptyFolder: 'Thư mục trống',
        confirmDelete: 'Bạn có chắc muốn xóa',
        folderName: 'Tên thư mục',
        create: 'Tạo',

        // Advanced/Tools Tab
        tabAdvanced: 'Nâng cao',
        selectFolder: 'Chọn thư mục',
        wirelessAdb: 'Wireless ADB',
        wirelessAdbDesc: 'Kết nối thiết bị qua WiFi',
        logcat: 'Logcat',
        logcatDesc: 'Xem nhật ký thiết bị',
        terminal: 'Terminal',
        terminalDesc: 'Thực thi lệnh shell'
    }
};

export type Language = keyof typeof translations;
