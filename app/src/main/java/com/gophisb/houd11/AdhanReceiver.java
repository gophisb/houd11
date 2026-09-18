package com.gophisb.houd11;
import android.app.*;import android.content.*;import android.os.*;
public class AdhanReceiver extends BroadcastReceiver{
 static final String ACTION="com.gophisb.houd11.PLAY_ADHAN";
 @Override public void onReceive(Context c,Intent i){Intent s=new Intent(c,AdhanService.class).setAction(AdhanService.ACTION_PLAY);if(Build.VERSION.SDK_INT>=26)c.startForegroundService(s);else c.startService(s);}
 static void schedule(Context c,String p,long t){if(t<=System.currentTimeMillis())return;AlarmManager am=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);Intent i=new Intent(c,AdhanReceiver.class).setAction(ACTION).putExtra("prayer",p);int id=Math.abs(p.hashCode());PendingIntent pi=PendingIntent.getBroadcast(c,id,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);if(Build.VERSION.SDK_INT>=31&&!am.canScheduleExactAlarms())return;if(Build.VERSION.SDK_INT>=23)am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,t,pi);else am.setExact(AlarmManager.RTC_WAKEUP,t,pi);}
}