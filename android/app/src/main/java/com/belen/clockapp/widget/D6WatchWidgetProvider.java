package com.belen.clockapp.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import com.belen.clockapp.R;
import com.belen.clockapp.astronomy.GeometricTimeCalculator;
import com.belen.clockapp.astronomy.WidgetLocation;
import com.belen.clockapp.astronomy.WidgetLocationResolver;

public class D6WatchWidgetProvider extends AppWidgetProvider {

	private static final String ACTION_REFRESH_WIDGET = "com.belen.clockapp.widget.ACTION_REFRESH_WIDGET";
	private static final long REFRESH_INTERVAL_MS = 5L * 60L * 1000L;
	/** Namespace distinto del widget visual (0x6C01…) y del launch (1). */
	private static final int REFRESH_REQUEST_CODE_BASE = 0x6D010000;
	private static final int LAUNCH_REQUEST_CODE_BASE = 0x6D020000;

	@Override
	public void onReceive(Context context, Intent intent) {
		if (intent != null && ACTION_REFRESH_WIDGET.equals(intent.getAction())) {
			int appWidgetId = intent.getIntExtra(
					AppWidgetManager.EXTRA_APPWIDGET_ID,
					AppWidgetManager.INVALID_APPWIDGET_ID
			);
			if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
				updateSingleWidget(context, appWidgetId);
			} else {
				updateAllWidgets(context);
			}
			return;
		}
		super.onReceive(context, intent);
	}

	@Override
	public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
		for (int appWidgetId : appWidgetIds) {
			appWidgetManager.updateAppWidget(appWidgetId, createRemoteViews(context, appWidgetId));
		}

		scheduleNextUpdate(context);
	}

	@Override
	public void onEnabled(Context context) {
		scheduleNextUpdate(context);
	}

	@Override
	public void onDisabled(Context context) {
		cancelNextUpdate(context);
	}

	private RemoteViews createRemoteViews(Context context, int appWidgetId) {
		WidgetLocation location = WidgetLocationResolver.resolve(context);
		GeometricTimeCalculator.WidgetState widgetState = GeometricTimeCalculator.calculateNow(location);
		RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.d6_watch_widget);
		views.setTextViewText(R.id.widget_title, widgetState.getTitleText());
		views.setTextViewText(R.id.widget_geometric_time, widgetState.getGeometricTimeText());
		views.setTextViewText(R.id.widget_civil_time, widgetState.getCivilTimeText());
		views.setTextViewText(R.id.widget_location, widgetState.getLocationText());
		views.setTextViewText(R.id.widget_state, widgetState.getStateText());
		views.setViewVisibility(R.id.widget_refresh, android.view.View.VISIBLE);
		views.setOnClickPendingIntent(
				R.id.widget_refresh,
				buildManualRefreshPendingIntent(context, appWidgetId)
		);

		Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
		if (launchIntent != null) {
			launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
			PendingIntent appPendingIntent = PendingIntent.getActivity(
					context,
					LAUNCH_REQUEST_CODE_BASE | (appWidgetId & 0xFFFF),
					launchIntent,
					PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
			);
			views.setOnClickPendingIntent(R.id.widget_title, appPendingIntent);
			views.setOnClickPendingIntent(R.id.widget_geometric_time, appPendingIntent);
			views.setOnClickPendingIntent(R.id.widget_civil_time, appPendingIntent);
			views.setOnClickPendingIntent(R.id.widget_location, appPendingIntent);
			views.setOnClickPendingIntent(R.id.widget_state, appPendingIntent);
			views.setOnClickPendingIntent(R.id.widget_card, appPendingIntent);
		}

		return views;
	}

	private void updateSingleWidget(Context context, int appWidgetId) {
		AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
		appWidgetManager.updateAppWidget(appWidgetId, createRemoteViews(context, appWidgetId));
	}

	private void updateAllWidgets(Context context) {
		AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
		ComponentName componentName = new ComponentName(context, D6WatchWidgetProvider.class);
		int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);
		for (int appWidgetId : appWidgetIds) {
			appWidgetManager.updateAppWidget(appWidgetId, createRemoteViews(context, appWidgetId));
		}
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

	/** Alarm / refresco de todas las instancias (sin EXTRA_APPWIDGET_ID). */
	private PendingIntent buildAlarmRefreshPendingIntent(Context context) {
		Intent refreshIntent = new Intent(context, D6WatchWidgetProvider.class);
		refreshIntent.setAction(ACTION_REFRESH_WIDGET);
		return PendingIntent.getBroadcast(
				context,
				0,
				refreshIntent,
				PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
		);
	}

	/** Recarga manual de una sola instancia; no abre la app. */
	private PendingIntent buildManualRefreshPendingIntent(Context context, int appWidgetId) {
		Intent refreshIntent = new Intent(context, D6WatchWidgetProvider.class);
		refreshIntent.setAction(ACTION_REFRESH_WIDGET);
		refreshIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
		refreshIntent.setData(
				Uri.parse("d6watch-refresh://" + context.getPackageName() + "/" + appWidgetId)
		);
		return PendingIntent.getBroadcast(
				context,
				REFRESH_REQUEST_CODE_BASE | (appWidgetId & 0xFFFF),
				refreshIntent,
				PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
		);
	}
}
