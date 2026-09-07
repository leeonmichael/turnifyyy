package com.turnify.pruebas;

import org.openqa.selenium.Dimension;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.edge.EdgeDriver;
import org.openqa.selenium.edge.EdgeOptions;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class Navegador {

    private Navegador() { }

    private static final List<WebDriver> ABIERTOS = new ArrayList<>();

    public static WebDriver escritorio() {
        return crear(Config.ANCHO, Config.ALTO, false);
    }

    public static WebDriver movil() {
        return crear(Config.ANCHO_MOVIL, Config.ALTO_MOVIL, true);
    }

    private static WebDriver crear(int ancho, int alto, boolean movil) {
        EdgeOptions opciones = new EdgeOptions();
        if (Config.HEADLESS) {
            opciones.addArguments("--headless=new");
        }
        opciones.addArguments("--lang=es-CO");
        opciones.addArguments("--window-size=" + ancho + "," + alto);
        opciones.addArguments("--disable-features=msEdgeIdentityFeature,msImplicitSignin");
        opciones.addArguments("--disable-gpu");
        opciones.addArguments("--no-first-run");
        opciones.addArguments("--no-default-browser-check");
        try {
            Path perfil = Files.createTempDirectory("turnify-edge-");
            opciones.addArguments("--user-data-dir=" + perfil.toAbsolutePath());
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo crear el perfil temporal de Edge", e);
        }
        if (movil) {
            Map<String, Object> dispositivo = new HashMap<>();
            dispositivo.put("width", ancho);
            dispositivo.put("height", alto);
            dispositivo.put("pixelRatio", 2.0);
            dispositivo.put("mobile", true);
            Map<String, Object> emulacion = new HashMap<>();
            emulacion.put("deviceMetrics", dispositivo);
            opciones.setExperimentalOption("mobileEmulation", emulacion);
        }

        try {
            Files.createDirectories(Config.DESCARGAS);
        } catch (IOException ignored) {
        }
        Map<String, Object> preferencias = new HashMap<>();
        preferencias.put("download.default_directory", Config.DESCARGAS.toString());
        preferencias.put("download.prompt_for_download", false);
        preferencias.put("safebrowsing.enabled", true);
        opciones.setExperimentalOption("prefs", preferencias);

        WebDriver driver = new EdgeDriver(opciones);
        driver.manage().timeouts().pageLoadTimeout(Duration.ofSeconds(60));
        driver.manage().timeouts().scriptTimeout(Duration.ofSeconds(60));
        if (!movil) {
            driver.manage().window().setSize(new Dimension(ancho, alto));
        }
        ABIERTOS.add(driver);
        return driver;
    }

    public static void cerrar(WebDriver driver) {
        if (driver == null) {
            return;
        }
        try {
            driver.quit();
        } catch (RuntimeException e) {
            System.out.println("[navegador] error al cerrar: " + e.getMessage());
        }
        ABIERTOS.remove(driver);
    }

    public static void cerrarTodos() {
        for (WebDriver driver : new ArrayList<>(ABIERTOS)) {
            cerrar(driver);
        }
    }
}
