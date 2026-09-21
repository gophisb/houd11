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
import androidx.webkit.WebViewAssetLoader;
import java.io.File;

public class MainActivity extends AppCompatActivity {
    private static final int PICK_AUDIO_PACK = 7001;
    private WebView w;
    private AudioPackManager audioPackManager;

    @Override public void onCreate(@Nullable Bundle b) {
        super.onCreate(b);
        audioPackManager = new AudioPackManager(this);
        w = new WebView(this);
        setContentView(w);

        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .addPathHandler("/quran-audio/", new WebViewAssetLoader.InternalStoragePathHandler(
                this, audioPackManager.getPublicAudioDir()))
            .build();

        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);

        w.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }
            @Override @SuppressWarnings("deprecation")
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                return loader.shouldInterceptRequest(Uri.parse(url));
            }
            @Override public void onPageFinished(WebView v, String u) {
                super.onPageFinished(v, u);
                injectAndroidControls(v);
                schedulePrayerAdhan(v);
            }
        });

        w.addJavascriptInterface(new Bridge(this), "Houd11Android");
        w.loadUrl("https://appassets.androidplatform.net/assets/web/index.html");

        if (Build.VERSION.SDK_INT >= 33)
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
    }

    private void injectAndroidControls(WebView v) {
        String status = audioPackManager.isInstalled()
            ? "القرآن المسموع متاح دون إنترنت"
            : "حزمة القرآن المسموع غير مثبتة";
        String js = "(function(){try{"
            + "if(document.getElementById('houd11-audio-pack'))return;"
            + "var b=document.createElement('button');b.id='houd11-audio-pack';b.type='button';"
            + "b.textContent='حزمة القرآن المسموع — "+js(status)+"';"
            + "b.style.cssText='display:block;width:100%;margin:12px 0;padding:14px;border:1px solid rgba(216,180,106,.55);border-radius:16px;background:rgba(216,180,106,.12);color:#f1d28a;font-size:16px;font-weight:700;';"
            + "b.onclick=function(){Houd11Android.importQuranAudioPack();};"
            + "var root=document.getElementById('main-content')||document.body;root.prepend(b);"
            + "}catch(e){}})();";
        v.evaluateJavascript(js, null);
    }

    private String js(String s) { return s.replace("\\","\\\\").replace("'","\\'"); }

    private void schedulePrayerAdhan(WebView v) {
        String js =
            "(function(){function schedule(){try{"
          + "if(!window.Houd11Android)return setTimeout(schedule,500);"
          + "var app=window.RafeeqApp;if(!app||!app.state||!app.state.prayerTimes)return setTimeout(schedule,500);"
          + "var times=app.state.prayerTimes,ks=['fajr','dhuhr','asr','maghrib','isha'],n=new Date();"
          + "for(var d=0;d<2;d++){var day=new Date(n);day.setDate(day.getDate()+d);day.setSeconds(0,0);"
          + "ks.forEach(function(k){var raw=times[k];if(!raw)return;var q=String(raw).split(':').map(Number);"
          + "if(q.length<2||isNaN(q[0])||isNaN(q[1]))return;var x=new Date(day);x.setHours(q[0],q[1],0,0);"
          + "if(x.getTime()>Date.now())Houd11Android.scheduleAdhan(k,x.getTime());});}"
          + "if(!document.getElementById('houd11-adhan-test')){var b=document.createElement('button');b.id='houd11-adhan-test';b.type='button';"
          + "b.textContent='اختبار صوت الأذان';b.style.cssText='display:block;width:100%;margin:16px 0;padding:14px;border:1px solid rgba(216,180,106,.55);border-radius:16px;background:rgba(216,180,106,.12);color:#f1d28a;font-size:16px;font-weight:700;';"
          + "b.onclick=function(){Houd11Android.playAdhanNow();};var root=document.getElementById('prayer-card-root')||document.getElementById('main-content');if(root)root.appendChild(b);}"
          + "setTimeout(schedule,60000);}catch(e){setTimeout(schedule,1000);}}schedule();})();";
        v.evaluateJavascript(js, null);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if(requestCode==PICK_AUDIO_PACK && resultCode==RESULT_OK && data!=null && data.getData()!=null) {
            final Uri uri=data.getData();
            new Thread(() -> {
                final String result=audioPackManager.importZip(uri);
                runOnUiThread(() -> w.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('houd11:audio-pack',{detail:{status:'"+js(result)+"'}}));"
                    + "var b=document.getElementById('houd11-audio-pack');if(b)b.textContent='حزمة القرآن المسموع — "+js(audioPackManager.isInstalled()?"متاحة دون إنترنت":result)+"';", null));
            }).start();
        }
    }

    public class Bridge {
        final Activity a; Bridge(Activity x){a=x;}
        @JavascriptInterface public void scheduleAdhan(String prayer,long millis){AdhanReceiver.schedule(a,prayer,millis);}
        @JavascriptInterface public void playAdhanNow(){
            Intent i=new Intent(a,AdhanService.class).setAction(AdhanService.ACTION_PLAY);
            if(Build.VERSION.SDK_INT>=26)a.startForegroundService(i);else a.startService(i);
        }
        @JavascriptInterface public void openExactAlarmSettings(){
            if(Build.VERSION.SDK_INT>=31)try{a.startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+a.getPackageName())));}catch(Exception ignored){}
        }
        @JavascriptInterface public void importQuranAudioPack(){
            Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/zip");
            startActivityForResult(i,PICK_AUDIO_PACK);
        }
        @JavascriptInterface public boolean hasQuranAudioPack(){return audioPackManager.isInstalled();}
    }
}