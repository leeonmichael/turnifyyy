package com.turnify.pruebas;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DisplayName("Test 14 - Bloqueo de doble turno: con un turno activo no se ofrece el formulario para pedir otro (CP-14)")
class Test14BloqueoDobleTurno {

    private WebDriver cliente;

    @AfterEach
    void cerrar() {
        Evidencia.guardar();
        Navegador.cerrar(cliente);
    }

    @Test
    void cp14_bloqueoDobleTurno() {
        cliente = Escenario.cliente();
        String turno = Escenario.turnoEnEspera(cliente, "general");

        cliente.navigate().refresh();
        Acciones.visible(cliente, By.cssSelector(".turn-hero"), Config.ESPERA_LARGA);
        Acciones.esperar(3000);

        boolean hayFormulario = Acciones.existe(cliente, By.cssSelector(".request-card"));
        Evidencia.nota("formularioVisibleConTurnoActivo", hayFormulario);
        Evidencia.captura(cliente, "cp11_bloqueo_doble_turno");

        assertTrue(Acciones.existe(cliente, By.cssSelector(".turn-hero")),
                "Debe mostrarse la tarjeta del turno activo " + turno);
        assertFalse(hayFormulario,
                "Con un turno activo no debe mostrarse el formulario para pedir otro");
    }
}
