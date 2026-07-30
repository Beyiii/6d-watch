package com.belen.clockapp.astronomy;

import android.Manifest;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import androidx.core.content.ContextCompat;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.ZoneId;
import java.util.List;

public final class WidgetLocationResolver {

    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String ACTIVE_LOCATION_KEY = "6dw-active-location";

    private WidgetLocationResolver() {
    }

    public static WidgetLocation resolve(Context context) {
        WidgetLocation savedLocation = readSavedLocation(context);
        if (savedLocation != null) {
            return savedLocation;
        }

        WidgetLocation deviceLocation = resolveDeviceLocation(context);
        if (deviceLocation != null) {
            return deviceLocation;
        }

        return WidgetLocation.santiago();
    }

    private static WidgetLocation readSavedLocation(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = preferences.getString(ACTIVE_LOCATION_KEY, null);
        if (raw == null) {
            return null;
        }

        try {
            JSONObject json = new JSONObject(raw);
            double latitude = json.getDouble("lat");
            double longitude = json.getDouble("lon");
            String timezone = json.optString("timezone", null);
            String name = json.optString("name", null);

            if (timezone == null || timezone.isEmpty()) {
                timezone = ZoneId.systemDefault().getId();
            }
            if (name == null || name.isEmpty()) {
                name = "Ubicación guardada";
            }

            return new WidgetLocation(latitude, longitude, timezone, name);
        } catch (JSONException | ClassCastException | IllegalStateException ex) {
            return null;
        }
    }

    private static WidgetLocation resolveDeviceLocation(Context context) {
        boolean fineGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarseGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (!fineGranted && !coarseGranted) {
            return null;
        }

        LocationManager locationManager = (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) {
            return null;
        }

        Location bestLocation = null;
        List<String> providers = locationManager.getProviders(true);
        if (providers == null) {
            return null;
        }
        for (String provider : providers) {
            try {
                Location candidate = locationManager.getLastKnownLocation(provider);
                if (candidate == null) {
                    continue;
                }

                if (bestLocation == null || candidate.getTime() > bestLocation.getTime()) {
                    bestLocation = candidate;
                }
            } catch (SecurityException ignored) {
                continue;
            }
        }

        if (bestLocation == null) {
            return null;
        }

        String timezone = ZoneId.systemDefault().getId();
        return new WidgetLocation(bestLocation.getLatitude(), bestLocation.getLongitude(), timezone, "Ubicación del dispositivo");
    }
}