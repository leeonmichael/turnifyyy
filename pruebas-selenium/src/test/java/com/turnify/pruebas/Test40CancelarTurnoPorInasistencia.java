package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 40 - Cancelar por inasistencia: el empleado anula el turno en curso cuando el cliente no llega (CP-31)")
class Test40CancelarTurnoPorInasistencia {

    private WebDriver empleado;
    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
        Navegador.cerrar(empleado);
    }

    @Test
    void cp31_cancelarPorInasistencia() {
        empleado = Escenario.empleado();
        Escenario.limpiarCola(empleado);

        cliente = Escenario.cliente();
        String turno = Escenario.turnoEnEspera(cliente, "emergency");
        Evidencia.nota("turnoEmergencia", turno);
        Acciones.esperaJs(empleado, "document.body.innerText.includes('" + turno + "')", Config.ESPERA_LARGA);

        Escenario.llamarSiguiente(empleado);
        Escenario.accionDelTurno(empleado, "Cancelar");
        Acciones.esperar(2000);
        Evidencia.captura(empleado, "em05a_turno_cancelado_por_empleado");

        assertTrue(turno.startsWith("E"),
                "Un turno de emergencia debe llevar el prefijo E, se obtuvo: " + turno);
        assertTrue(!Acciones.existe(empleado, org.openqa.selenium.By.cssSelector("#currentTurn")),
                "Tras cancelar, el panel debe quedar sin turno en curso");
    }
}
