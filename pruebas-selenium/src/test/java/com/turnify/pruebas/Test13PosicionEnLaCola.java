package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 13 - Posicion en la cola: con dos clientes en la misma sede, cada uno ve su lugar en la fila (CP-13)")
class Test13PosicionEnLaCola {

    private WebDriver primerCliente;
    private WebDriver segundoCliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(segundoCliente);
        Navegador.cerrar(primerCliente);
    }

    @Test
    void cp13_posicionEnLaCola() {
        primerCliente = Escenario.cliente();
        String turno1 = Escenario.turnoEnEspera(primerCliente, "general");
        Acciones.esperar(6000);
        String posicion1 = Acciones.textoPlano(primerCliente, By.cssSelector(".position-card"));
        Evidencia.nota("posicionCliente1", posicion1);

        segundoCliente = Escenario.segundoCliente();
        String turno2 = Escenario.turnoEnEspera(segundoCliente, "preferential");
        Acciones.esperar(7000);
        String posicion2 = Acciones.textoPlano(segundoCliente, By.cssSelector(".position-card"));
        Evidencia.nota("turnoCliente2", turno2);
        Evidencia.nota("posicionCliente2", posicion2);
        Evidencia.captura(segundoCliente, "cl_posicion_cola_2do");

        assertTrue(turno2.startsWith("B"),
                "Un turno preferencial debe llevar el prefijo B, se obtuvo: " + turno2);
        assertTrue(posicion1.contains("#"),
                "El primer cliente (" + turno1 + ") debe ver su posicion: " + posicion1);
        assertTrue(posicion2.contains("#"),
                "El segundo cliente debe ver su posicion en la cola: " + posicion2);
    }
}
