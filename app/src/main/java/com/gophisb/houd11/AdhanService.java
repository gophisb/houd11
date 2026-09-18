package com.gophisb.houd11;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.media.*;
import android.net.Uri;
import android.os.*;
import androidx.core.app.NotificationCompat;

public class AdhanService extends Service {
    static final String ACTION_PLAY = "com.gophisb.houd11.PLAY_NOW";
    static final String CHANNEL = "houd11_adhan_v3";
    MediaPlayer player;
    AudioManager audioManager;
    AudioFocusRequest focusRequest;

    @Override public void onCreate() {
        super.onCreate();
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);

        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL, "الأذان", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("تشغيل الأذان في وقت الصلاة");
            ch.setSound(
                Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.adhan),
                new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build());
            nm.createNotificationChannel(ch);
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        Notification n = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("الرفيق")
            .setContentText("حان وقت الصلاة — الأذان")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build();

        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(11, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(11, n);
        }

        requestFocusAndPlay();
        return START_NOT_STICKY;
    }

    private void requestFocusAndPlay() {
        if (Build.VERSION.SDK_INT >= 26) {
            AudioFocusRequest req = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
                .setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build())
                .setAcceptsDelayedFocusGain(false)
                .build();
            focusRequest = req;
            int r = audioManager.requestAudioFocus(req);
            if (r != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                play();
                return;
            }
        } else {
            audioManager.requestAudioFocus(
                null, AudioManager.STREAM_ALARM,
                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE);
        }
        play();
    }

    private void play() {
        releasePlayer();

        try {
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build());
            AssetFileDescriptor afd = getResources().openRawResourceFd(R.raw.adhan);
            if (afd == null) throw new IllegalStateException("adhan resource unavailable");
            try {
                player.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            } finally {
                afd.close();
            }
            player.setVolume(1.0f, 1.0f);
            player.setOnPreparedListener(MediaPlayer::start);
            player.setOnCompletionListener(mp -> finishPlayback());
            player.setOnErrorListener((mp, what, extra) -> {
                finishPlayback();
                return true;
            });
            player.prepareAsync();
        } catch (Exception e) {
            finishPlayback();
        }
    }

    private void releasePlayer() {
        if (player != null) {
            try { player.reset(); } catch (Exception ignored) {}
            try { player.release(); } catch (Exception ignored) {}
            player = null;
        }
    }

    private void finishPlayback() {
        releasePlayer();
        if (Build.VERSION.SDK_INT >= 26 && audioManager != null && focusRequest != null) {
            try { audioManager.abandonAudioFocusRequest(focusRequest); } catch (Exception ignored) {}
        } else if (audioManager != null) {
            try { audioManager.abandonAudioFocus(null); } catch (Exception ignored) {}
        }
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override public void onDestroy() {
        releasePlayer();
        if (Build.VERSION.SDK_INT >= 26 && audioManager != null && focusRequest != null) {
            try { audioManager.abandonAudioFocusRequest(focusRequest); } catch (Exception ignored) {}
        }
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
