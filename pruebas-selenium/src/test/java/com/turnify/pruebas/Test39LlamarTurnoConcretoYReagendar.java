package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 39 - Llamar un turno concreto y reagendarlo: el empleado atiende un turno de la lista y le asigna una nueva fecha (CP-30)")
class Test39LlamarTurnoConcretoYReagendar {

    private WebDriver empleado;
    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
        Navegador.cerrar(empleado);
    }

    @Test
    void cp30_llamarConcretoYReagendar() {
        empleado = Escenario.empleado();
        Escenario.limpiarCola(empleado);

        cliente = Escenario.segundoCliente();
        String turno = Escenario.turnoEnEspera(cliente, "preferential");
        Acciones.ir(empleado, "/employee");
        Acciones.esperar(5000);

        Acciones.visible(empleado,
                By.xpath("//div[contains(@class,'turn-item')][contains(., '" + turno + "')]"), Config.ESPERA_LARGA);
        Evidencia.captura(empleado, "em04a_cola_espera_llamar_especifico");
        Acciones.clic(empleado, By.xpath("//div[contains(@class,'turn-item')][contains(., '" + turno
                + "')]//button[contains(@class,'call-turn-btn')]"));
        Acciones.visible(empleado, By.cssSelector("#currentTurn"), Config.ESPERA_LARGA);
        Acciones.esperar(2000);

        Escenario.abrirAccionesDelTurno(empleado);
        Acciones.clic(empleado,
                By.xpath("//div[contains(@class,'action-modal')]//button[contains(.,'Reagendar')]"));
        Acciones.visible(empleado, By.cssSelector(".reschedule-inline-form"), Config.ESPERA);

        WebElement fecha = Acciones.visible(empleado, By.cssSelector(".reschedule-inline-form input[type=date]"));
        String precargada = fecha.getAttribute("value");
        String nueva = Acciones.fechaEnDias(3);
        Acciones.fijarFecha(empleado, fecha, nueva);
        Evidencia.nota("reagendarFechaPrecargada", precargada);
        Evidencia.nota("reagendarFechaElegida", nueva);
        Evidencia.captura(empleado, "em04b_reagendar_fecha");

        Acciones.clic(empleado,
                By.xpath("//div[contains(@class,'reschedule-inline-form')]//button[contains(.,'Confirmar')]"));
        boolean sinTurno = Acciones.esperaJs(empleado,
                "!document.querySelector('#currentTurn')", Config.ESPERA_LARGA);
        Acciones.esperar(2500);
        Evidencia.capturaCompleta(empleado, "em04c_turno_reagendado_panel");

        boolean clienteVeReagendado = Acciones.esperaEnCliente(cliente,
                "document.body.innerText.includes('reagendado')");
        Acciones.esperar(1200);
        Evidencia.nota("clienteVeReagendado", clienteVeReagendado);
        Evidencia.captura(cliente, "em04d_cliente_ve_reagendado");

        assertTrue(sinTurno, "Tras reagendar, el turno " + turno + " debe salir de la atencion");
        assertTrue(clienteVeReagendado, "El cliente debe ver que su turno fue reagendado");
    }
}
