package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 17 - Subir documento del turno virtual: el archivo queda cargado y en revision (CP-17)")
class Test17SubirDocumentoTurnoVirtual {

    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
    }

    @Test
    void cp17_subirDocumento() {
        cliente = Escenario.cliente();
        String turno = Escenario.turnoVirtualEnEspera(cliente);
        Acciones.visible(cliente, By.cssSelector(".virtual-docs-card"), Config.ESPERA_LARGA);

        Evidencia.captura(cliente, "_documento_prueba");
        Path archivo = Config.EVIDENCIAS.resolve("_documento_prueba.png");
        WebElement entrada = Acciones.todos(cliente, By.cssSelector(".doc-row input[type=file]")).get(0);
        Acciones.subirArchivo(cliente, entrada, archivo);

        boolean enRevision = Acciones.esperaJs(cliente,
                "/En revisi/.test((document.querySelector('.virtual-docs-card')||{}).innerText||'')",
                Config.ESPERA_LARGA);
        Acciones.esperar(2500);
        String estadoDocumentos = Acciones.textoPlano(cliente, By.cssSelector(".virtual-docs-card"));
        Evidencia.nota("turnoDocumentos", turno);
        Evidencia.nota("documentosTrasSubir", estadoDocumentos);
        Acciones.desplazarA(cliente, By.cssSelector(".virtual-docs-card"));
        Evidencia.captura(cliente, "cp19_documento_virtual_subido");

        assertTrue(enRevision,
                "El documento subido debe quedar En revision, la tarjeta muestra: " + estadoDocumentos);
        assertTrue(estadoDocumentos.contains("Reemplazar"),
                "Tras subirlo debe ofrecerse la opcion de reemplazar el documento");
    }
}
