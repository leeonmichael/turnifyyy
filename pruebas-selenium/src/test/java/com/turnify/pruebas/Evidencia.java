package com.turnify.pruebas;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.openqa.selenium.Dimension;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.OutputType;
import org.openqa.selenium.TakesScreenshot;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public final class Evidencia {

    private Evidencia() { }

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Map<String, Object> NOTAS = Collections.synchronizedMap(new LinkedHashMap<>());
    private static final Path ARCHIVO = Config.EVIDENCIAS.resolve("resultados.json");

    static {
        try {
            Files.createDirectories(Config.EVIDENCIAS);
            if (Files.exists(ARCHIVO)) {
                @SuppressWarnings("unchecked")
                Map<String, Object> previas = JSON.readValue(ARCHIVO.toFile(), Map.class);
                NOTAS.putAll(previas);
            }
        } catch (IOException e) {
            System.out.println("[evidencia] no se pudieron leer resultados previos: " + e.getMessage());
        }
    }

    public static void nota(String clave, Object valor) {
        NOTAS.put(clave, valor);
        System.out.println("[nota] " + clave + " = " + valor);
        guardar();
    }

    public static Object nota(String clave) {
        return NOTAS.get(clave);
    }

    public static synchronized void guardar() {
        try {
            Files.createDirectories(Config.EVIDENCIAS);
            JSON.writerWithDefaultPrettyPrinter().writeValue(ARCHIVO.toFile(), NOTAS);
        } catch (IOException e) {
            System.out.println("[evidencia] no se pudo guardar resultados.json: " + e.getMessage());
        }
    }

    public static void captura(WebDriver driver, String nombre) {
        Acciones.esperar(400);
        guardarArchivo(((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE), nombre);
    }

    public static void capturaCompleta(WebDriver driver, String nombre) {
        Dimension original = driver.manage().window().getSize();
        try {
            Object alto = ((JavascriptExecutor) driver).executeScript(
                    "return Math.min(Math.max(document.body.scrollHeight,"
                            + " document.documentElement.scrollHeight), 3600);");
            int h = Math.max(Config.ALTO, ((Number) alto).intValue() + 120);
            driver.manage().window().setSize(new Dimension(original.getWidth(), h));
            Acciones.esperar(800);
            guardarArchivo(((TakesScreenshot) driver).getScreenshotAs(OutputType.FILE), nombre);
        } catch (RuntimeException e) {
            System.out.println("[evidencia] captura completa fallo, se toma la visible: " + e.getMessage());
            captura(driver, nombre);
        } finally {
            driver.manage().window().setSize(original);
            Acciones.esperar(300);
        }
    }

    public static void capturaElemento(WebElement elemento, String nombre) {
        Acciones.esperar(300);
        guardarArchivo(elemento.getScreenshotAs(OutputType.FILE), nombre);
    }

    private static void guardarArchivo(File temporal, String nombre) {
        try {
            Files.createDirectories(Config.EVIDENCIAS);
            Path destino = Config.EVIDENCIAS.resolve(nombre + ".png");
            Files.copy(temporal.toPath(), destino, StandardCopyOption.REPLACE_EXISTING);
            System.out.println("[captura] " + nombre + ".png");
        } catch (IOException e) {
            System.out.println("[evidencia] no se pudo guardar la captura " + nombre + ": " + e.getMessage());
        }
    }
}
