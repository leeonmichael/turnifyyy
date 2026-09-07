package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 47 - Revision de documentos: el especialista aprueba y rechaza los archivos y el cliente ve el resultado (CP-38)")
class Test47RevisionDeDocumentos {

    private WebDriver especialista;
    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
        Navegador.cerrar(especialista);
    }

    @Test
    void cp38_revisarDocumentos() {
        cliente = Escenario.cliente();
        String turno = Escenario.turnoVirtualEnEspera(cliente);
        Escenario.adjuntarDocumento(cliente, 0);
        Escenario.adjuntarDocumento(cliente, 1);

        especialista = Escenario.especialistaVirtual();
        Escenario.atenderTurnoVirtual(especialista, turno);
        Acciones.desplazarA(especialista, By.cssSelector(".client-docs-panel"));

        boolean aprobado = false;
        boolean rechazado = false;
        if (Acciones.existe(especialista, By.cssSelector(".client-doc-approve"))) {
            Acciones.clic(especialista, Acciones.todos(especialista, By.cssSelector(".client-doc-approve")).get(0));
            aprobado = Acciones.esperaJs(especialista,
                    "document.body.innerText.includes('Aprobado')", Config.ESPERA_LARGA);
        }
        if (Acciones.existe(especialista, By.cssSelector(".client-doc-reject"))) {
            Acciones.clic(especialista, Acciones.todos(especialista, By.cssSelector(".client-doc-reject")).get(0));
            Evidencia.nota("promptRechazo", Acciones.responderPrompt(especialista, "La imagen no es legible"));
            rechazado = Acciones.esperaJs(especialista,
                    "document.body.innerText.includes('Rechazado')", Config.ESPERA_LARGA);
        }
        Acciones.esperar(2000);
        Evidencia.nota("documentosRevisados", Acciones.textoPlano(especialista, By.cssSelector(".client-docs-panel")));
        Acciones.desplazarA(especialista, By.cssSelector(".client-docs-panel"));
        Evidencia.captura(especialista, "vi04a_documentos_revisados_empleado");

        boolean clienteVeEstados = Acciones.esperaEnCliente(cliente,
                "/Aprobado|Rechazado/.test((document.querySelector('.virtual-docs-card')||{}).innerText||'')");
        Acciones.esperar(1500);
        Acciones.desplazarA(cliente, By.cssSelector(".virtual-docs-card"));
        Evidencia.nota("documentosVistaCliente", Acciones.textoPlano(cliente, By.cssSelector(".virtual-docs-card")));
        Evidencia.captura(cliente, "vi04b_documentos_estado_cliente");

        assertTrue(aprobado, "El especialista debe poder aprobar un documento del turno " + turno);
        assertTrue(rechazado, "El especialista debe poder rechazar un documento indicando el motivo");
        assertTrue(clienteVeEstados, "El cliente debe ver el resultado de la revision de sus documentos");
    }
}
