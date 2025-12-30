package com.h1dr0n.adbcompass.services;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Stack;

public class IndexingService {
    private static class FileEntry {
        String name;
        String path;
        boolean isDir;

        FileEntry(String name, String path, boolean isDir) {
            this.name = name;
            this.path = path;
            this.isDir = isDir;
        }
    }

    private final List<FileEntry> index = new ArrayList<>();
    private boolean isIndexing = false;

    public synchronized void buildIndex(String rootPath) {
        if (isIndexing)
            return;
        isIndexing = true;
        index.clear();

        new Thread(() -> {
            try {
                Stack<File> stack = new Stack<>();
                stack.push(new File(rootPath));

                while (!stack.isEmpty()) {
                    File current = stack.pop();
                    File[] children = current.listFiles();
                    if (children != null) {
                        for (File child : children) {
                            index.add(new FileEntry(child.getName(), child.getAbsolutePath(), child.isDirectory()));
                            if (child.isDirectory()) {
                                stack.push(child);
                            }
                        }
                    }
                    // Limit index size to prevent OOM
                    if (index.size() > 50000)
                        break;
                }
            } catch (Exception ignored) {
            } finally {
                isIndexing = false;
            }
        }).start();
    }

    public JSONArray search(String query) {
        JSONArray results = new JSONArray();
        String lowerQuery = query.toLowerCase();

        synchronized (index) {
            for (FileEntry entry : index) {
                if (entry.name.toLowerCase().contains(lowerQuery)) {
                    try {
                        JSONObject obj = new JSONObject();
                        obj.put("name", entry.name);
                        obj.put("path", entry.path);
                        obj.put("is_dir", entry.isDir);
                        results.put(obj);
                    } catch (Exception ignored) {
                    }
                }
                if (results.length() > 500)
                    break; // Limit results
            }
        }
        return results;
    }

    public boolean isIndexing() {
        return isIndexing;
    }
}
