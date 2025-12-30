package com.h1dr0n.adbcompass.services;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;

public class FileService {

    public JSONArray listDirectory(String path) {
        JSONArray results = new JSONArray();
        File dir = new File(path);

        if (!dir.exists() || !dir.isDirectory()) {
            return results;
        }

        File[] files = dir.listFiles();
        if (files == null) {
            return results;
        }

        for (File file : files) {
            try {
                JSONObject item = new JSONObject();
                item.put("name", file.getName());
                item.put("size", file.length());
                item.put("is_dir", file.isDirectory());
                item.put("last_modified", file.lastModified());
                results.put(item);
            } catch (Exception e) {
                // Skip problematic files
            }
        }

        return results;
    }
}
