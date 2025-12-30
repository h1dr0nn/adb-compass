package com.h1dr0n.adbcompass;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.ServerSocket;
import java.net.Socket;
import org.json.JSONObject;
import org.json.JSONArray;
import com.h1dr0n.adbcompass.services.ClipboardService;
import com.h1dr0n.adbcompass.services.InputService;
import com.h1dr0n.adbcompass.services.IndexingService;
import com.h1dr0n.adbcompass.services.FileService;
import com.h1dr0n.adbcompass.services.AppService;
import com.h1dr0n.adbcompass.services.PerformanceService;
import android.content.pm.PackageManager;

public class SocketServer {
    private final int port;
    private boolean running = true;
    private final FileService fileService;
    private final AppService appService;
    private final PerformanceService perfService;
    private final ClipboardService clipboardService;
    private final InputService inputService;
    private final IndexingService indexingService;

    public SocketServer(int port, PackageManager pm) {
        this.port = port;
        this.fileService = new FileService();
        this.appService = new AppService(pm);
        this.perfService = new PerformanceService();
        this.clipboardService = new ClipboardService();
        this.inputService = new InputService();
        this.indexingService = new IndexingService();
    }

    public void run() {
        try (ServerSocket serverSocket = new ServerSocket(port)) {
            System.out.println("Socket Server is running on port " + port);

            while (running) {
                try (Socket clientSocket = serverSocket.accept();
                        PrintWriter out = new PrintWriter(clientSocket.getOutputStream(), true);
                        BufferedReader in = new BufferedReader(new InputStreamReader(clientSocket.getInputStream()))) {

                    System.out.println("Client connected: " + clientSocket.getRemoteSocketAddress());

                    String inputLine;
                    while ((inputLine = in.readLine()) != null) {
                        try {
                            JSONObject request = new JSONObject(inputLine);
                            String type = request.optString("type", "UNKNOWN");

                            JSONObject response = handleRequest(type, request.optJSONObject("data"));
                            out.println(response.toString());

                            if ("SHUTDOWN".equals(type)) {
                                running = false;
                                break;
                            }
                        } catch (org.json.JSONException jsonEx) {
                            out.println("{\"type\":\"ERROR\",\"message\":\"JSON Error: " + jsonEx.getMessage() + "\"}");
                        } catch (Exception e) {
                            out.println("{\"type\":\"ERROR\",\"message\":\"Error: " + e.getMessage() + "\"}");
                        }
                    }
                } catch (Exception e) {
                    System.err.println("Error handling client: " + e.getMessage());
                }
            }
        } catch (Exception e) {
            System.err.println("Could not listen on port " + port);
            e.printStackTrace();
        }
    }

    private JSONObject handleRequest(String type, JSONObject data) throws org.json.JSONException {
        JSONObject response = new JSONObject();
        response.put("type", type + "_RESPONSE");

        JSONObject resultData = new JSONObject();

        switch (type) {
            case "PING":
                resultData.put("status", "PONG");
                break;

            case "GET_VERSION":
                resultData.put("version", "1.1.0"); // Updated version for Stage 2
                break;

            case "LIST_FILES":
                String path = data != null ? data.optString("path", "/") : "/";
                resultData.put("files", fileService.listDirectory(path));
                break;

            case "GET_APPS":
                boolean includeSystem = data != null ? data.optBoolean("include_system", false) : false;
                resultData.put("apps", appService.getInstalledApps(includeSystem));
                break;

            case "GET_ICON":
                String pkg = data != null ? data.optString("package", "") : "";
                String iconBase64 = appService.getAppIconBase64(pkg);
                if (iconBase64 != null) {
                    resultData.put("icon", iconBase64);
                } else {
                    resultData.put("error", "Icon not found");
                }
                break;

            case "GET_STATS":
                resultData.put("stats", perfService.getSystemStats());
                break;

            case "GET_CLIPBOARD":
                resultData.put("text", clipboardService.getClipboardText());
                break;

            case "SET_CLIPBOARD":
                String text = data != null ? data.optString("text", "") : "";
                resultData.put("success", clipboardService.setClipboardText(text));
                break;

            case "INJECT_INPUT":
                String inputType = data != null ? data.optString("input_type", "") : "";
                if ("TAP".equals(inputType)) {
                    int x = data.optInt("x", 0);
                    int y = data.optInt("y", 0);
                    resultData.put("success", inputService.injectTap(x, y));
                }
                break;

            case "INDEX_FILES":
                String root = data != null ? data.optString("path", "/sdcard") : "/sdcard";
                indexingService.buildIndex(root);
                resultData.put("status", "Indexing started");
                break;

            case "SEARCH_FILES":
                String query = data != null ? data.optString("query", "") : "";
                resultData.put("results", indexingService.search(query));
                resultData.put("is_indexing", indexingService.isIndexing());
                break;

            default:
                resultData.put("error", "Unknown command type: " + type);
                break;
        }

        response.put("data", resultData);
        return response;
    }
}
