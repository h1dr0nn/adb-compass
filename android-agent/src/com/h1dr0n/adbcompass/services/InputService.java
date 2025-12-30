package com.h1dr0n.adbcompass.services;

import android.os.IBinder;
import android.view.InputEvent;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.MotionEvent;
import java.lang.reflect.Method;

public class InputService {
    private Object inputManager;
    private Method injectInputEventMethod;

    public InputService() {
        try {
            Class<?> smClass = Class.forName("android.os.ServiceManager");
            Method getServiceMethod = smClass.getMethod("getService", String.class);
            IBinder binder = (IBinder) getServiceMethod.invoke(null, "input");

            if (binder != null) {
                Class<?> stubClass = Class.forName("android.hardware.input.IInputManager$Stub");
                Method asInterfaceMethod = stubClass.getMethod("asInterface", IBinder.class);
                inputManager = asInterfaceMethod.invoke(null, binder);

                injectInputEventMethod = inputManager.getClass().getMethod("injectInputEvent", InputEvent.class,
                        int.class);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public boolean injectTap(int x, int y) {
        if (inputManager == null || injectInputEventMethod == null)
            return false;
        try {
            long now = SystemClock.uptimeMillis();
            injectEvent(createMotionEvent(MotionEvent.ACTION_DOWN, now, x, y));
            injectEvent(createMotionEvent(MotionEvent.ACTION_UP, now, x, y));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private void injectEvent(InputEvent event) throws Exception {
        // mode 0: INJECT_INPUT_EVENT_MODE_ASYNC
        // mode 1: INJECT_INPUT_EVENT_MODE_WAIT_FOR_RESULT
        // mode 2: INJECT_INPUT_EVENT_MODE_WAIT_FOR_FINISH
        injectInputEventMethod.invoke(inputManager, event, 0);
    }

    private MotionEvent createMotionEvent(int action, long when, float x, float y) {
        // This is a simplified MotionEvent creation.
        // In some versions, obtain() might be blocked or behave differently in
        // app_process.
        return MotionEvent.obtain(when, when, action, x, y, 0);
    }
}
