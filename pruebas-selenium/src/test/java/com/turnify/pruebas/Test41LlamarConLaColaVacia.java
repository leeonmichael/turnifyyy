package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 41 - Llamar con la cola vacia: el sistema avisa que no hay turnos en espera (CP-32)")
class Test41LlamarConLaColaVacia {

    private WebDriver empleado;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(empleado);
    }

    @Test
    void cp32_colaVacia() {
        empleado = Escenario.empleado();
        Escenario.limpiarCola(empleado);
        Acciones.esperar(6000);

        Acciones.clic(empleado, By.cssSelector("#callBtn"));
        String alerta = Acciones.aceptarAlerta(empleado);
        Acciones.esperar(3000);
        Evidencia.nota("colaVaciaAlerta", alerta);
        Evidencia.captura(empleado, "em06_sin_turnos_en_espera");

        assertTrue(alerta.toLowerCase().contains("no hay turnos"),
                "Con la cola vacia debe avisar 'No hay turnos en espera', mostro: " + alerta);
    }
}
