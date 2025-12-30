package com.h1dr0n.adbcompass.services;

import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.util.Base64;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.util.List;

public class AppService {
    private final PackageManager pm;

    public AppService(PackageManager pm) {
        this.pm = pm;
    }

    public JSONArray getInstalledApps(boolean includeSystem) {
        JSONArray results = new JSONArray();
        if (pm == null)
            return results;

        List<ApplicationInfo> apps = pm.getInstalledApplications(PackageManager.GET_META_DATA);
        for (ApplicationInfo app : apps) {
            try {
                // Filter system apps if requested
                boolean isSystem = (app.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
                if (!includeSystem && isSystem) {
                    continue;
                }

                JSONObject item = new JSONObject();
                item.put("id", app.packageName);
                item.put("label", pm.getApplicationLabel(app).toString());
                item.put("isSystem", isSystem);

                // Get icon for each app - smaller size for the list
                String iconBase64 = getAppIconBase64(app.packageName);
                if (iconBase64 != null) {
                    item.put("icon", iconBase64);
                }

                results.put(item);
            } catch (Exception e) {
                // Skip
            }
        }
        return results;
    }

    public String getAppIconBase64(String packageName) {
        try {
            Drawable icon = pm.getApplicationIcon(packageName);
            Bitmap bitmap = drawableToBitmap(icon);
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream);
            return Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return null;
        }
    }

    private Bitmap drawableToBitmap(Drawable drawable) {
        if (drawable instanceof BitmapDrawable) {
            Bitmap bp = ((BitmapDrawable) drawable).getBitmap();
            if (bp.getWidth() <= 64 && bp.getHeight() <= 64) {
                return bp;
            }
        }

        int width = drawable.getIntrinsicWidth();
        int height = drawable.getIntrinsicHeight();

        // Resize to 64x64 if larger
        if (width > 64 || height > 64) {
            float ratio = (float) width / height;
            if (width > height) {
                width = 64;
                height = (int) (64 / ratio);
            } else {
                height = 64;
                width = (int) (64 * ratio);
            }
        }

        if (width <= 0)
            width = 1;
        if (height <= 0)
            height = 1;

        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        drawable.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
        drawable.draw(canvas);
        return bitmap;
    }
}
