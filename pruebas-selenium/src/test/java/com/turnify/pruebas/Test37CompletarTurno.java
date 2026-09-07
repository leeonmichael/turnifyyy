package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 37 - Completar el turno: la accion Completar cierra la atencion y el panel queda sin turno en curso (CP-29)")
class Test37CompletarTurno {

    private WebDriver empleado;
    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
        Navegador.cerrar(empleado);
    }

    @Test
    void cp29_completarTurno() {
        empleado = Escenario.empleado();
        Escenario.limpiarCola(empleado);

        cliente = Escenario.cliente();
        String turno = Escenario.turnoEnEspera(cliente, "general");
        Acciones.esperaJs(empleado, "document.body.innerText.includes('" + turno + "')", Config.ESPERA_LARGA);
        Escenario.llamarSiguiente(empleado);

        Escenario.abrirAccionesDelTurno(empleado);
        Evidencia.captura(empleado, "em03a_modal_acciones_turno");
        Acciones.clic(empleado,
                By.xpath("//div[contains(@class,'action-modal')]//button[contains(.,'Completar')]"));
        boolean sinTurno = Acciones.esperaJs(empleado,
                "!document.querySelector('#currentTurn')", Config.ESPERA_LARGA);
        Acciones.esperar(2500);
        Evidencia.nota("turnoCompletado", turno);
        Evidencia.captura(empleado, "em03b_turno_completado_sin_turno");

        assertTrue(sinTurno, "Tras completar, el panel debe quedar sin turno en curso");
        assertFalse(Acciones.existe(empleado, By.cssSelector("#currentTurn")),
                "El bloque de turno actual debe desaparecer");
    }
}
