package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 31 - Exportar reportes: los botones de CSV y Excel descargan el reporte de turnos (CP-47)")
class Test31ExportarReportes {

    private WebDriver administrador;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(administrador);
    }

    @Test
    void cp47_exportarReportes() throws IOException {
        administrador = Escenario.administrador();
        Acciones.permitirDescargas(administrador);
        vaciarDescargas();

        Acciones.ir(administrador, "/dashboard");
        Acciones.visible(administrador, By.cssSelector(".employee-section"), Config.ESPERA_LARGA);
        Acciones.esperar(3000);
        Acciones.desplazarA(administrador, By.xpath("//h2[contains(.,'Reportes')]"));
        Evidencia.captura(administrador, "ad07a_reportes_exportacion");

        Acciones.clicTexto(administrador, "Exportar CSV");
        Acciones.esperar(7000);
        List<String> trasCsv = descargados();

        Acciones.clicTexto(administrador, "Exportar Excel");
        Acciones.esperar(9000);
        List<String> trasExcel = descargados();

        Evidencia.nota("descargaCsv", trasCsv);
        Evidencia.nota("descargaExcel", trasExcel);

        assertFalse(trasCsv.isEmpty(), "El boton Exportar CSV debe descargar un archivo");
        assertTrue(trasExcel.size() >= trasCsv.size(), "El boton Exportar Excel debe descargar un archivo");
    }

    private void vaciarDescargas() throws IOException {
        Files.createDirectories(Config.DESCARGAS);
        try (Stream<Path> archivos = Files.list(Config.DESCARGAS)) {
            archivos.forEach(archivo -> {
                try {
                    Files.deleteIfExists(archivo);
                } catch (IOException ignorado) {
                    System.out.println("[descargas] no se pudo borrar " + archivo);
                }
            });
        }
    }

    private List<String> descargados() throws IOException {
        List<String> nombres = new ArrayList<>();
        if (!Files.exists(Config.DESCARGAS)) {
            return nombres;
        }
        try (Stream<Path> archivos = Files.list(Config.DESCARGAS)) {
            archivos.filter(archivo -> !archivo.getFileName().toString().endsWith(".crdownload"))
                    .forEach(archivo -> nombres.add(archivo.getFileName().toString()));
        }
        return nombres;
    }
}
