package com.belen.clockapp.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;

import com.belen.clockapp.widget.svgclock.GeoClockBitmapHelper;
import com.belen.clockapp.widget.svgclock.GeometricClockWidgetUpdateWorker;

/**
 * Widget visual. En {@code onUpdate} reentrega de inmediato la última imagen válida
 * (defensa ante PACKAGE_CHANGED de WorkManager) y, si corresponde, encola un render nuevo.
 * <p>
 * Importante: no reaplicar “Cargando reloj…” en cada {@code APPWIDGET_UPDATE} — en Samsung
 * eso provoca un parpadeo ~1s en bucle con el Worker.
 */
public class GeometricClockWidgetProvider extends AppWidgetProvider {

	/** AlarmManager / refresco periódico de todos los widgets visuales. */
	public static final String ACTION_REFRESH_WIDGET =
			"com.belen.clockapp.widget.ACTION_REFRESH_GEO_CLOCK_WIDGET";

	/**
	 * Recarga manual de una sola instancia (botón del widget).
	 * Debe incluir {@link AppWidgetManager#EXTRA_APPWIDGET_ID}.
	 */
	public static final String ACTION_MANUAL_REFRESH =
			"com.belen.clockapp.widget.svgclock.ACTION_REFRESH";

	private static final long REFRESH_INTERVAL_MS = 5L * 60L * 1000L;
	private static final long MANUAL_DEBOUNCE_MS = 900L;
	private static final String OPTIONS_PREFS = "geometric-clock-widget-options";
	private static final String LAST_UPDATE_BUCKET_KEY = "last-update-bucket";
	private static final String LAST_MANUAL_PREFIX = "last-manual-";

	@Override
	public void onReceive(Context context, Intent intent) {
		String action = intent != null ? intent.getAction() : null;
		GeoClockBitmapHelper.logVisual(
				"VISUAL_ON_RECEIVE",
				"action=" + action
		);
		if (intent != null && ACTION_MANUAL_REFRESH.equals(intent.getAction())) {
			int appWidgetId = intent.getIntExtra(
					AppWidgetManager.EXTRA_APPWIDGET_ID,
					AppWidgetManager.INVALID_APPWIDGET_ID
			);
			GeoClockBitmapHelper.logVisual(
					"VISUAL_REFRESH_RECEIVED",
					"appWidgetId=" + appWidgetId
							+ " hasExtra=" + intent.hasExtra(AppWidgetManager.EXTRA_APPWIDGET_ID)
							+ " data=" + intent.getDataString()
			);
			if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
				handleManualRefresh(context, appWidgetId);
			}
			return;
		}
		super.onReceive(context, intent);
		if (intent != null && ACTION_REFRESH_WIDGET.equals(intent.getAction())) {
			updateAllWidgets(context);
		}
	}

	@Override
	public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
		GeoClockBitmapHelper.logVisual(
				"VISUAL_ON_UPDATE",
				"ids=" + idsToString(appWidgetIds)
		);

		boolean redelivered = GeometricClockWidgetUpdateWorker.redeliverLastCached(
				context,
				appWidgetManager,
				appWidgetIds
		);

		boolean hasNewOrResizedWidget = false;
		boolean anyNeedsFirstPaint = false;
		boolean hasActive = GeometricClockWidgetUpdateWorker.hasActiveWork(context);

		for (int appWidgetId : appWidgetIds) {
			Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
			hasNewOrResizedWidget |= saveOptionsSignature(context, appWidgetId, options);
			boolean hasCache = GeometricClockWidgetUpdateWorker.hasLastDelivery(context, appWidgetId);
			String paintState = GeometricClockWidgetUpdateWorker.getPaintState(context, appWidgetId);

			if (hasCache) {
				GeometricClockWidgetUpdateWorker.setPaintState(
						context,
						appWidgetId,
						GeometricClockWidgetUpdateWorker.PAINT_READY
				);
				continue;
			}

			if (GeometricClockWidgetUpdateWorker.PAINT_NONE.equals(paintState)
					|| paintState == null
					|| paintState.isEmpty()) {
				// Primera vez: loading una sola vez + encolar si no hay trabajo activo.
				GeometricClockWidgetUpdateWorker.showLoadingState(
						context,
						appWidgetManager,
						appWidgetId
				);
				GeoClockBitmapHelper.logVisual(
						"VISUAL_LOADING_SHOWN",
						"appWidgetId=" + appWidgetId + " reason=first-paint"
				);
				anyNeedsFirstPaint = true;
			} else if (GeometricClockWidgetUpdateWorker.PAINT_LOADING.equals(paintState)) {
				if (!hasActive) {
					// Trabajo murió sin entregar: estado estable de error, sin re-loading.
					GeometricClockWidgetUpdateWorker.showErrorState(
							context,
							appWidgetManager,
							appWidgetId
					);
					GeoClockBitmapHelper.logVisual(
							"VISUAL_LOADING_ABORTED",
							"appWidgetId=" + appWidgetId + " reason=loading-without-active-work"
					);
				} else {
					GeoClockBitmapHelper.logVisual(
							"VISUAL_LOADING_KEEP",
							"appWidgetId=" + appWidgetId + " reason=render-in-flight-no-reapply"
					);
				}
			} else if (GeometricClockWidgetUpdateWorker.PAINT_FAILED.equals(paintState)) {
				GeoClockBitmapHelper.logVisual(
						"VISUAL_ERROR_KEEP",
						"appWidgetId=" + appWidgetId + " reason=stable-error-no-reenqueue"
				);
			}
		}

		boolean bucketChanged = markCurrentUpdateBucket(context);
		boolean needsFirstPaintEnqueue = anyNeedsFirstPaint && !hasActive;
		boolean needsResizeEnqueue = hasNewOrResizedWidget && !anyNeedsFirstPaint;
		boolean softPeriodicEnqueue = bucketChanged && !hasActive && !anyNeedsFirstPaint;
		boolean shouldEnqueue = needsFirstPaintEnqueue || needsResizeEnqueue || softPeriodicEnqueue;

		GeoClockBitmapHelper.logVisual(
				"VISUAL_ON_UPDATE_DECISION",
				"redelivered=" + redelivered
						+ " needsFirstPaint=" + anyNeedsFirstPaint
						+ " resized=" + hasNewOrResizedWidget
						+ " bucketChanged=" + bucketChanged
						+ " hasActive=" + hasActive
						+ " firstPaintEnqueue=" + needsFirstPaintEnqueue
						+ " shouldEnqueue=" + shouldEnqueue
						+ " ids=" + idsToString(appWidgetIds)
		);

		if (shouldEnqueue) {
			if (needsFirstPaintEnqueue || needsResizeEnqueue) {
				GeometricClockWidgetUpdateWorker.enqueueUrgent(context, "provider.onUpdate");
				GeoClockBitmapHelper.logVisual(
						"VISUAL_WORK_ENQUEUED",
						"source=provider.onUpdate urgent=true ids=" + idsToString(appWidgetIds)
				);
			} else {
				GeometricClockWidgetUpdateWorker.enqueue(context, "provider.onUpdate");
				GeoClockBitmapHelper.logVisual(
						"VISUAL_WORK_ENQUEUED",
						"source=provider.onUpdate force=false ids=" + idsToString(appWidgetIds)
				);
			}
		}

		// No rebind durante loading/failed sin caché: partiallyUpdate también parpadea en Samsung.
		boolean anyReadyOrCached = false;
		for (int id : appWidgetIds) {
			if (GeometricClockWidgetUpdateWorker.hasLastDelivery(context, id)
					|| GeometricClockWidgetUpdateWorker.PAINT_READY.equals(
					GeometricClockWidgetUpdateWorker.getPaintState(context, id))) {
				anyReadyOrCached = true;
				break;
			}
		}
		if (anyReadyOrCached) {
			GeometricClockWidgetUpdateWorker.bindRefreshActions(
					context,
					appWidgetManager,
					appWidgetIds
			);
		}
		scheduleNextUpdate(context);
	}

	@Override
	public void onAppWidgetOptionsChanged(
			Context context,
			AppWidgetManager appWidgetManager,
			int appWidgetId,
			Bundle newOptions
	) {
		super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions);
		GeoClockBitmapHelper.logVisual(
				"VISUAL_OPTIONS_CHANGED",
				"appWidgetId=" + appWidgetId
						+ " min="
						+ newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
						+ "x"
						+ newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
						+ " max="
						+ newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0)
						+ "x"
						+ newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0)
		);
		GeometricClockWidgetUpdateWorker.redeliverLastCached(
				context,
				appWidgetManager,
				new int[] { appWidgetId }
		);
		boolean hasCache = GeometricClockWidgetUpdateWorker.hasLastDelivery(context, appWidgetId);
		boolean hasActive = GeometricClockWidgetUpdateWorker.hasActiveWork(context);
		String paintState = GeometricClockWidgetUpdateWorker.getPaintState(context, appWidgetId);
		if (saveOptionsSignature(context, appWidgetId, newOptions)) {
			if (!hasCache && (hasActive
					|| GeometricClockWidgetUpdateWorker.PAINT_LOADING.equals(paintState)
					|| GeometricClockWidgetUpdateWorker.PAINT_FAILED.equals(paintState))) {
				GeoClockBitmapHelper.logVisual(
						"VISUAL_OPTIONS_SKIP_ENQUEUE",
						"appWidgetId=" + appWidgetId
								+ " reason=first-paint-or-failed paintState=" + paintState
				);
			} else {
				GeometricClockWidgetUpdateWorker.enqueueUrgent(
						context,
						"provider.onAppWidgetOptionsChanged"
				);
				GeoClockBitmapHelper.logVisual(
						"VISUAL_WORK_ENQUEUED",
						"source=optionsChanged urgent=true appWidgetId=" + appWidgetId
				);
			}
		}
	}

	@Override
	public void onDeleted(Context context, int[] appWidgetIds) {
		SharedPreferences.Editor editor =
				context.getSharedPreferences(OPTIONS_PREFS, Context.MODE_PRIVATE).edit();
		for (int appWidgetId : appWidgetIds) {
			editor.remove(String.valueOf(appWidgetId));
			editor.remove(LAST_MANUAL_PREFIX + appWidgetId);
		}
		editor.apply();
		GeometricClockWidgetUpdateWorker.clearPaintState(context, appWidgetIds);
		GeometricClockWidgetUpdateWorker.deleteWidgetCache(context, appWidgetIds);
	}

	@Override
	public void onEnabled(Context context) {
		GeoClockBitmapHelper.logVisual("VISUAL_ON_ENABLED", "ok");
		scheduleNextUpdate(context);
	}

	@Override
	public void onDisabled(Context context) {
		GeoClockBitmapHelper.logVisual("VISUAL_ON_DISABLED", "ok");
		cancelNextUpdate(context);
		GeometricClockWidgetUpdateWorker.cancel(context);
	}

	private void handleManualRefresh(Context context, int appWidgetId) {
		if (isManualRefreshDebounced(context, appWidgetId)) {
			GeoClockBitmapHelper.logVisual(
					"VISUAL_REFRESH_DEBOUNCED",
					"appWidgetId=" + appWidgetId
			);
			return;
		}
		markManualRefresh(context, appWidgetId);

		AppWidgetManager manager = AppWidgetManager.getInstance(context);
		if (GeometricClockWidgetUpdateWorker.hasLastDelivery(context, appWidgetId)) {
			GeometricClockWidgetUpdateWorker.redeliverLastCached(
					context,
					manager,
					new int[] { appWidgetId }
			);
		} else {
			GeometricClockWidgetUpdateWorker.setPaintState(
					context,
					appWidgetId,
					GeometricClockWidgetUpdateWorker.PAINT_NONE
			);
			GeometricClockWidgetUpdateWorker.showLoadingState(context, manager, appWidgetId);
		}
		if (GeometricClockWidgetUpdateWorker.hasActiveWork(context)) {
			GeoClockBitmapHelper.logVisual(
					"VISUAL_WORK_KEEP",
					"source=manual appWidgetId=" + appWidgetId + " reason=active-work"
			);
			return;
		}
		GeometricClockWidgetUpdateWorker.enqueueForWidget(
				context,
				appWidgetId,
				"provider.ACTION_MANUAL_REFRESH",
				true
		);
		GeoClockBitmapHelper.logVisual(
				"VISUAL_WORK_ENQUEUED",
				"source=manual force=true appWidgetId=" + appWidgetId
		);
	}

	private boolean isManualRefreshDebounced(Context context, int appWidgetId) {
		SharedPreferences preferences =
				context.getSharedPreferences(OPTIONS_PREFS, Context.MODE_PRIVATE);
		long last = preferences.getLong(LAST_MANUAL_PREFIX + appWidgetId, 0L);
		return System.currentTimeMillis() - last < MANUAL_DEBOUNCE_MS;
	}

	private void markManualRefresh(Context context, int appWidgetId) {
		context.getSharedPreferences(OPTIONS_PREFS, Context.MODE_PRIVATE)
				.edit()
				.putLong(LAST_MANUAL_PREFIX + appWidgetId, System.currentTimeMillis())
				.apply();
	}

	private void updateAllWidgets(Context context) {
		if (GeometricClockWidgetUpdateWorker.hasActiveWork(context)) {
			GeoClockBitmapHelper.logVisual(
					"VISUAL_WORK_KEEP",
					"source=alarm reason=active-work"
			);
			return;
		}
		GeometricClockWidgetUpdateWorker.enqueue(context, "provider.ACTION_REFRESH_WIDGET");
		GeoClockBitmapHelper.logVisual(
				"VISUAL_WORK_ENQUEUED",
				"source=alarm soft=true"
		);
	}

	/**
	 * Algunos launchers vuelven a emitir OPTIONS_CHANGED después de aplicar RemoteViews.
	 * Guardar la firma evita un ciclo update -> options -> update sin perder la actualización
	 * inmediata cuando el usuario cambia realmente el tamaño.
	 */
	private boolean saveOptionsSignature(Context context, int appWidgetId, Bundle options) {
		if (options == null) {
			return false;
		}
		String signature =
				options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0) + "x"
				+ options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0) + ":"
				+ options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0) + "x"
				+ options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
		SharedPreferences preferences =
				context.getSharedPreferences(OPTIONS_PREFS, Context.MODE_PRIVATE);
		String key = String.valueOf(appWidgetId);
		String previous = preferences.getString(key, null);
		if (signature.equals(previous)) {
			return false;
		}
		preferences.edit().putString(key, signature).apply();
		return true;
	}

	private boolean markCurrentUpdateBucket(Context context) {
		long bucket = Math.floorDiv(System.currentTimeMillis(), REFRESH_INTERVAL_MS);
		SharedPreferences preferences =
				context.getSharedPreferences(OPTIONS_PREFS, Context.MODE_PRIVATE);
		if (preferences.getLong(LAST_UPDATE_BUCKET_KEY, Long.MIN_VALUE) == bucket) {
			return false;
		}
		preferences.edit().putLong(LAST_UPDATE_BUCKET_KEY, bucket).apply();
		return true;
	}

	private void scheduleNextUpdate(Context context) {
		AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
		if (alarmManager == null) {
			return;
		}
		alarmManager.setInexactRepeating(
				AlarmManager.RTC_WAKEUP,
				System.currentTimeMillis() + REFRESH_INTERVAL_MS,
				REFRESH_INTERVAL_MS,
				buildAlarmRefreshPendingIntent(context)
		);
	}

	private void cancelNextUpdate(Context context) {
		AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
		if (alarmManager == null) {
			return;
		}
		alarmManager.cancel(buildAlarmRefreshPendingIntent(context));
	}

	private PendingIntent buildAlarmRefreshPendingIntent(Context context) {
		Intent refreshIntent = new Intent(context, GeometricClockWidgetProvider.class);
		refreshIntent.setAction(ACTION_REFRESH_WIDGET);
		return PendingIntent.getBroadcast(
				context,
				0,
				refreshIntent,
				PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
		);
	}

	private static String idsToString(int[] ids) {
		if (ids == null || ids.length == 0) {
			return "[]";
		}
		StringBuilder sb = new StringBuilder("[");
		for (int i = 0; i < ids.length; i++) {
			if (i > 0) {
				sb.append(',');
			}
			sb.append(ids[i]);
		}
		return sb.append(']').toString();
	}
}
