package com.gophisb.houd11;

import android.content.Context;
import android.net.Uri;
import java.io.*;
import java.util.*;
import java.util.zip.*;

public final class AudioPackManager {
    private static final int EXPECTED = 6236;
    private static final long MAX_UNCOMPRESSED = 650L * 1024L * 1024L;
    private final Context context;
    private final File publicDir;
    private final File audioDir;
    private final File marker;

    public AudioPackManager(Context c) {
        context=c.getApplicationContext();
        publicDir=new File(context.getFilesDir(),"quran-audio");
        audioDir=new File(publicDir,"audio");
        marker=new File(publicDir,".complete");
    }

    public File getPublicAudioDir(){ return audioDir; }
    public boolean isInstalled(){ return marker.isFile() && countAudio()==EXPECTED; }

    private int countAudio(){
        File[] fs=audioDir.listFiles((d,n)->n.matches("\\d{6}\\.ogg"));
        return fs==null?0:fs.length;
    }

    public String importZip(Uri uri){
        File staging=new File(context.getFilesDir(),"quran-audio-staging");
        deleteTree(staging);
        if(!staging.mkdirs()) return "تعذر إنشاء مساحة الاستيراد";
        int count=0; long total=0;
        try(InputStream raw=context.getContentResolver().openInputStream(uri);
            ZipInputStream zis=new ZipInputStream(new BufferedInputStream(raw))) {
            if(raw==null) throw new IOException("empty input");
            ZipEntry e;
            while((e=zis.getNextEntry())!=null){
                String name=e.getName();
                if(e.isDirectory()) continue;
                if(name.equals("manifest.json")) {
                    copy(zis,new File(staging,"manifest.json"),2_000_000);
                } else if(name.matches("audio/\\d{6}\\.ogg")) {
                    File out=new File(staging,name);
                    if(!out.getCanonicalPath().startsWith(staging.getCanonicalPath()+File.separator))
                        throw new SecurityException("unsafe path");
                    out.getParentFile().mkdirs();
                    long written=copy(zis,out,120_000);
                    total+=written; count++;
                    if(total>MAX_UNCOMPRESSED) throw new IOException("pack too large");
                } else {
                    throw new IOException("ملف غير متوقع داخل الحزمة");
                }
                zis.closeEntry();
            }
            if(count!=EXPECTED) throw new IOException("عدد ملفات الصوت غير صحيح: "+count);
            File[] fs=new File(staging,"audio").listFiles((d,n)->n.matches("\\d{6}\\.ogg"));
            if(fs==null || fs.length!=EXPECTED) throw new IOException("الحزمة ناقصة");
            deleteTree(publicDir);
            if(!publicDir.mkdirs() && !publicDir.isDirectory()) throw new IOException("storage");
            if(!moveTree(staging,publicDir)) throw new IOException("move");
            if(!marker.createNewFile()) throw new IOException("marker");
            return "تم تثبيت القرآن المسموع بالكامل";
        } catch(Exception ex){
            deleteTree(staging);
            return "فشل استيراد حزمة القرآن: "+(ex.getMessage()==null?"خطأ غير معروف":ex.getMessage());
        }
    }

    private static long copy(InputStream in,File out,long max) throws IOException{
        try(OutputStream os=new BufferedOutputStream(new FileOutputStream(out))){
            byte[] b=new byte[64*1024]; long n=0,r;
            while((r=in.read(b))!=-1){ n+=r; if(n>max) throw new IOException("file too large"); os.write(b,0,(int)r); }
            return n;
        }
    }
    private static boolean moveTree(File from,File to) throws IOException{
        File[] children=from.listFiles(); if(children==null)return true;
        for(File c:children){
            File d=new File(to,c.getName());
            if(c.isDirectory()){if(!d.mkdirs()&&!d.isDirectory())return false;if(!moveTree(c,d))return false;}
            else if(!c.renameTo(d)){copyFile(c,d);c.delete();}
        } return true;
    }
    private static void copyFile(File a,File b)throws IOException{
        try(InputStream i=new FileInputStream(a);OutputStream o=new FileOutputStream(b)){byte[] x=new byte[65536];int n;while((n=i.read(x))!=-1)o.write(x,0,n);}
    }
    private static void deleteTree(File f){
        if(!f.exists())return; File[] cs=f.listFiles();if(cs!=null)for(File c:cs)deleteTree(c);f.delete();
    }
}