package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 20 - Cancelar desde Mis Turnos: el boton Cancelar de la lista anula el turno activo (CP-22)")
class Test20CancelarTurnoDesdeMisTurnos {

    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
    }

    @Test
    void cp22_cancelarDesdeLista() {
        cliente = Escenario.cliente();
        String turno = Escenario.turnoEnEspera(cliente, "general");

        Acciones.ir(cliente, "/my-turns");
        Acciones.visible(cliente, By.cssSelector(".page-title"), Config.ESPERA_LARGA);
        Acciones.esperar(4000);

        boolean hayBoton = Acciones.existe(cliente, By.cssSelector(".btn-cancel"));
        if (hayBoton) {
            Acciones.clic(cliente, Acciones.todos(cliente, By.cssSelector(".btn-cancel")).get(0));
            Acciones.esperar(6000);
        }

        String contenido = Acciones.textoPlano(cliente, By.cssSelector("body"));
        Evidencia.nota("cancelarDesdeMisTurnos", hayBoton);
        Evidencia.nota("turnoCanceladoDesdeLista", turno);
        Evidencia.capturaCompleta(cliente, "cp13d_mis_turnos_cancelar_desde_lista");
        Evidencia.captura(cliente, "cp13b_mis_turnos_historial_cancelado");

        assertTrue(hayBoton, "El turno activo " + turno + " debe ofrecer el boton Cancelar en la lista");
        assertTrue(contenido.toUpperCase().contains("CANCELADO"),
                "Tras cancelar, el turno debe aparecer como CANCELADO en el historial");
    }
}
