package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 19 - Historial de turnos: la pantalla Mis Turnos lista los turnos del cliente con sus contadores y estados (CP-21)")
class Test19HistorialDeTurnos {

    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
    }

    @Test
    void cp21_historialDeTurnos() {
        cliente = Escenario.cliente();
        Escenario.turnoEnEspera(cliente, "general");

        Acciones.ir(cliente, "/my-turns");
        Acciones.visible(cliente, By.cssSelector(".page-title"), Config.ESPERA_LARGA);
        Acciones.esperar(4000);

        String contenido = Acciones.textoPlano(cliente, By.cssSelector("body"));
        Evidencia.nota("misTurnosTexto", contenido.length() > 600 ? contenido.substring(0, 600) : contenido);
        Evidencia.captura(cliente, "cp13a_mis_turnos_activo");
        Evidencia.capturaCompleta(cliente, "cp13c_mis_turnos_virtual");

        assertTrue(contenido.contains("Mis Turnos"), "Debe abrirse la pantalla Mis Turnos");
        assertTrue(contenido.toUpperCase().contains("TOTAL"),
                "Deben verse los contadores del historial (Total, Activos, Atendidos, Cancelados)");
        assertTrue(contenido.toUpperCase().contains("EN ESPERA"),
                "El turno activo debe aparecer con su estado En espera");
    }
}
