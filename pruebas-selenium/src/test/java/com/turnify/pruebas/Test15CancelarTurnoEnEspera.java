package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 15 - Cancelar el turno: el cliente anula su turno en espera y vuelve el formulario de solicitud (CP-15)")
class Test15CancelarTurnoEnEspera {

    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
    }

    @Test
    void cp15_cancelarTurno() {
        cliente = Escenario.cliente();
        String turno = Escenario.turnoEnEspera(cliente, "general");
        Acciones.visible(cliente, By.cssSelector(".btn-cancel-turn"), Config.ESPERA_LARGA);

        Acciones.clic(cliente, By.cssSelector(".btn-cancel-turn"));
        Acciones.visible(cliente, By.cssSelector(".request-card"), Config.ESPERA_LARGA);
        Acciones.esperar(1500);
        Evidencia.nota("turnoCanceladoPorCliente", turno);
        Evidencia.captura(cliente, "cp12_turno_cancelado_vuelve_formulario");

        assertTrue(Acciones.existe(cliente, By.cssSelector(".request-card")),
                "Tras cancelar debe volver el formulario Solicitar Turno");
        assertFalse(Acciones.existe(cliente, By.cssSelector(".turn-hero")),
                "La tarjeta de seguimiento del turno " + turno + " debe desaparecer");
    }
}
