package com.turnify.pruebas;

import java.nio.file.Path;
import java.nio.file.Paths;

public final class Config {

    private Config() { }

    public static final String BASE = System.getProperty("turnify.base", "http://127.0.0.1:4200");

    public static final boolean HEADLESS =
            Boolean.parseBoolean(System.getProperty("turnify.headless", "true"));

    public static final Path EVIDENCIAS =
            Paths.get(System.getProperty("turnify.evidencias", "evidencias")).toAbsolutePath();

    public static final Path DESCARGAS = EVIDENCIAS.resolveSibling("descargas");

    private static final java.util.Properties LOCAL = cargarCredencialesLocales();

    public static final String ADMIN_USUARIO = valor("turnify.admin.usuario", "qa_admin_web");
    public static final String ADMIN_CLAVE = valor("turnify.admin.clave", "");

    private static java.util.Properties cargarCredencialesLocales() {
        java.util.Properties p = new java.util.Properties();
        java.nio.file.Path archivo = Paths.get("credenciales.local.properties").toAbsolutePath();
        if (java.nio.file.Files.exists(archivo)) {
            try (java.io.InputStream in = java.nio.file.Files.newInputStream(archivo)) {
                p.load(in);
            } catch (java.io.IOException e) {
                System.out.println("[config] no se pudo leer " + archivo + ": " + e.getMessage());
            }
        }
        return p;
    }

    private static String valor(String clave, String porDefecto) {
        String v = System.getProperty(clave, LOCAL.getProperty(clave, porDefecto));
        if (v == null || v.isBlank()) {
            throw new IllegalStateException(
                    "Falta la credencial '" + clave + "'. Copia credenciales.local.properties.ejemplo como "
                            + "credenciales.local.properties (en la carpeta pruebas-selenium) y completa el valor, "
                            + "o pasala con -D" + clave + "=...");
        }
        return v;
    }

    public static final String EMP_PRESENCIAL = "qa_emp_pres_sel";
    public static final String EMP_VIRTUAL = "qa_emp_virt_sel";
    public static final String EMP_CLAVE = "EmpPrueba2026!";

    public static final String CLIENTE_CLAVE = "PruebaWeb2026!";

    public static final int ESPERA = 30;
    public static final int ESPERA_LARGA = 90;
    public static final int ESPERA_TIEMPO_REAL = 45;

    public static final int ANCHO = 1366;
    public static final int ALTO = 768;
    public static final int ANCHO_MOVIL = 390;
    public static final int ALTO_MOVIL = 844;
}
