package com.gophisb.houd11;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.webkit.*;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private WebView w;

    @Override
    public void onCreate(@Nullable Bundle b) {
        super.onCreate(b);

        w = new WebView(this);
        setContentView(w);

        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);

        w.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView v, String u) {
                super.onPageFinished(v, u);

                String js =
                    "(function(){"
                  + "function schedule(){"
                  + "try{"
                  + "if(!window.Houd11Android)return setTimeout(schedule,500);"
                  + "var app=window.RafeeqApp;"
                  + "if(!app||!app.state||!app.state.prayerTimes)return setTimeout(schedule,500);"
                  + "var times=app.state.prayerTimes;"
                  + "var ks=['fajr','dhuhr','asr','maghrib','isha'];"
                  + "var n=new Date();"
                  + "for(var d=0;d<2;d++){"
                  + " var day=new Date(n);day.setDate(day.getDate()+d);day.setSeconds(0,0);"
                  + " ks.forEach(function(k){"
                  + "  var raw=times[k];"
                  + "  if(!raw)return;"
                  + "  var q=String(raw).split(':').map(Number);"
                  + "  if(q.length<2||isNaN(q[0])||isNaN(q[1]))return;"
                  + "  var x=new Date(day);x.setHours(q[0],q[1],0,0);"
                  + "  if(x.getTime()>Date.now())Houd11Android.scheduleAdhan(k,x.getTime());"
                  + " });"
                  + "}"
                  + "if(!document.getElementById('houd11-adhan-test')){"
                  + " var b=document.createElement('button');"
                  + " b.id='houd11-adhan-test';"
                  + " b.type='button';"
                  + " b.textContent='اختبار صوت الأذان';"
                  + " b.style.cssText='display:block;width:100%;margin:16px 0;padding:14px;border:1px solid rgba(216,180,106,.55);border-radius:16px;background:rgba(216,180,106,.12);color:#f1d28a;font-size:16px;font-weight:700;';"
                  + " b.onclick=function(){Houd11Android.playAdhanNow();};"
                  + " var root=document.getElementById('prayer-card-root')||document.getElementById('main-content');"
                  + " if(root)root.appendChild(b);"
                  + "}"
                  + "setTimeout(schedule,60000);"
                  + "}catch(e){setTimeout(schedule,1000);}"
                  + "}"
                  + "schedule();"
                  + "})();";

                v.evaluateJavascript(js, null);
            }
        });

        w.addJavascriptInterface(new Bridge(this), "Houd11Android");
        w.loadUrl("file:///android_asset/web/index.html");

        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
        }
    }

    static final class Bridge {
        final Activity a;

        Bridge(Activity x) {
            a = x;
        }

        @JavascriptInterface
        public void scheduleAdhan(String prayer, long millis) {
            AdhanReceiver.schedule(a, prayer, millis);
        }

        @JavascriptInterface
        public void playAdhanNow() {
            Intent i = new Intent(a, AdhanService.class)
                    .setAction(AdhanService.ACTION_PLAY);

            if (Build.VERSION.SDK_INT >= 26) {
                a.startForegroundService(i);
            } else {
                a.startService(i);
            }
        }

        @JavascriptInterface
        public void openExactAlarmSettings() {
            if (Build.VERSION.SDK_INT >= 31) {
                try {
                    a.startActivity(new Intent(
                            Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                            Uri.parse("package:" + a.getPackageName())
                    ));
                } catch (Exception ignored) {
                }
            }
        }
    }
}
