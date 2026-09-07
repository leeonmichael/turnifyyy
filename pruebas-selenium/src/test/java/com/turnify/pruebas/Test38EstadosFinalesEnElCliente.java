package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 38 - Estados finales en la pantalla del cliente: ve su turno como atendido y como cancelado segun lo que haga el empleado (CP-19)")
class Test38EstadosFinalesEnElCliente {

    private WebDriver empleado;
    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
        Navegador.cerrar(empleado);
    }

    @Test
    void cp19_estadosFinalesEnElCliente() {
        empleado = Escenario.empleado();
        Escenario.limpiarCola(empleado);
        cliente = Escenario.cliente();

        String atendido = Escenario.turnoEnEspera(cliente, "general");
        Acciones.esperaJs(empleado, "document.body.innerText.includes('" + atendido + "')", Config.ESPERA_LARGA);
        Escenario.llamarSiguiente(empleado);
        Escenario.accionDelTurno(empleado, "Completar");
        boolean veAtendido = Acciones.esperaEnCliente(cliente, "document.querySelector('.banner-finished')");
        Acciones.esperar(1200);
        Evidencia.nota("clienteVeAtendido", veAtendido);
        Evidencia.captura(cliente, "em03c_cliente_turno_atendido");

        String cancelado = Escenario.turnoEnEspera(cliente, "general");
        Acciones.esperaJs(empleado, "document.body.innerText.includes('" + cancelado + "')", Config.ESPERA_LARGA);
        Escenario.llamarSiguiente(empleado);
        Escenario.accionDelTurno(empleado, "Cancelar");
        boolean veCancelado = Acciones.esperaEnCliente(cliente, "document.querySelector('.banner-cancelled')");
        Acciones.esperar(1200);
        Evidencia.nota("clienteVeCancelado", veCancelado);
        Evidencia.captura(cliente, "em05b_cliente_ve_cancelado");

        assertTrue(veAtendido,
                "El cliente debe ver que su turno " + atendido + " fue atendido");
        assertTrue(veCancelado,
                "El cliente debe ver que su turno " + cancelado + " fue cancelado");
    }
}
