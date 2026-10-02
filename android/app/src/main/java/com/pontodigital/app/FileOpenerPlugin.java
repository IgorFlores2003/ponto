package com.pontodigital.app;

import android.content.Intent;
import android.net.Uri;
import android.webkit.MimeTypeMap;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

@CapacitorPlugin(name = "FileOpener")
public class FileOpenerPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        String path = call.getString("path");
        String mimeType = call.getString("mimeType");

        if (path == null || path.isEmpty()) {
            call.reject("Caminho do arquivo não fornecido.");
            return;
        }

        try {
            File file;
            if (path.startsWith("file://")) {
                file = new File(Uri.parse(path).getPath());
            } else {
                file = new File(path);
            }

            if (!file.exists()) {
                call.reject("Arquivo não encontrado no dispositivo.");
                return;
            }

            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );

            if (mimeType == null || mimeType.trim().isEmpty() || mimeType.equals("application/octet-stream")) {
                String name = file.getName();
                int dotIndex = name.lastIndexOf('.');
                if (dotIndex >= 0) {
                    String extension = name.substring(dotIndex + 1).toLowerCase();
                    mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
                }
            }
            if (mimeType == null || mimeType.isEmpty()) {
                if (file.getName().endsWith(".pdf")) {
                    mimeType = "application/pdf";
                } else if (file.getName().endsWith(".xlsx")) {
                    mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                } else if (file.getName().endsWith(".xls")) {
                    mimeType = "application/vnd.ms-excel";
                } else if (file.getName().endsWith(".csv")) {
                    mimeType = "text/csv";
                } else {
                    mimeType = "*/*";
                }
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, mimeType);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            Intent chooser = Intent.createChooser(intent, "Abrir com");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            if (getActivity() != null) {
                getActivity().startActivity(chooser);
            } else {
                getContext().startActivity(chooser);
            }

            call.resolve();
        } catch (Exception e) {
            call.reject("Não foi possível abrir o aplicativo: " + e.getMessage());
        }
    }
}
