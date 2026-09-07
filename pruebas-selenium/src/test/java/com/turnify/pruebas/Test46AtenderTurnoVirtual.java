package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 46 - Atender un turno virtual: se genera el enlace de videollamada y el cliente puede unirse (CP-37)")
class Test46AtenderTurnoVirtual {

    private WebDriver especialista;
    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
        Navegador.cerrar(especialista);
    }

    @Test
    void cp37_atenderTurnoVirtual() {
        cliente = Escenario.cliente();
        String turno = Escenario.turnoVirtualEnEspera(cliente);
        Escenario.adjuntarDocumento(cliente, 0);
        Evidencia.nota("turnoVirtualAtendido", turno);

        especialista = Escenario.especialistaVirtual();
        Escenario.atenderTurnoVirtual(especialista, turno);

        String enlace = Acciones.texto(especialista, By.cssSelector(".meet-bar-link"));
        Evidencia.nota("enlaceVideollamada", enlace);
        Evidencia.capturaCompleta(especialista, "vi03a_atencion_virtual_en_curso");

        boolean clienteVeVideollamada = Acciones.esperaEnCliente(cliente,
                "document.querySelector('.meet-call-card')");
        Acciones.esperar(1500);
        String enlaceCliente = Acciones.existe(cliente, By.cssSelector(".meet-call-btn"))
                ? cliente.findElement(By.cssSelector(".meet-call-btn")).getAttribute("href") : "";
        Evidencia.nota("enlaceVideollamadaCliente", enlaceCliente);
        Evidencia.capturaCompleta(cliente, "vi03b_cliente_videollamada_lista");

        assertTrue(enlace.contains("meet.jit.si"),
                "Debe generarse el enlace de la videollamada, se obtuvo: " + enlace);
        assertTrue(clienteVeVideollamada, "El cliente debe ver la tarjeta para unirse a la videollamada");
        assertTrue(enlaceCliente.contains(turno),
                "El enlace del cliente debe corresponder a su turno " + turno);
    }
}
