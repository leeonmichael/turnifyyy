package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 16 - Solicitar turno virtual: no se pide sede, se listan los documentos y el turno recibe el prefijo W (CP-16)")
class Test16SolicitarTurnoVirtual {

    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
    }

    @Test
    void cp16_turnoVirtual() {
        cliente = Escenario.cliente();
        Escenario.liberarTurnoDelCliente(cliente);
        Acciones.visible(cliente, By.cssSelector(".request-card"), Config.ESPERA_LARGA);

        Acciones.seleccionar(cliente, Acciones.todos(cliente, By.cssSelector(".request-card select")).get(1), "virtual");
        Acciones.esperar(2500);
        int selectores = Acciones.todos(cliente, By.cssSelector(".request-card select")).size();
        String documentos = Acciones.textoPlano(cliente, By.cssSelector(".virtual-docs-preview"));
        Evidencia.nota("virtualSelectsVisibles", selectores);
        Evidencia.nota("virtualDocumentosPrevios", documentos);
        Evidencia.capturaCompleta(cliente, "cp18a_formulario_turno_virtual_docs");

        Acciones.clic(cliente, By.cssSelector(".get-turn-btn"));
        Acciones.visible(cliente,
                By.xpath("//*[contains(@class,'modal-title') and contains(.,'Turno Asignado')]"), Config.ESPERA_LARGA);
        Evidencia.captura(cliente, "cp18b_modal_turno_virtual_asignado");
        Acciones.clicTexto(cliente, "Entendido");

        Acciones.visible(cliente, By.cssSelector(".virtual-docs-card"), Config.ESPERA_LARGA);
        Acciones.esperar(4000);
        String numero = Acciones.texto(cliente, By.cssSelector(".turn-hero-number"));
        String sede = Acciones.texto(cliente, By.cssSelector(".turn-hero-sede"));
        Evidencia.nota("turnoVirtual", numero);
        Evidencia.nota("turnoVirtualSede", sede);
        Evidencia.capturaCompleta(cliente, "cp18c_turno_virtual_documentos_requeridos");

        assertEquals(2, selectores, "En modalidad virtual no se debe pedir la sede");
        assertTrue(numero.startsWith("W"),
                "Un turno virtual debe llevar el prefijo W, se obtuvo: " + numero);
        assertTrue(sede.toLowerCase().contains("virtual"), "La sede del turno debe ser Virtual");
    }
}
